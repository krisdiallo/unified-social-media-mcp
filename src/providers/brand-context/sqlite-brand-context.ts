// ---------------------------------------------------------------------------
// Brand context provider — simple key-value CRUD backed by SQLite
// ---------------------------------------------------------------------------

import type {
  BrandContextProvider,
  BrandContext,
} from "../../types.js";
import { getDb } from "../../db.js";

interface BrandContextRow {
  key: string;
  value: string;
  updated_at: string;
}

export class SqliteBrandContextProvider implements BrandContextProvider {
  readonly name = "sqlite";

  async get(key: string): Promise<string | null> {
    const db = getDb();
    const row = db.prepare("SELECT value FROM brand_context WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO brand_context (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).run(key, value, now);
  }

  async getAll(): Promise<BrandContext[]> {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM brand_context ORDER BY key ASC").all() as BrandContextRow[];

    return rows.map((row) => ({
      key: row.key,
      value: row.value,
      updatedAt: row.updated_at,
    }));
  }

  async delete(key: string): Promise<void> {
    const db = getDb();
    const result = db.prepare("DELETE FROM brand_context WHERE key = ?").run(key);
    if (result.changes === 0) throw new Error(`Brand context key "${key}" not found`);
  }
}
