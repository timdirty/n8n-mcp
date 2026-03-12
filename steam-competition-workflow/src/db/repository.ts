import type Database from 'better-sqlite3';

export interface Competition {
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
  ai_categories: string | null;
  ai_primary: string | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_key_points: string | null;
  ai_call_to_action: string | null;
  sent_to_line: number;
  sent_at: string | null;
  scraped_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface RunRecord {
  run_id: string;
  started_at: string;
  finished_at?: string;
  status: string;
  sources_fetched: number;
  items_raw: number;
  items_normalized: number;
  items_filtered: number;
  items_after_dedup: number;
  items_classified: number;
  items_sent_line: number;
  dedup_stats?: string;
  duration_ms?: number;
  error_summary?: string;
}

export interface AiFields {
  ai_categories: string;
  ai_primary: string;
  ai_confidence: number;
  ai_summary: string;
  ai_key_points: string;
  ai_call_to_action: string;
}

export interface ErrorOpts {
  sourceId?: string;
  severity?: string;
  stack?: string;
  context?: string;
}

export class Repository {
  private db: Database.Database;

  private stmtInsertComp: Database.Statement;
  private stmtFindByHash: Database.Statement;
  private stmtFindByUrl: Database.Statement;
  private stmtGetRecent: Database.Statement;
  private stmtGetUnsent: Database.Statement;
  private stmtMarkSent: Database.Statement;
  private stmtUpdateAi: Database.Statement;
  private stmtStartRun: Database.Statement;
  private stmtFinishRun: Database.Statement;
  private stmtLogError: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;

    this.stmtInsertComp = db.prepare(`
      INSERT OR IGNORE INTO competitions (
        id, hash_key, title, organizer, category, target_audience,
        registration_start, registration_end, competition_date,
        location, description, url, contact, prize, fee,
        source, status, scraped_at, sent_to_line
      ) VALUES (
        @id, @hash_key, @title, @organizer, @category, @target_audience,
        @registration_start, @registration_end, @competition_date,
        @location, @description, @url, @contact, @prize, @fee,
        @source, @status, @scraped_at, @sent_to_line
      )
    `);

    this.stmtFindByHash = db.prepare(
      'SELECT * FROM competitions WHERE hash_key = ?'
    );

    this.stmtFindByUrl = db.prepare(
      'SELECT * FROM competitions WHERE url = ?'
    );

    this.stmtGetRecent = db.prepare(
      `SELECT * FROM competitions
       WHERE scraped_at >= datetime('now', '-' || ? || ' days')
       ORDER BY scraped_at DESC`
    );

    this.stmtGetUnsent = db.prepare(
      `SELECT * FROM competitions
       WHERE sent_to_line = 0 AND status = 'active'
       ORDER BY scraped_at DESC`
    );

    this.stmtMarkSent = db.prepare(
      `UPDATE competitions
       SET sent_to_line = 1, sent_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    );

    this.stmtUpdateAi = db.prepare(
      `UPDATE competitions
       SET ai_categories = @ai_categories,
           ai_primary = @ai_primary,
           ai_confidence = @ai_confidence,
           ai_summary = @ai_summary,
           ai_key_points = @ai_key_points,
           ai_call_to_action = @ai_call_to_action,
           updated_at = datetime('now')
       WHERE id = @id`
    );

    this.stmtStartRun = db.prepare(
      `INSERT INTO runs (run_id, started_at, status)
       VALUES (?, datetime('now'), 'running')`
    );

    this.stmtFinishRun = db.prepare(
      `UPDATE runs
       SET finished_at = datetime('now'),
           status = @status,
           duration_ms = @duration_ms,
           error_summary = @error_summary
       WHERE run_id = @run_id`
    );

    this.stmtLogError = db.prepare(
      `INSERT INTO error_log (run_id, stage, source_id, severity, message, stack, context)
       VALUES (@run_id, @stage, @source_id, @severity, @message, @stack, @context)`
    );
  }

  insertCompetition(comp: Pick<Competition, 'id' | 'hash_key' | 'title' | 'organizer' | 'category' | 'target_audience' | 'registration_start' | 'registration_end' | 'competition_date' | 'location' | 'description' | 'url' | 'contact' | 'prize' | 'fee' | 'source' | 'status' | 'scraped_at' | 'sent_to_line'>): void {
    this.stmtInsertComp.run({
      id: comp.id,
      hash_key: comp.hash_key,
      title: comp.title,
      organizer: comp.organizer,
      category: comp.category,
      target_audience: comp.target_audience,
      registration_start: comp.registration_start,
      registration_end: comp.registration_end,
      competition_date: comp.competition_date,
      location: comp.location,
      description: comp.description,
      url: comp.url,
      contact: comp.contact,
      prize: comp.prize,
      fee: comp.fee,
      source: comp.source,
      status: comp.status,
      scraped_at: comp.scraped_at,
      sent_to_line: comp.sent_to_line,
    });
  }

  findByHashKey(hashKey: string): Competition | null {
    return (this.stmtFindByHash.get(hashKey) as Competition) ?? null;
  }

  findByUrl(url: string): Competition | null {
    return (this.stmtFindByUrl.get(url) as Competition) ?? null;
  }

  getRecentCompetitions(days: number): Competition[] {
    return this.stmtGetRecent.all(days) as Competition[];
  }

  getUnsentCompetitions(): Competition[] {
    return this.stmtGetUnsent.all() as Competition[];
  }

  markAsSent(id: string): void {
    this.stmtMarkSent.run(id);
  }

  updateAiFields(id: string, fields: AiFields): void {
    this.stmtUpdateAi.run({ id, ...fields });
  }

  startRun(runId: string): void {
    this.stmtStartRun.run(runId);
  }

  updateRun(runId: string, updates: Partial<RunRecord>): void {
    const fields = Object.entries(updates)
      .filter(([key]) => key !== 'run_id')
      .map(([key]) => `${key} = @${key}`)
      .join(', ');

    if (!fields) return;

    const stmt = this.db.prepare(
      `UPDATE runs SET ${fields} WHERE run_id = @run_id`
    );
    stmt.run({ run_id: runId, ...updates });
  }

  finishRun(runId: string, status: string, updates: Partial<RunRecord>): void {
    this.stmtFinishRun.run({
      run_id: runId,
      status,
      duration_ms: updates.duration_ms ?? null,
      error_summary: updates.error_summary ?? null,
    });
  }

  logError(
    runId: string | null,
    stage: string,
    message: string,
    opts?: ErrorOpts
  ): void {
    this.stmtLogError.run({
      run_id: runId,
      stage,
      source_id: opts?.sourceId ?? null,
      severity: opts?.severity ?? 'error',
      message,
      stack: opts?.stack ?? null,
      context: opts?.context ?? null,
    });
  }
}
