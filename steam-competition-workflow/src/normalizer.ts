import { createHash } from 'node:crypto';
import type { RawItem } from './fetchers/rss-fetcher.js';
import { logger } from './logger.js';

export interface NormalizedItem {
  id: string;
  hash_key: string;
  title: string;
  organizer: string;
  category: string;
  target_audience: string;
  registration_start: string | null;
  registration_end: string | null;
  competition_date: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  contact: string | null;
  prize: string | null;
  fee: string | null;
  source: string;
  status: string;
  scraped_at: string;
  sent_to_line: number;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Remove brackets and excess whitespace from a title. */
export function cleanTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/【.*?】/g, '')
    .replace(/\[.*?\]/g, '')
    .substring(0, 200);
}

/** Strip HTML tags and collapse whitespace. */
export function cleanDescription(description: string): string {
  return description
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/<[^>]*>/g, '')
    .substring(0, 2000);
}

/** Try to extract the organizer name from text by looking for known keywords. */
export function extractOrganizer(text: string): string {
  const organizerKeywords = [
    '主辦', '主辦單位', '承辦', '承辦單位', '指導單位',
  ];

  for (const keyword of organizerKeywords) {
    const index = text.indexOf(keyword);
    if (index !== -1) {
      const afterKeyword = text.substring(index + keyword.length);
      const match = afterKeyword.match(/[:：]\s*([^。！？\n]+)/);
      if (match) {
        return match[1].trim().substring(0, 100);
      }
    }
  }

  return '請參考官方網站';
}

/** Generate a unique ID from title + organizer + year. */
export function generateId(title: string, organizer: string): string {
  const hash = createHash('md5');
  const year = new Date().getFullYear();
  hash.update(`${title}-${organizer}-${year}`);
  return `steam_${year}_${hash.digest('hex').substring(0, 8)}`;
}

/** Generate a dedup hash key from normalized title + organizer + year. */
export function generateHashKey(title: string, organizer: string): string {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w\u4e00-\u9fff]/g, '');
  const normalizedOrganizer = organizer
    .toLowerCase()
    .replace(/\s+/g, '');
  const year = new Date().getFullYear();
  const hashInput = `${normalizedTitle}-${normalizedOrganizer}-${year}`;

  const hash = createHash('md5');
  hash.update(hashInput, 'utf8');
  return hash.digest('hex').substring(0, 12);
}

/** Classify an item into a STEAM category based on keyword matching. */
export function categorizeSTEAM(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  const categories: Record<string, string[]> = {
    Science: [
      '科學', '實驗', '研究', '生物', '化學', '物理', '自然',
      'science', 'biology', 'chemistry', 'physics', 'experiment',
    ],
    Technology: [
      '程式', '資訊', '科技', '軟體', '網路', 'AI', '人工智慧',
      'programming', 'coding', 'software', 'technology', 'computer',
    ],
    Engineering: [
      '工程', '機械', '建築', '設計', '製造', '機器人',
      'engineering', 'mechanical', 'robot', 'design', 'maker',
    ],
    Arts: [
      '藝術', '美術', '創意', '設計', '音樂', '表演',
      'arts', 'creative', 'design', 'music', 'art',
    ],
    Math: [
      '數學', '統計', '邏輯', '運算', '幾何',
      'math', 'mathematics', 'statistics', 'logic', 'geometry',
    ],
  };

  const scores: Record<string, number> = {};
  for (const [category, keywords] of Object.entries(categories)) {
    scores[category] = keywords.filter(keyword => text.includes(keyword)).length;
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'Mixed';

  const topCategories = Object.keys(scores).filter(cat => scores[cat] === maxScore);
  return topCategories.length > 1 ? 'Mixed' : topCategories[0];
}

/** Determine target audience from description keywords. */
export function extractTargetAudience(description: string): string {
  const text = description.toLowerCase();

  const audiences: Record<string, string[]> = {
    '國小': ['國小', '小學', '國民小學', 'elementary', '低年級', '中年級', '高年級'],
    '國中': ['國中', '中學', '國民中學', 'junior', '七年級', '八年級', '九年級'],
    '高中': ['高中', '高職', '高級中學', 'senior', '十年級', '十一年級', '十二年級'],
    '大學': ['大學', '大專', '大專院校', 'university', 'college', '研究所'],
  };

  for (const [audience, keywords] of Object.entries(audiences)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return audience;
    }
  }

  return '全年齡';
}

