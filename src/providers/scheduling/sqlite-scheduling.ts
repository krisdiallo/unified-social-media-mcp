import type { SchedulingProvider, ScheduleRequest, ScheduledPost, PlatformProvider, PlatformName } from "../../types.js";
import { getDb } from "../../db.js";
import crypto from "node:crypto";

export class SqliteSchedulingProvider implements SchedulingProvider {
  readonly name = "sqlite";
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private platformProviders: Map<PlatformName, PlatformProvider>) {
    this.resumePendingTimers();
  }

  async schedule(request: ScheduleRequest): Promise<ScheduledPost> {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`INSERT INTO scheduled_posts (id, content_json, platforms_json, scheduled_at, status, campaign_id, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)`)
      .run(id, JSON.stringify(request.content), JSON.stringify(request.platforms), request.scheduledAt, request.campaignId ?? null, now);

    const post: ScheduledPost = { id, content: request.content, platforms: request.platforms, scheduledAt: request.scheduledAt, status: "pending", campaignId: request.campaignId, createdAt: now };
    this.setTimer(post);
    return post;
  }

  async cancel(scheduleId: string): Promise<void> {
    const db = getDb();
    const row = db.prepare("SELECT status FROM scheduled_posts WHERE id = ?").get(scheduleId) as { status: string } | undefined;
    if (!row) throw new Error(`Scheduled post ${scheduleId} not found`);
    if (row.status !== "pending") throw new Error(`Cannot cancel post with status ${row.status}`);
    db.prepare("UPDATE scheduled_posts SET status = 'cancelled' WHERE id = ?").run(scheduleId);
    const timer = this.timers.get(scheduleId);
    if (timer) { clearTimeout(timer); this.timers.delete(scheduleId); }
  }

  async list(filters?: { campaignId?: string; status?: string }): Promise<ScheduledPost[]> {
    const db = getDb();
    let sql = "SELECT * FROM scheduled_posts WHERE 1=1";
    const params: unknown[] = [];
    if (filters?.campaignId) { sql += " AND campaign_id = ?"; params.push(filters.campaignId); }
    if (filters?.status) { sql += " AND status = ?"; params.push(filters.status); }
    sql += " ORDER BY scheduled_at ASC";
    return (db.prepare(sql).all(...params) as Row[]).map(rowToPost);
  }

  async get(scheduleId: string): Promise<ScheduledPost> {
    const db = getDb();
    const row = db.prepare("SELECT * FROM scheduled_posts WHERE id = ?").get(scheduleId) as Row | undefined;
    if (!row) throw new Error(`Scheduled post ${scheduleId} not found`);
    return rowToPost(row);
  }

  private setTimer(post: ScheduledPost): void {
    const delay = new Date(post.scheduledAt).getTime() - Date.now();
    if (delay <= 0) { this.publish(post.id); return; }
    this.timers.set(post.id, setTimeout(() => this.publish(post.id), delay));
  }

  private async publish(id: string): Promise<void> {
    const db = getDb();
    const row = db.prepare("SELECT * FROM scheduled_posts WHERE id = ? AND status = 'pending'").get(id) as Row | undefined;
    if (!row) return;
    const content = JSON.parse(row.content_json);
    const platforms = JSON.parse(row.platforms_json) as PlatformName[];
    const results = []; const errors: string[] = [];
    for (const p of platforms) {
      const prov = this.platformProviders.get(p);
      if (!prov) { errors.push(`No provider for ${p}`); continue; }
      try { results.push(await prov.post(content)); } catch (e) { errors.push(`${p}: ${e}`); }
    }
    const status = errors.length > 0 && results.length === 0 ? "failed" : "published";
    db.prepare("UPDATE scheduled_posts SET status = ?, results_json = ?, error = ? WHERE id = ?")
      .run(status, JSON.stringify(results), errors.length ? errors.join("; ") : null, id);
    this.timers.delete(id);
  }

  private resumePendingTimers(): void {
    try {
      const rows = getDb().prepare("SELECT * FROM scheduled_posts WHERE status = 'pending'").all() as Row[];
      for (const row of rows) this.setTimer(rowToPost(row));
    } catch { /* DB may not exist yet on first run */ }
  }
}

interface Row { id: string; content_json: string; platforms_json: string; scheduled_at: string; status: string; campaign_id: string | null; results_json: string | null; error: string | null; created_at: string; }

function rowToPost(r: Row): ScheduledPost {
  return { id: r.id, content: JSON.parse(r.content_json), platforms: JSON.parse(r.platforms_json), scheduledAt: r.scheduled_at, status: r.status as ScheduledPost["status"], campaignId: r.campaign_id ?? undefined, results: r.results_json ? JSON.parse(r.results_json) : undefined, error: r.error ?? undefined, createdAt: r.created_at };
}
