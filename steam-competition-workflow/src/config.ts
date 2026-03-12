import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

dotenv.config({ path: resolve(ROOT, '.env') });

function loadJSON<T>(filename: string): T {
  const raw = readFileSync(resolve(ROOT, 'config', filename), 'utf-8');
  return JSON.parse(raw) as T;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'rss' | 'api' | 'web' | 'search';
  url: string;
  enabled: boolean;
  priority: number;
  reliability: string;
  update_frequency: string;
  description: string;
  params?: Record<string, string>;
  note?: string;
}

export interface DataSourcesConfig {
  version: string;
  sources: DataSource[];
  fallback_sources: DataSource[];
}

export interface KeywordsConfig {
  version: string;
  steam_keywords: Record<string, string[]>;
  target_audience_keywords: Record<string, string[]>;
  exclude_keywords: string[];
  location_keywords: string[];
  organizer_keywords: Record<string, string[]>;
  prize_keywords: string[];
  fee_keywords: string[];
  date_keywords: string[];
}

export interface LineGroup {
  id: string;
  name: string;
  group_id: string;
  enabled: boolean;
  target_audience: string;
  description: string;
  message_format: string;
  max_items_per_message: number;
  send_time: string;
  filters?: { target_audience: string[]; exclude_categories: string[] };
  additional_info?: boolean;
}

export interface LineGroupsConfig {
  version: string;
  groups: LineGroup[];
  routing_rules: Record<string, unknown>;
  message_settings: Record<string, unknown>;
  notification_settings: Record<string, unknown>;
}

export interface Config {
  // LINE
  lineChannelAccessToken: string;
  lineGroupId: string;
  // AI
  openaiApiKey: string;
  openaiModel: string;
  // Settings
  scheduleHours: number;
  dbPath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableAiClassification: boolean;
  enableFlexMessage: boolean;
  batchSize: number;
  dedupTitleThreshold: number;
  dedupContentThreshold: number;
  dedupTimeWindowDays: number;
  apiTimeoutMs: number;
  maxRetryAttempts: number;
  dryRun: boolean;
  enableSourceCuration: boolean;
  curatorFailureThreshold: number;
  // JSON configs
  dataSources: DataSourcesConfig;
  keywords: KeywordsConfig;
  lineGroups: LineGroupsConfig;
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
}

export function loadConfig(): Config {
  return {
    lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    lineGroupId: process.env.LINE_GROUP_ID || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    scheduleHours: parseInt(process.env.SCHEDULE_HOURS || '6', 10),
    dbPath: process.env.DB_PATH || resolve(ROOT, 'data', 'steam.db'),
    logLevel: (process.env.LOG_LEVEL as Config['logLevel']) || 'info',
    enableAiClassification: envBool('ENABLE_AI_CLASSIFICATION', false),
    enableFlexMessage: envBool('ENABLE_FLEX_MESSAGE', false),
    batchSize: parseInt(process.env.BATCH_SIZE || '5', 10),
    dedupTitleThreshold: parseFloat(process.env.DEDUP_TITLE_THRESHOLD || '0.85'),
    dedupContentThreshold: parseFloat(process.env.DEDUP_CONTENT_THRESHOLD || '0.90'),
    dedupTimeWindowDays: parseInt(process.env.DEDUP_TIME_WINDOW_DAYS || '7', 10),
    apiTimeoutMs: parseInt(process.env.API_TIMEOUT_MS || '15000', 10),
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
    dryRun: envBool('DRY_RUN', false),
    enableSourceCuration: envBool('ENABLE_SOURCE_CURATION', true),
    curatorFailureThreshold: parseInt(process.env.CURATOR_FAILURE_THRESHOLD || '3', 10),
    dataSources: loadJSON<DataSourcesConfig>('data-sources.json'),
    keywords: loadJSON<KeywordsConfig>('keywords.json'),
    lineGroups: loadJSON<LineGroupsConfig>('line-groups.json'),
  };
}