/** Extract a date from description using multiple patterns. */
export function extractDate(description: string, _type: 'deadline' | 'event'): string | null {
  const datePatterns = [
    /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日]?/g,
    /(\d{1,2})[月\-/](\d{1,2})[日]?/g,
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
  ];

  for (const pattern of datePatterns) {
    const matches = [...description.matchAll(pattern)];
    if (matches.length > 0) {
      const match = matches[0];
      let year: number;
      let month: number;
      let day: number;

      if (match.length === 4) {
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      } else if (match.length === 3) {
        year = new Date().getFullYear();
        month = parseInt(match[1], 10);
        day = parseInt(match[2], 10);
      } else {
        continue;
      }

      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  return null;
}

/** Extract location from description by matching known city/region keywords. */
export function extractLocation(description: string): string | null {
  const locationKeywords = [
    '台北', '新北', '桃園', '台中', '台南', '高雄',
    '基隆', '新竹', '苗栗', '彰化', '南投', '雲林',
    '嘉義', '屏東', '宜蘭', '花蓮', '台東', '澎湖',
    '金門', '連江', '線上', '網路', 'online',
  ];

  for (const keyword of locationKeywords) {
    if (description.includes(keyword)) {
      const sentences = description.split(/[。！？\n]/);
      for (const sentence of sentences) {
        if (sentence.includes(keyword)) {
          return sentence.trim().substring(0, 100);
        }
      }
    }
  }

  return '請參考官方網站';
}

/** Extract a phone number or email from the description. */
export function extractContact(description: string): string | null {
  const phonePattern = /(\d{2,4}[-\s]?\d{3,4}[-\s]?\d{4})/g;
  const phoneMatch = description.match(phonePattern);
  if (phoneMatch) return phoneMatch[0];

  const emailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
  const emailMatch = description.match(emailPattern);
  if (emailMatch) return emailMatch[0];

  return '請參考官方網站';
}

/** Extract prize information from the description. */
export function extractPrize(description: string): string | null {
  const prizeKeywords = ['獎金', '獎品', '獎項', '獎勵', '第一名', '冠軍', '優勝'];

  for (const keyword of prizeKeywords) {
    if (description.includes(keyword)) {
      const sentences = description.split(/[。！？\n]/);
      for (const sentence of sentences) {
        if (sentence.includes(keyword)) {
          return sentence.trim().substring(0, 200);
        }
      }
    }
  }

  return '請參考官方網站';
}

/** Extract fee information from the description. */
export function extractFee(description: string): string | null {
  if (description.includes('免費') || description.includes('不收費')) {
    return '免費';
  }

  const feePattern = /(\d+)\s*元/g;
  const feeMatch = description.match(feePattern);
  if (feeMatch) return feeMatch[0];

  return '請參考官方網站';
}

/** Determine whether a competition is active or expired. */
export function determineStatus(data: {
  registration_end: string | null;
  competition_date: string | null;
}): string {
  const now = new Date();

  if (data.registration_end) {
    const regEnd = new Date(data.registration_end);
    if (regEnd < now) return 'expired';
  }

  if (data.competition_date) {
    const compDate = new Date(data.competition_date);
    if (compDate < now) return 'expired';
  }

  return 'active';
}

/** Validate that a competition record has the minimum required fields. */
export function isValidCompetition(data: {
  title: string;
  organizer: string;
  status: string;
  description: string | null;
}): boolean {
  if (!data.title || data.title.length < 3) return false;
  if (!data.organizer || data.organizer === '未知主辦單位') return false;
  if (data.status === 'expired') return false;
  if (data.description && data.description.length < 10) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Source-specific normalizers
// ---------------------------------------------------------------------------

interface PartialNormalized {
  title: string;
  organizer: string;
  description: string;
  url: string;
  source: string;
  location?: string;
  registration_start?: string | null;
  registration_end?: string | null;
  competition_date?: string | null;
  fee?: string | null;
}

function normalizeEduRSS(raw: RawItem): PartialNormalized {
  return {
    title: cleanTitle(raw.title || ''),
    organizer: extractOrganizer(raw.description || ''),
    description: cleanDescription(raw.description || ''),
    url: raw.url || '',
    source: '教育部即時新聞',
  };
}

function normalizeK12eaRSS(raw: RawItem): PartialNormalized {
  return {
    title: cleanTitle(raw.title || ''),
    organizer: extractOrganizer(raw.description || '') || '國教署',
    description: cleanDescription(raw.description || ''),
    url: raw.url || '',
    source: '國教署RSS',
  };
}

function normalizeNSTCNews(raw: RawItem): PartialNormalized {
  return {
    title: cleanTitle(raw.title || ''),
    organizer: '國家科學及技術委員會',
    description: cleanDescription(raw.description || ''),
    url: raw.url || '',
    source: '國科會最新消息',
  };
}

function normalizeNSTCEvents(raw: RawItem): PartialNormalized {
  return {
    title: cleanTitle(raw.title || ''),
    organizer: extractOrganizer(raw.description || '') || '國家科學及技術委員會',
    description: cleanDescription(raw.description || ''),
    url: raw.url || '',
    source: '國科會活動訊息',
  };
}

function normalizeNMNS(raw: RawItem): PartialNormalized {
  return {
    title: cleanTitle(raw.title || ''),
    organizer: '國立自然科學博物館',
    description: cleanDescription(raw.description || ''),
    url: raw.url || '',
    source: '自然科學博物館',
  };
}

function normalizeNSTM(raw: RawItem): PartialNormalized {
  return {
    title: cleanTitle(raw.title || ''),
    organizer: '國立科學工藝博物館',
    description: cleanDescription(raw.description || ''),
    url: raw.url || '',
    source: '科學工藝博物館',
  };
}

function normalizeGovAPIData(raw: RawItem): PartialNormalized {
  const r = raw.raw as Record<string, any>;
  return {
    title: cleanTitle(raw.title || r.name || ''),
    organizer: r.organization || r.publisher || '政府單位',
    description: cleanDescription(r.notes || raw.description || ''),
    url: r.resources?.[0]?.url || raw.url || '',
    source: '政府開放資料',
  };
}

function normalizeMOSTWebData(raw: RawItem): PartialNormalized {
  return {
    title: cleanTitle(raw.title || ''),
    organizer: '科技部',
    description: cleanDescription(raw.description || ''),
    url: raw.url || '',
    source: '科技部網站',
  };
}

function normalizeNTSECAPIData(raw: RawItem): PartialNormalized {
  const r = raw.raw as Record<string, any>;
  return {
    title: cleanTitle(raw.title || r.eventName || ''),
    organizer: r.organizer || '國立臺灣科學教育館',
    description: cleanDescription(raw.description || ''),
    url: raw.url || '',
    location: r.location || r.venue || '台北市立科學教育館',
    registration_start: r.registrationStart || null,
    registration_end: r.registrationEnd || null,
    competition_date: r.eventDate || null,
    fee: r.fee || '請洽主辦單位',
    source: '科教館API',
  };
}

function normalizeGenericData(raw: RawItem): PartialNormalized {
  const r = raw.raw as Record<string, any>;
  return {
    title: cleanTitle(raw.title || r.name || ''),
    organizer: r.organizer || r.host || '未知主辦單位',
    description: cleanDescription(raw.description || ''),
    url: raw.url || '',
    source: raw.source || '其他來源',
  };
}

// ---------------------------------------------------------------------------
// Main normalize function
// ---------------------------------------------------------------------------

/**
 * Normalize an array of raw items into standardized competition records.
 * Performs basic in-batch dedup by hash_key.
 */
export function normalize(items: RawItem[]): NormalizedItem[] {
  const results: NormalizedItem[] = [];
  const seenHashes = new Set<string>();

  for (const item of items) {
    try {
      // Pick source-specific normalizer
      let partial: PartialNormalized;
      switch (item.sourceId) {
        case 'edu_rss':
          partial = normalizeEduRSS(item);
          break;
        case 'k12ea_rss':
          partial = normalizeK12eaRSS(item);
          break;
        case 'nstc_news':
          partial = normalizeNSTCNews(item);
          break;
        case 'nstc_events':
          partial = normalizeNSTCEvents(item);
          break;
        case 'nmns_rss':
          partial = normalizeNMNS(item);
          break;
        case 'nstm_rss':
          partial = normalizeNSTM(item);
          break;
        case 'gov_data':
          partial = normalizeGovAPIData(item);
          break;
        case 'most_web':
          partial = normalizeMOSTWebData(item);
          break;
        case 'ntsec_api':
          partial = normalizeNTSECAPIData(item);
          break;
        default:
          partial = normalizeGenericData(item);
      }

      const desc = partial.description || '';

      // Build full normalized item
      const registrationEnd = partial.registration_end ?? extractDate(desc, 'deadline');
      const competitionDate = partial.competition_date ?? extractDate(desc, 'event');

      const normalized: NormalizedItem = {
        id: generateId(partial.title, partial.organizer),
        hash_key: generateHashKey(partial.title, partial.organizer),
        title: partial.title,
        organizer: partial.organizer,
        category: categorizeSTEAM(partial.title, desc),
        target_audience: extractTargetAudience(desc),
        registration_start: partial.registration_start ?? null,
        registration_end: registrationEnd,
        competition_date: competitionDate,
        location: partial.location ?? extractLocation(desc),
        description: desc || null,
        url: partial.url || null,
        contact: extractContact(desc),
        prize: extractPrize(desc),
        fee: partial.fee ?? extractFee(desc),
        source: partial.source,
        status: determineStatus({ registration_end: registrationEnd, competition_date: competitionDate }),
        scraped_at: new Date().toISOString(),
        sent_to_line: 0,
      };

      if (isValidCompetition(normalized) && !seenHashes.has(normalized.hash_key)) {
        seenHashes.add(normalized.hash_key);
        results.push(normalized);
      }
    } catch (err) {
      logger.error(
        `Normalization failed for item "${item.title}": ${(err as Error).message}`,
        'normalize',
      );
    }
  }

  return results;
}
