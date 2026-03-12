import { createHash } from 'node:crypto';
import type { NormalizedItem } from './filter.js';
import { logger } from './logger.js';

export type { NormalizedItem };

export interface DedupConfig {
  titleSimilarityThreshold: number;
  contentSimilarityThreshold: number;
  timeWindowDays: number;
}

export interface DedupResult {
  item: NormalizedItem;
  reason: string;
  layer: number;
  similarity?: number;
}

export interface DedupStats {
  total: number;
  unique: number;
  duplicates: number;
  byLayer: Record<number, number>;
}

export interface ExistingItem {
  title: string;
  url: string | null;
  description: string | null;
  hash_key: string;
  scraped_at: string;
}

/**
 * Calculate MD5 hash of structured data.
 */
function calculateHash(data: { title: string; url: string | null; description: string | null }): string {
  return createHash('md5').update(JSON.stringify(data)).digest('hex');
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0) as number[]);

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate string similarity (0-1, where 1 means identical).
 */
function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * Calculate TF-IDF vector for a text given a corpus.
 */
function calculateTFIDF(text: string, corpus: string[]): Record<string, number> {
  const words = text.toLowerCase().match(/[\u4e00-\u9fa5a-z0-9]+/g) || [];
  const wordFreq: Record<string, number> = {};

  // Term Frequency (TF)
  for (const word of words) {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  }

  // Inverse Document Frequency (IDF)
  const idf: Record<string, number> = {};
  for (const word of Object.keys(wordFreq)) {
    const docCount = corpus.filter(doc => doc.toLowerCase().includes(word)).length;
    idf[word] = Math.log((corpus.length + 1) / (docCount + 1));
  }

  // TF-IDF
  const tfidf: Record<string, number> = {};
  for (const word of Object.keys(wordFreq)) {
    tfidf[word] = wordFreq[word] * idf[word];
  }

  return tfidf;
}

/**
 * Calculate cosine similarity between two TF-IDF vectors.
 */
function cosineSimilarity(vec1: Record<string, number>, vec2: Record<string, number>): number {
  const allKeys = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const key of allKeys) {
    const v1 = vec1[key] || 0;
    const v2 = vec2[key] || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  }

  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

interface CheckResult {
  isDuplicate: boolean;
  reason: string;
  layer: number;
  similarity?: number;
}

/**
 * 5-layer deduplication check for a single new item against existing items.
 *
 * Layer 1: Hash match (exact duplicate)
 * Layer 2: URL match
 * Layer 3: Title similarity (Levenshtein)
 * Layer 4: Time window + relaxed title similarity
 * Layer 5: Content similarity (TF-IDF + cosine)
 */
function checkDuplication(
  newItem: NormalizedItem,
  existingItems: ExistingItem[],
  config: DedupConfig,
): CheckResult {
  const timeWindowMs = config.timeWindowDays * 24 * 60 * 60 * 1000;
  const newItemTimestamp = new Date(newItem.scraped_at).getTime();

  // Layer 1: Hash deduplication
  const newItemHash = calculateHash({
    title: newItem.title,
    url: newItem.url,
    description: newItem.description,
  });

  for (const existing of existingItems) {
    const existingHash = calculateHash({
      title: existing.title,
      url: existing.url,
      description: existing.description,
    });

    if (newItemHash === existingHash) {
      return {
        isDuplicate: true,
        reason: 'Layer 1: Hash match (完全相同)',
        layer: 1,
      };
    }
  }

  // Layer 2: URL deduplication
  if (newItem.url) {
    for (const existing of existingItems) {
      if (existing.url === newItem.url) {
        return {
          isDuplicate: true,
          reason: 'Layer 2: URL match (相同網址)',
          layer: 2,
        };
      }
    }
  }

  // Layer 3: Title similarity deduplication
  for (const existing of existingItems) {
    const similarity = calculateSimilarity(newItem.title || '', existing.title || '');

    if (similarity >= config.titleSimilarityThreshold) {
      return {
        isDuplicate: true,
        reason: `Layer 3: Title similarity ${(similarity * 100).toFixed(1)}% (標題相似)`,
        layer: 3,
        similarity,
      };
    }
  }

  // Layer 4: Time window deduplication
  for (const existing of existingItems) {
    const existingTimestamp = new Date(existing.scraped_at).getTime();
    const timeDiff = Math.abs(newItemTimestamp - existingTimestamp);

    if (timeDiff <= timeWindowMs) {
      // Within time window, check with relaxed title threshold
      const similarity = calculateSimilarity(newItem.title || '', existing.title || '');

      if (similarity >= 0.70) {
        return {
          isDuplicate: true,
          reason: `Layer 4: Time window match (${Math.floor(timeDiff / (24 * 60 * 60 * 1000))} 天內相似)`,
          layer: 4,
          similarity,
        };
      }
    }
  }

  // Layer 5: Content similarity (TF-IDF + Cosine Similarity)
  const corpus = existingItems.map(item => item.description || '');
  corpus.push(newItem.description || '');

  const newItemVector = calculateTFIDF(newItem.description || '', corpus);

  for (const existing of existingItems) {
    const existingVector = calculateTFIDF(existing.description || '', corpus);
    const similarity = cosineSimilarity(newItemVector, existingVector);

    if (similarity >= config.contentSimilarityThreshold) {
      return {
        isDuplicate: true,
        reason: `Layer 5: Content similarity ${(similarity * 100).toFixed(1)}% (內容相似)`,
        layer: 5,
        similarity,
      };
    }
  }

  // Passed all deduplication layers
  return {
    isDuplicate: false,
    reason: 'Passed all deduplication layers (通過所有檢查)',
    layer: 0,
  };
}

/**
 * Run 5-layer deduplication on an array of new items against existing items.
 *
 * Returns unique items, duplicate details, and statistics.
 */
export function deduplicate(
  newItems: NormalizedItem[],
  existingItems: ExistingItem[],
  config: DedupConfig,
): { unique: NormalizedItem[]; duplicates: DedupResult[]; stats: DedupStats } {
  const unique: NormalizedItem[] = [];
  const duplicates: DedupResult[] = [];
  const stats: DedupStats = {
    total: newItems.length,
    unique: 0,
    duplicates: 0,
    byLayer: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  for (const item of newItems) {
    const result = checkDuplication(item, existingItems, config);

    if (result.isDuplicate) {
      stats.duplicates++;
      stats.byLayer[result.layer] = (stats.byLayer[result.layer] || 0) + 1;
      duplicates.push({
        item,
        reason: result.reason,
        layer: result.layer,
        similarity: result.similarity,
      });
    } else {
      stats.unique++;
      unique.push(item);
    }
  }

  logger.info(`Dedup: ${stats.total} → ${stats.unique} unique, ${stats.duplicates} duplicates`);
  logger.debug('Dedup stats by layer:', stats.byLayer);

  return { unique, duplicates, stats };
}
