import type { DataSource } from '../config.js';
import { logger } from '../logger.js';
import type { RawItem } from './rss-fetcher.js';

export async function fetchAPI(source: DataSource, timeoutMs: number): Promise<RawItem[]> {
  logger.info(`Fetching API: ${source.name} (${source.url})`);

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
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as Record<string, unknown>;

    // Handle different API response structures
    const dataAsAny = data as Record<string, any>;
    const records: any[] = Array.isArray(data) ? data
      : Array.isArray(dataAsAny.result?.results) ? dataAsAny.result.results
      : Array.isArray(dataAsAny.data) ? dataAsAny.data
      : [];

    const items: RawItem[] = records.map((record: any) => ({
      title: record.title || record.name || '',
      description: record.notes || record.description || record.content || '',
      url: record.url || record.link || (record.resources?.[0]?.url) || '',
      source: source.name,
      sourceId: source.id,
      publishDate: record.date || record.publishDate || record.created_at || null,
      raw: record as Record<string, unknown>,
    }));

    logger.info(`API ${source.name}: ${items.length} items`);
    return items;
  } catch (err) {
    logger.error(`API fetch failed: ${source.name} - ${(err as Error).message}`, 'fetch', { sourceId: source.id });
    return [];
  }
}
