import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "boothform.db");

let dbInstance: Database.Database | null = null;

function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_code TEXT UNIQUE NOT NULL,
      event_day INTEGER NOT NULL,
      day_sequence INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      primary_email TEXT NOT NULL,
      extra_emails TEXT NOT NULL DEFAULT '[]',
      group_size INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      photo_filenames TEXT,
      email_sent_at TEXT,
      email_error TEXT,
      email_attempts INTEGER NOT NULL DEFAULT 0,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_day
      ON submissions(event_day, day_sequence);

    CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at
      ON submissions(submitted_at DESC);

    CREATE INDEX IF NOT EXISTS idx_submissions_email
      ON submissions(primary_email);
  `);

  const cols = db
    .prepare("PRAGMA table_info(submissions)")
    .all() as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has("email_error")) {
    db.exec("ALTER TABLE submissions ADD COLUMN email_error TEXT");
  }
  if (!colNames.has("email_attempts")) {
    db.exec(
      "ALTER TABLE submissions ADD COLUMN email_attempts INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (colNames.has("phone")) {
    db.exec("ALTER TABLE submissions DROP COLUMN phone");
  }
  if (colNames.has("hear_about")) {
    db.exec("ALTER TABLE submissions DROP COLUMN hear_about");
  }
  if (colNames.has("consent_marketing")) {
    db.exec("ALTER TABLE submissions DROP COLUMN consent_marketing");
  }
  if (colNames.has("consent_age")) {
    db.exec("ALTER TABLE submissions DROP COLUMN consent_age");
  }

  dbInstance = db;
  return db;
}

export interface SubmissionInput {
  full_name: string;
  primary_email: string;
  extra_emails: string[];
  event_day: number;
}

export interface Submission {
  id: number;
  ticket_code: string;
  event_day: number;
  day_sequence: number;
  full_name: string;
  primary_email: string;
  extra_emails: string[];
  group_size: number;
  notes: string | null;
  photo_filenames: string | null;
  email_sent_at: string | null;
  email_error: string | null;
  email_attempts: number;
  submitted_at: string;
}

function formatTicket(day: number, seq: number): string {
  return `D${day}-${String(seq).padStart(3, "0")}`;
}

function rowToSubmission(row: Record<string, unknown>): Submission {
  return {
    id: row.id as number,
    ticket_code: row.ticket_code as string,
    event_day: row.event_day as number,
    day_sequence: row.day_sequence as number,
    full_name: row.full_name as string,
    primary_email: row.primary_email as string,
    extra_emails: JSON.parse((row.extra_emails as string) || "[]"),
    group_size: row.group_size as number,
    notes: (row.notes as string) || null,
    photo_filenames: (row.photo_filenames as string) || null,
    email_sent_at: (row.email_sent_at as string) || null,
    email_error: (row.email_error as string) || null,
    email_attempts: (row.email_attempts as number) || 0,
    submitted_at: row.submitted_at as string,
  };
}

export interface SendableFilter {
  day?: number;
  ticket?: string;
  includeAlreadySent?: boolean;
}

export function listSendable(filter: SendableFilter = {}): Submission[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (!filter.includeAlreadySent) {
    clauses.push("email_sent_at IS NULL");
  }
  if (filter.day) {
    clauses.push("event_day = ?");
    params.push(filter.day);
  }
  if (filter.ticket) {
    clauses.push("ticket_code = ?");
    params.push(filter.ticket);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT * FROM submissions
       ${where}
       ORDER BY event_day, day_sequence`,
    )
    .all(...params) as Record<string, unknown>[];

  return rows.map(rowToSubmission);
}

export function markEmailSent(ticketCode: string, photoFiles: string[]): void {
  const db = getDb();
  db.prepare(
    `UPDATE submissions
     SET email_sent_at = datetime('now'),
         email_error = NULL,
         email_attempts = email_attempts + 1,
         photo_filenames = ?
     WHERE ticket_code = ?`,
  ).run(photoFiles.join("|"), ticketCode);
}

export function markEmailFailed(ticketCode: string, error: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE submissions
     SET email_error = ?,
         email_attempts = email_attempts + 1
     WHERE ticket_code = ?`,
  ).run(error.slice(0, 500), ticketCode);
}

export function createSubmission(input: SubmissionInput): Submission {
  const db = getDb();

  const insert = db.transaction((data: SubmissionInput) => {
    const row = db
      .prepare(
        `SELECT COALESCE(MAX(day_sequence), 0) AS max_seq
         FROM submissions WHERE event_day = ?`,
      )
      .get(data.event_day) as { max_seq: number };

    const nextSeq = row.max_seq + 1;
    const ticket = formatTicket(data.event_day, nextSeq);
    const groupSize = 1 + data.extra_emails.length;

    const result = db
      .prepare(
        `INSERT INTO submissions (
          ticket_code, event_day, day_sequence,
          full_name, primary_email, extra_emails,
          group_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ticket,
        data.event_day,
        nextSeq,
        data.full_name,
        data.primary_email,
        JSON.stringify(data.extra_emails),
        groupSize,
      );

    return result.lastInsertRowid as number;
  });

  const id = insert(input);
  const row = db
    .prepare("SELECT * FROM submissions WHERE id = ?")
    .get(id) as Record<string, unknown>;
  return rowToSubmission(row);
}

export function getSubmissionByTicket(ticket: string): Submission | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM submissions WHERE ticket_code = ?")
    .get(ticket) as Record<string, unknown> | undefined;
  return row ? rowToSubmission(row) : null;
}

export function listSubmissions(options?: {
  day?: number;
  search?: string;
  limit?: number;
}): Submission[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (options?.day) {
    clauses.push("event_day = ?");
    params.push(options.day);
  }
  if (options?.search) {
    clauses.push(
      "(full_name LIKE ? OR primary_email LIKE ? OR ticket_code LIKE ? OR extra_emails LIKE ?)",
    );
    const q = `%${options.search}%`;
    params.push(q, q, q, q);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = options?.limit ?? 1000;

  const rows = db
    .prepare(
      `SELECT * FROM submissions ${where}
       ORDER BY submitted_at DESC LIMIT ?`,
    )
    .all(...params, limit) as Record<string, unknown>[];

  return rows.map(rowToSubmission);
}

export interface DayStats {
  day: number;
  count: number;
  total_emails: number;
}

export function getStats(): {
  total: number;
  total_emails: number;
  by_day: DayStats[];
  last_submission: string | null;
} {
  const db = getDb();

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(group_size), 0) AS total_emails,
              MAX(submitted_at) AS last_submission
       FROM submissions`,
    )
    .get() as {
    total: number;
    total_emails: number;
    last_submission: string | null;
  };

  const by_day = db
    .prepare(
      `SELECT event_day AS day,
              COUNT(*) AS count,
              COALESCE(SUM(group_size), 0) AS total_emails
       FROM submissions
       GROUP BY event_day
       ORDER BY event_day`,
    )
    .all() as DayStats[];

  return {
    total: totals.total,
    total_emails: totals.total_emails,
    by_day,
    last_submission: totals.last_submission,
  };
}
