/**
 * CLI entry point for STEAM Competition Workflow.
 *
 * Modes:
 *   (default)    Run pipeline once and exit.
 *   --daemon     Run immediately, then schedule on a cron interval.
 *   --dry-run    Run once without persisting data or pushing to LINE.
 */

import { loadConfig } from './config.js';
import { initDatabase } from './db/schema.js';
import { setLogLevel, setErrorCallback, logger } from './logger.js';
import { Repository } from './db/repository.js';
import { runPipeline } from './pipeline.js';
import cron from 'node-cron';

const args = process.argv.slice(2);
const isDaemon = args.includes('--daemon');
const isDryRun = args.includes('--dry-run');

async function main(): Promise<void> {
  const config = loadConfig();
  if (isDryRun) config.dryRun = true;

  setLogLevel(config.logLevel);

  const db = initDatabase(config.dbPath);
  const repo = new Repository(db);

  // Wire error callback to DB
  setErrorCallback((stage, message, stack, context) => {
    repo.logError(null, stage, message, { stack, context });
  });

  logger.info('STEAM Competition Workflow started');
  logger.info(`Mode: ${isDaemon ? 'daemon' : isDryRun ? 'dry-run' : 'once'}`);

  if (isDaemon) {
    // Run immediately, then on schedule
    await runPipeline(config, db);

    const cronExpr = `0 */${config.scheduleHours} * * *`;
    logger.info(`Scheduling: every ${config.scheduleHours} hours (${cronExpr})`);

    cron.schedule(cronExpr, async () => {
      logger.info('Scheduled run triggered');
      await runPipeline(config, db);
    });

    // Graceful shutdown
    const shutdown = () => {
      logger.info('Shutting down...');
      db.close();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } else {
    // Run once
    await runPipeline(config, db);
    db.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
