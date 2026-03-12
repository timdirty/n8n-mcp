export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel: LogLevel = 'info';
let errorCallback: ((stage: string, message: string, stack?: string, context?: string) => void) | null = null;

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function setErrorCallback(cb: typeof errorCallback): void {
  errorCallback = cb;
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

export const logger = {
  debug(msg: string, ...args: unknown[]) {
    if (shouldLog('debug')) console.debug(`[DEBUG] ${msg}`, ...args);
  },
  info(msg: string, ...args: unknown[]) {
    if (shouldLog('info')) console.info(`[INFO] ${msg}`, ...args);
  },
  warn(msg: string, ...args: unknown[]) {
    if (shouldLog('warn')) console.warn(`[WARN] ${msg}`, ...args);
  },
  error(msg: string, stage: string, context?: Record<string, unknown>) {
    if (shouldLog('error')) console.error(`[ERROR][${stage}] ${msg}`);
    if (errorCallback) {
      errorCallback(stage, msg, new Error().stack, context ? JSON.stringify(context) : undefined);
    }
  },
};
