// ---------------------------------------------------------------------------
// SQLite persistence layer — single DB file for all stateful providers
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = process.env.SOCIAL_MCP_DB_PATH
    ?? path.join(os.homedir(), ".social-mcp", "data.db");

  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  initTables(_db);
  return _db;
}

function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_posts (
      id TEXT PRIMARY KEY,
      content_json TEXT NOT NULL,
      platforms_json TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      campaign_id TEXT,
      results_json TEXT,
      error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      platforms_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idea',
      media_urls_json TEXT,
      campaign_id TEXT,
      scheduled_at TEXT,
      tags_json TEXT,
      notes TEXT,
      created_by TEXT,
      reviewed_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      platforms_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      tags_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_history (
      id TEXT NOT NULL,
      platform TEXT NOT NULL,
      text TEXT NOT NULL,
      media_urls_json TEXT,
      created_at TEXT NOT NULL,
      metrics_json TEXT,
      campaign_id TEXT,
      synced_at TEXT NOT NULL,
      PRIMARY KEY (id, platform)
    );

    CREATE TABLE IF NOT EXISTS brand_context (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_library (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      size_bytes INTEGER,
      tags_json TEXT,
      created_at TEXT NOT NULL
    );
  `);
}
