/**
 * Source health checker — validates data sources before fetching.
 *
 * Tracks consecutive failures per source and auto-disables sources
 * that exceed the failure threshold. Writes health status to DB.
 */

import Parser from 'rss-parser';
import { logger } from './logger.js';
import type { DataSource } from './config.js';

export interface HealthStatus {
  sourceId: string;
  healthy: boolean;
  statusCode: number | null;
  responseType: string | null;
  itemCount: number | null;
  latencyMs: number;
  error: string | null;
  checkedAt: string;
}

export interface HealthReport {
  checkedAt: string;
  sources: HealthStatus[];
  healthy: number;
  unhealthy: number;
}

/**
 * Check if an RSS source is reachable and returns valid RSS XML.
 */
async function checkRSS(source: DataSource, timeoutMs: number): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const parser = new Parser({ timeout: timeoutMs });
    const feed = await parser.parseURL(source.url);
    const itemCount = feed.items?.length ?? 0;
    return {
      sourceId: source.id,
      healthy: itemCount > 0,
      statusCode: 200,
      responseType: 'rss',
      itemCount,
      latencyMs: Date.now() - start,
      error: itemCount === 0 ? 'RSS feed returned 0 items' : null,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      sourceId: source.id,
      healthy: false,
      statusCode: null,
      responseType: null,
      itemCount: null,
      latencyMs: Date.now() - start,
      error: (err as Error).message,
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Check if an API source is reachable and returns valid JSON.
 */
async function checkAPI(source: DataSource, timeoutMs: number): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const url = new URL(source.url);
    if (source.params) {
      for (const [key, value] of Object.entries(source.params)) {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        sourceId: source.id,
        healthy: false,
        statusCode: response.status,
        responseType: response.headers.get('content-type'),
        itemCount: null,
        latencyMs: Date.now() - start,
        error: `HTTP ${response.status}: ${response.statusText}`,
        checkedAt: new Date().toISOString(),
      };
    }

    const data = await response.json();
    return {
      sourceId: source.id,
      healthy: true,
      statusCode: response.status,
      responseType: 'json',
      itemCount: Array.isArray(data) ? data.length : null,
      latencyMs: Date.now() - start,
      error: null,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      sourceId: source.id,
      healthy: false,
      statusCode: null,
      responseType: null,
      itemCount: null,
      latencyMs: Date.now() - start,
      error: (err as Error).message,
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Run health check on a single source.
 */
export async function checkSource(source: DataSource, timeoutMs: number): Promise<HealthStatus> {
  if (source.type === 'rss') {
    return checkRSS(source, timeoutMs);
  } else if (source.type === 'api') {
    return checkAPI(source, timeoutMs);
  }
  return {
    sourceId: source.id,
    healthy: false,
    statusCode: null,
    responseType: null,
    itemCount: null,
    latencyMs: 0,
    error: `Unsupported source type: ${source.type}`,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Run health checks on all enabled sources and return a report.
 */
export async function checkAllSources(
  sources: DataSource[],
  timeoutMs: number,
): Promise<HealthReport> {
  const enabled = sources.filter(s => s.enabled);
  const results = await Promise.all(enabled.map(s => checkSource(s, timeoutMs)));

  const report: HealthReport = {
    checkedAt: new Date().toISOString(),
    sources: results,
    healthy: results.filter(r => r.healthy).length,
    unhealthy: results.filter(r => !r.healthy).length,
  };

  for (const status of results) {
    if (status.healthy) {
      logger.info(`Health OK: ${status.sourceId} (${status.latencyMs}ms, ${status.itemCount} items)`);
    } else {
      logger.warn(`Health FAIL: ${status.sourceId} — ${status.error}`);
    }
  }

  logger.info(`Health check: ${report.healthy}/${enabled.length} healthy`);
  return report;
}
