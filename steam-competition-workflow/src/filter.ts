import type { KeywordsConfig } from './config.js';
import type { NormalizedItem } from './normalizer.js';
import { logger } from './logger.js';

export type { NormalizedItem };

export function filterByKeywords(items: NormalizedItem[], keywords: KeywordsConfig): NormalizedItem[] {
  const allSteamKeywords = Object.values(keywords.steam_keywords).flat();
  const excludeKeywords = keywords.exclude_keywords;

  const filtered = items.filter(item => {
    const text = `${item.title} ${item.description || ''}`.toLowerCase();

    // Must match at least one STEAM keyword
    const hasMatch = allSteamKeywords.some(kw => text.includes(kw.toLowerCase()));
    if (!hasMatch) return false;

    // Must NOT match any exclude keyword
    const isExcluded = excludeKeywords.some(kw => text.includes(kw.toLowerCase()));
    if (isExcluded) return false;

    return true;
  });

  logger.info(`Filter: ${items.length} → ${filtered.length} (${items.length - filtered.length} excluded)`);
  return filtered;
}
