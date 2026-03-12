/**
 * LLM-powered source curator — evaluates, maintains, and discovers data sources.
 *
 * Runs periodically (less frequently than the main pipeline) to:
 * 1. Evaluate health check results and decide which sources to keep/disable
 * 2. Assess whether existing sources still provide STEAM-relevant content
 * 3. Suggest new potential sources via web search analysis
 *
 * Uses the same OpenAI integration as ai-classifier.ts.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './logger.js';
import type { DataSource, DataSourcesConfig } from './config.js';
import type { HealthReport } from './health-checker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_SOURCES_PATH = resolve(__dirname, '..', 'config', 'data-sources.json');

export interface CuratorConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface CuratorReport {
  timestamp: string;
  evaluations: SourceEvaluation[];
  recommendations: string[];
  actionsApplied: string[];
}

export interface SourceEvaluation {
  sourceId: string;
  action: 'keep' | 'disable' | 'monitor';
  reason: string;
  steamRelevance: number;
}

interface LLMEvaluationResponse {
  evaluations: {
    sourceId: string;
    action: 'keep' | 'disable' | 'monitor';
    reason: string;
    steamRelevance: number;
  }[];
  recommendations: string[];
}

const CURATOR_SYSTEM_PROMPT = `你是一位台灣 STEAM 教育資料源管理專家。你的任務是評估資料源的健康狀態和相關性。

**評估標準：**
1. 健康狀態：來源是否正常回應？延遲是否合理？
2. STEAM 相關性：內容是否與 STEAM 教育（科學、技術、工程、藝術、數學）競賽相關？
3. 內容品質：來源是否提供有用的教育活動/競賽資訊？

**動作定義：**
- keep: 來源健康且內容相關，繼續使用
- disable: 來源壞掉（連續失敗）或內容完全不相關，暫時停用
- monitor: 來源有警告跡象（偶爾失敗、內容相關性下降），需要關注

**輸出格式（JSON）：**
{
  "evaluations": [
    {
      "sourceId": "xxx",
      "action": "keep",
      "reason": "來源健康，每次抓取 50+ 教育相關項目",
      "steamRelevance": 0.85
    }
  ],
  "recommendations": [
    "建議新增 xxx 作為資料源，因為...",
    "建議調整 xxx 的優先順序..."
  ]
}`;

/**
 * Call OpenAI for source evaluation.
 */
