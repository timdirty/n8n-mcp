import Parser from 'rss-parser';
import type { DataSource } from '../config.js';
import { logger } from '../logger.js';

export interface RawItem {
  title: string;
  description: string;
  url: string;
  source: string;
  sourceId: string;
  publishDate: string | null;
  raw: Record<string, unknown>;
}

export async function fetchRSS(source: DataSource, timeoutMs: number): Promise<RawItem[]> {
  const parser = new Parser({ timeout: timeoutMs });
  logger.info(`Fetching RSS: ${source.name} (${source.url})`);

  try {
    const feed = await parser.parseURL(source.url);
    const items: RawItem[] = (feed.items || []).map(item => ({
      title: item.title || '',
      description: item.contentSnippet || item.content || '',
      url: item.link || '',
      source: source.name,
      sourceId: source.id,
      publishDate: item.isoDate || item.pubDate || null,
      raw: item as Record<string, unknown>,
    }));
    logger.info(`RSS ${source.name}: ${items.length} items`);
    return items;
  } catch (err) {
    logger.error(`RSS fetch failed: ${source.name} - ${(err as Error).message}`, 'fetch', { sourceId: source.id });
    return [];
  }
}
