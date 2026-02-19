// ---------------------------------------------------------------------------
// Campaign provider — CRUD on campaigns table, unified calendar view
// ---------------------------------------------------------------------------

import type {
  CampaignProvider,
  Campaign,
  CalendarEntry,
  PlatformName,
} from "../../types.js";
import { getDb } from "../../db.js";
import crypto from "node:crypto";

interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  platforms_json: string;
  status: string;
  tags_json: string | null;
  created_at: string;
}

export class SqliteCampaignProvider implements CampaignProvider {
  readonly name = "sqlite";

  async create(campaign: Omit<Campaign, "id" | "createdAt">): Promise<Campaign> {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO campaigns (id, name, description, start_date, end_date, platforms_json, status, tags_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      campaign.name,
      campaign.description ?? null,
      campaign.startDate,
      campaign.endDate,
      JSON.stringify(campaign.platforms),
      campaign.status,
      campaign.tags ? JSON.stringify(campaign.tags) : null,
      now,
    );

    return {
      id,
      name: campaign.name,
      description: campaign.description,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      platforms: campaign.platforms,
      status: campaign.status,
      tags: campaign.tags,
      createdAt: now,
    };
  }

  async get(campaignId: string): Promise<Campaign> {
    const db = getDb();
    const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as CampaignRow | undefined;
    if (!row) throw new Error(`Campaign ${campaignId} not found`);
    return rowToCampaign(row);
  }

  async update(
    campaignId: string,
    updates: Partial<Pick<Campaign, "name" | "description" | "status" | "endDate" | "tags">>,
  ): Promise<Campaign> {
    const db = getDb();
    const existing = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as CampaignRow | undefined;
    if (!existing) throw new Error(`Campaign ${campaignId} not found`);

    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      sets.push("name = ?");
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      sets.push("description = ?");
      params.push(updates.description);
    }
    if (updates.status !== undefined) {
      sets.push("status = ?");
      params.push(updates.status);
    }
    if (updates.endDate !== undefined) {
      sets.push("end_date = ?");
      params.push(updates.endDate);
    }
    if (updates.tags !== undefined) {
      sets.push("tags_json = ?");
      params.push(JSON.stringify(updates.tags));
    }

    if (sets.length === 0) return rowToCampaign(existing);

    params.push(campaignId);
    db.prepare(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = ?`).run(...params);

    return this.get(campaignId);
  }

  async delete(campaignId: string): Promise<void> {
    const db = getDb();
    const result = db.prepare("DELETE FROM campaigns WHERE id = ?").run(campaignId);
    if (result.changes === 0) throw new Error(`Campaign ${campaignId} not found`);
  }

  async list(filters?: { status?: string }): Promise<Campaign[]> {
    const db = getDb();
    let sql = "SELECT * FROM campaigns WHERE 1=1";
    const params: unknown[] = [];

    if (filters?.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }

    sql += " ORDER BY start_date ASC";

    return (db.prepare(sql).all(...params) as CampaignRow[]).map(rowToCampaign);
  }

  async getCalendar(
    startDate: string,
    endDate: string,
    platform?: PlatformName,
  ): Promise<CalendarEntry[]> {
    const db = getDb();
    const entries: CalendarEntry[] = [];

    // Gather ideas that fall within the date range (using scheduled_at or created_at)
    {
      let sql = `
        SELECT * FROM ideas
        WHERE (
          (scheduled_at IS NOT NULL AND scheduled_at >= ? AND scheduled_at <= ?)
          OR (scheduled_at IS NULL AND created_at >= ? AND created_at <= ?)
        )
      `;
      const params: unknown[] = [startDate, endDate, startDate, endDate];

      const rows = db.prepare(sql).all(...params) as Array<{
        id: string;
        content: string;
        platforms_json: string;
        status: string;
        campaign_id: string | null;
        scheduled_at: string | null;
        created_at: string;
      }>;

      for (const row of rows) {
        const platforms = JSON.parse(row.platforms_json) as PlatformName[];
        const relevantPlatforms = platform ? platforms.filter((p) => p === platform) : platforms;

        for (const p of relevantPlatforms) {
          entries.push({
            id: row.id,
            type: "idea",
            date: row.scheduled_at ?? row.created_at,
            platform: p,
            content: row.content,
            status: row.status,
            campaignId: row.campaign_id ?? undefined,
          });
        }
      }
    }

    // Gather scheduled posts within the date range
    {
      let sql = `
        SELECT * FROM scheduled_posts
        WHERE scheduled_at >= ? AND scheduled_at <= ?
      `;
      const params: unknown[] = [startDate, endDate];

      const rows = db.prepare(sql).all(...params) as Array<{
        id: string;
        content_json: string;
        platforms_json: string;
        scheduled_at: string;
        status: string;
        campaign_id: string | null;
      }>;

      for (const row of rows) {
        const platforms = JSON.parse(row.platforms_json) as PlatformName[];
        const content = JSON.parse(row.content_json) as { text: string };
        const relevantPlatforms = platform ? platforms.filter((p) => p === platform) : platforms;
        const type = row.status === "published" ? "published" as const : "scheduled" as const;

        for (const p of relevantPlatforms) {
          entries.push({
            id: row.id,
            type,
            date: row.scheduled_at,
            platform: p,
            content: content.text,
            status: row.status,
            campaignId: row.campaign_id ?? undefined,
          });
        }
      }
    }

    // Sort all entries by date
    entries.sort((a, b) => a.date.localeCompare(b.date));
    return entries;
  }
}

function rowToCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    platforms: JSON.parse(row.platforms_json) as PlatformName[],
    status: row.status as Campaign["status"],
    tags: row.tags_json ? JSON.parse(row.tags_json) : undefined,
    createdAt: row.created_at,
  };
}
