/**
 * LINE Messaging API push client using native fetch().
 */

import type { LineMessage } from './line-flex-message.js';
import { logger } from './logger.js';

export interface LinePushConfig {
  channelAccessToken: string;
  groupId: string;
  maxRetryAttempts: number;
  batchSize: number;
}

/**
 * Push a text message to a LINE group.
 */
export async function pushTextMessage(config: LinePushConfig, text: string): Promise<boolean> {
  return pushToLine(config, [{ type: 'text', text }]);
}

/**
 * Push a flex message to a LINE group.
 */
export async function pushFlexMessage(config: LinePushConfig, message: LineMessage): Promise<boolean> {
  return pushToLine(config, [message]);
}

/**
 * Core push function with exponential-backoff retry.
 */
async function pushToLine(config: LinePushConfig, messages: unknown[]): Promise<boolean> {
  const url = 'https://api.line.me/v2/bot/message/push';
  const body = { to: config.groupId, messages };

  for (let attempt = 1; attempt <= config.maxRetryAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.channelAccessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        logger.info(`LINE push success (attempt ${attempt})`);
        return true;
      }

      const errText = await res.text();
      logger.warn(`LINE push failed (attempt ${attempt}/${config.maxRetryAttempts}): ${res.status} ${errText}`);

      if (attempt < config.maxRetryAttempts) {
        await sleep(1000 * Math.pow(2, attempt - 1));
      }
    } catch (err) {
      logger.error(`LINE push error (attempt ${attempt}): ${(err as Error).message}`, 'push');
      if (attempt < config.maxRetryAttempts) {
        await sleep(1000 * Math.pow(2, attempt - 1));
      }
    }
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