async function callLLM(
  config: CuratorConfig,
  prompt: string,
): Promise<LLMEvaluationResponse | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: CURATOR_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.error(`Curator LLM error: ${response.status}`, 'curator');
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content) as LLMEvaluationResponse;
  } catch (err) {
    logger.error(`Curator LLM failed: ${(err as Error).message}`, 'curator');
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Build the evaluation prompt from health report and source config.
 */
function buildEvaluationPrompt(
  sources: DataSource[],
  healthReport: HealthReport,
  failureCounts: Map<string, number>,
): string {
  const sourceDetails = sources.map(s => {
    const health = healthReport.sources.find(h => h.sourceId === s.id);
    const failures = failureCounts.get(s.id) ?? 0;
    return `- ${s.id} (${s.name}):
  - enabled: ${s.enabled}
  - type: ${s.type}
  - URL: ${s.url}
  - 描述: ${s.description}
  - 健康狀態: ${health ? (health.healthy ? `正常 (${health.itemCount} items, ${health.latencyMs}ms)` : `失敗 (${health.error})`) : '未檢測'}
  - 連續失敗次數: ${failures}`;
  });

  return `請評估以下資料源的狀態和 STEAM 相關性：

**資料源列表：**
${sourceDetails.join('\n')}

**健康檢查摘要：**
- 檢查時間: ${healthReport.checkedAt}
- 健康: ${healthReport.healthy} 個
- 不健康: ${healthReport.unhealthy} 個

**規則：**
1. 連續失敗 3 次以上的來源建議 disable
2. 連續失敗 1-2 次的來源建議 monitor
3. STEAM 相關性低於 0.3 的來源建議 disable
4. 已 disabled 的來源不需要評估（直接 skip）

請給出每個啟用來源的評估和整體建議。`;
}

/**
 * Apply curator actions: update data-sources.json for disabled sources.
 */
function applyActions(evaluations: SourceEvaluation[]): string[] {
  const actions: string[] = [];
  const disableIds = evaluations
    .filter(e => e.action === 'disable')
    .map(e => e.sourceId);

  if (disableIds.length === 0) return actions;

  try {
    const raw = readFileSync(DATA_SOURCES_PATH, 'utf-8');
    const config = JSON.parse(raw) as DataSourcesConfig;

    for (const source of config.sources) {
      if (disableIds.includes(source.id) && source.enabled) {
        source.enabled = false;
        const eval_ = evaluations.find(e => e.sourceId === source.id);
        source.note = `Auto-disabled by curator: ${eval_?.reason ?? 'unknown reason'}`;
        actions.push(`Disabled ${source.id}: ${eval_?.reason}`);
        logger.warn(`Curator disabled source: ${source.id}`);
      }
    }

    if (actions.length > 0) {
      writeFileSync(DATA_SOURCES_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      logger.info(`Curator updated data-sources.json: ${actions.length} sources disabled`);
    }
  } catch (err) {
    logger.error(`Curator failed to update config: ${(err as Error).message}`, 'curator');
  }

  return actions;
}

/**
 * In-memory failure tracker. Resets on healthy check.
 */
const failureTracker = new Map<string, number>();

/**
 * Update failure counts from a health report.
 */
export function updateFailureCounts(report: HealthReport): Map<string, number> {
  for (const status of report.sources) {
    if (status.healthy) {
      failureTracker.set(status.sourceId, 0);
    } else {
      const current = failureTracker.get(status.sourceId) ?? 0;
      failureTracker.set(status.sourceId, current + 1);
    }
  }
  return failureTracker;
}

/**
 * Get current failure counts (for external inspection).
 */
export function getFailureCounts(): Map<string, number> {
  return new Map(failureTracker);
}

/**
 * Run the full curation cycle:
 * 1. Update failure counts from latest health report
 * 2. Call LLM for evaluation (if API key available)
 * 3. Apply recommended actions (auto-disable broken sources)
 *
 * If no API key is provided, falls back to rule-based curation
 * (auto-disable after 3 consecutive failures).
 */
export async function curate(
  sources: DataSource[],
  healthReport: HealthReport,
  config: CuratorConfig | null,
): Promise<CuratorReport> {
  const timestamp = new Date().toISOString();
  updateFailureCounts(healthReport);

  // If no LLM config, use rule-based curation
  if (!config?.apiKey) {
    logger.info('Curator running in rule-based mode (no API key)');
    return curateRuleBased(sources, healthReport, timestamp);
  }

  // LLM-powered curation
  const prompt = buildEvaluationPrompt(sources, healthReport, failureTracker);
  const llmResult = await callLLM(config, prompt);

  if (!llmResult) {
    logger.warn('Curator LLM failed, falling back to rule-based');
    return curateRuleBased(sources, healthReport, timestamp);
  }

  const actionsApplied = applyActions(llmResult.evaluations);

  const report: CuratorReport = {
    timestamp,
    evaluations: llmResult.evaluations,
    recommendations: llmResult.recommendations,
    actionsApplied,
  };

  logger.info(`Curator complete: ${report.evaluations.length} evaluated, ${actionsApplied.length} actions applied`);
  for (const rec of report.recommendations) {
    logger.info(`Curator recommendation: ${rec}`);
  }

  return report;
}

/**
 * Rule-based curation fallback (no LLM needed).
 * Auto-disables sources with 3+ consecutive failures.
 */
function curateRuleBased(
  sources: DataSource[],
  healthReport: HealthReport,
  timestamp: string,
): CuratorReport {
  const evaluations: SourceEvaluation[] = [];

  for (const source of sources.filter(s => s.enabled)) {
    const failures = failureTracker.get(source.id) ?? 0;
    const health = healthReport.sources.find(h => h.sourceId === source.id);

    if (failures >= 3) {
      evaluations.push({
        sourceId: source.id,
        action: 'disable',
        reason: `${failures} consecutive failures: ${health?.error ?? 'unknown'}`,
        steamRelevance: 0,
      });
    } else if (failures >= 1) {
      evaluations.push({
        sourceId: source.id,
        action: 'monitor',
        reason: `${failures} failure(s), monitoring`,
        steamRelevance: 0.5,
      });
    } else {
      evaluations.push({
        sourceId: source.id,
        action: 'keep',
        reason: 'Healthy',
        steamRelevance: 1,
      });
    }
  }

  const actionsApplied = applyActions(evaluations);

  return {
    timestamp,
    evaluations,
    recommendations: [],
    actionsApplied,
  };
}
