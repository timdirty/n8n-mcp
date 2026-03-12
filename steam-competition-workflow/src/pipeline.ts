/**
 * Pipeline orchestrator: health-check -> fetch -> normalize -> filter -> dedup -> AI classify -> save -> push LINE -> curate
 */

import { randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import type Database from 'better-sqlite3';
import { Repository } from './db/repository.js';
import { fetchRSS } from './fetchers/rss-fetcher.js';
import { fetchAPI } from './fetchers/api-fetcher.js';
import { normalize } from './normalizer.js';
import { filterByKeywords } from './filter.js';
import { deduplicate } from './dedup.js';
import { classifyAndSummarize } from './ai-classifier.js';
import { buildFlexPayload } from './line-flex-message.js';
import { formatTextMessage, formatCategorySummary } from './message-formatter.js';
import { pushTextMessage, pushFlexMessage } from './line-push.js';
import { checkAllSources } from './health-checker.js';
import { curate, updateFailureCounts } from './source-curator.js';
import { logger } from './logger.js';
import type { RawItem } from './fetchers/rss-fetcher.js';

export async function runPipeline(config: Config, db: Database.Database): Promise<void> {
  const repo = new Repository(db);
  const runId = randomUUID();
  const startTime = Date.now();

  repo.startRun(runId);
  logger.info(`Pipeline started: ${runId}`);

  try {
    // 0. Health check all enabled sources
    const healthReport = await checkAllSources(config.dataSources.sources, config.apiTimeoutMs);
    updateFailureCounts(healthReport);
    const healthySources = new Set(
      healthReport.sources.filter(s => s.healthy).map(s => s.sourceId),
    );

    // 1. Fetch from healthy enabled sources only
    const enabledSources = config.dataSources.sources.filter(
      s => s.enabled && healthySources.has(s.id),
    );
    const rawItems: RawItem[] = [];

    for (const source of enabledSources) {
      try {
        let items: RawItem[];
        if (source.type === 'rss') {
          items = await fetchRSS(source, config.apiTimeoutMs);
        } else if (source.type === 'api') {
          items = await fetchAPI(source, config.apiTimeoutMs);
        } else {
          logger.warn(`Skipping unsupported source type: ${source.type} (${source.name})`);
          continue;
        }
        rawItems.push(...items);
      } catch (err) {
        repo.logError(runId, 'fetch', `Source ${source.name} failed: ${(err as Error).message}`, {
          sourceId: source.id,
        });
      }
    }

    repo.updateRun(runId, { sources_fetched: enabledSources.length, items_raw: rawItems.length });
    logger.info(`Fetched ${rawItems.length} raw items from ${enabledSources.length} sources`);

    // 2. Normalize
    const normalized = normalize(rawItems);
    repo.updateRun(runId, { items_normalized: normalized.length });
    logger.info(`Normalized: ${normalized.length} items`);

    // 3. Filter
    const filtered = filterByKeywords(normalized, config.keywords);
    repo.updateRun(runId, { items_filtered: filtered.length });

    // 4. Dedup against DB
    const existing = repo.getRecentCompetitions(config.dedupTimeWindowDays);
    const { unique, stats: dedupStats } = deduplicate(filtered, existing, {
      titleSimilarityThreshold: config.dedupTitleThreshold,
      contentSimilarityThreshold: config.dedupContentThreshold,
      timeWindowDays: config.dedupTimeWindowDays,
    });
    repo.updateRun(runId, {
      items_after_dedup: unique.length,
      dedup_stats: JSON.stringify(dedupStats),
    });
    logger.info(`Dedup: ${filtered.length} → ${unique.length} unique`);

    // 5. AI Classification (optional)
    let classifiedCount = 0;
    if (config.enableAiClassification && config.openaiApiKey) {
      for (const item of unique) {
        try {
          const result = await classifyAndSummarize(item, {
            apiKey: config.openaiApiKey,
            model: config.openaiModel,
            timeoutMs: config.apiTimeoutMs,
          });
          if (result) {
            const itemAny = item as unknown as Record<string, unknown>;
            itemAny.ai_categories = result.categories;
            itemAny.ai_primary = result.primary;
            itemAny.ai_confidence = result.confidence;
            itemAny.ai_summary = result.summary;
            itemAny.ai_key_points = result.keyPoints;
            itemAny.ai_call_to_action = result.callToAction;
            classifiedCount++;
          }
        } catch (err) {
          repo.logError(runId, 'classify', `AI classification failed for: ${item.title}`, {
            sourceId: item.id,
          });
        }
      }
      repo.updateRun(runId, { items_classified: classifiedCount });
      logger.info(`AI classified: ${classifiedCount}/${unique.length}`);
    }

    // 6. Save to DB
    if (!config.dryRun) {
      for (const item of unique) {
        try {
          repo.insertCompetition(item);
        } catch (err) {
          repo.logError(runId, 'save', `Failed to save: ${item.title} - ${(err as Error).message}`);
        }
      }
    }

    // 7. Push to LINE
    let sentCount = 0;
    if (!config.dryRun && unique.length > 0 && config.lineChannelAccessToken && config.lineGroupId) {
      const pushConfig = {
        channelAccessToken: config.lineChannelAccessToken,
        groupId: config.lineGroupId,
        maxRetryAttempts: config.maxRetryAttempts,
        batchSize: config.batchSize,
      };

      if (config.enableFlexMessage) {
        const flexPayload = buildFlexPayload(
          unique.map(item => {
            const a = item as unknown as Record<string, unknown>;
            return {
              title: item.title,
              organizer: item.organizer,
              category: item.category,
              target_audience: item.target_audience,
              registration_end: item.registration_end,
              location: item.location,
              url: item.url,
              source: item.source,
              ai_categories: (a.ai_categories as string) ?? null,
              ai_primary: (a.ai_primary as string) ?? null,
              ai_confidence: (a.ai_confidence as number) ?? null,
              ai_summary: (a.ai_summary as string) ?? null,
              ai_key_points: (a.ai_key_points as string) ?? null,
              ai_call_to_action: (a.ai_call_to_action as string) ?? null,
              description: item.description,
            };
          }),
        );
        const success = await pushFlexMessage(pushConfig, flexPayload);
        if (success) sentCount = unique.length;
      } else {
        // Text message
        const textComps = unique.map(item => ({
          title: item.title,
          organizer: item.organizer,
          category: item.category,
          target_audience: item.target_audience,
          registration_end: item.registration_end,
          url: item.url,
        }));
        const formatted =
          unique.length > 3 ? formatCategorySummary(textComps) : formatTextMessage(textComps);

        if (formatted.hasData) {
          const success = await pushTextMessage(pushConfig, formatted.message);
          if (success) sentCount = unique.length;
        }
      }

      // Mark as sent in DB
      if (sentCount > 0 && !config.dryRun) {
        for (const item of unique) {
          try {
            repo.markAsSent(item.id);
          } catch {
            // Silently skip — item may not have been inserted (e.g. duplicate hash)
          }
        }
      }

      repo.updateRun(runId, { items_sent_line: sentCount });
      logger.info(`LINE push: ${sentCount} items sent`);
    }

    // 8. Source curation (auto-heal broken sources)
    const curatorConfig = config.openaiApiKey
      ? { apiKey: config.openaiApiKey, model: config.openaiModel, timeoutMs: config.apiTimeoutMs }
      : null;
    const curatorReport = await curate(config.dataSources.sources, healthReport, curatorConfig);
    if (curatorReport.actionsApplied.length > 0) {
      logger.info(`Curator actions: ${curatorReport.actionsApplied.join('; ')}`);
    }

    // 9. Finish run
    const duration = Date.now() - startTime;
    repo.finishRun(runId, 'success', { duration_ms: duration });
    logger.info(
      `Pipeline completed in ${duration}ms: ${unique.length} new items, ${sentCount} sent to LINE`,
    );
  } catch (err) {
    const duration = Date.now() - startTime;
    const errMsg = (err as Error).message;
    repo.logError(runId, 'pipeline', errMsg, { stack: (err as Error).stack });
    repo.finishRun(runId, 'failed', { duration_ms: duration, error_summary: errMsg });
    logger.error(`Pipeline failed: ${errMsg}`, 'pipeline');
  }
}
