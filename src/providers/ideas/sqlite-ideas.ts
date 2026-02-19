// ---------------------------------------------------------------------------
// Ideas pipeline provider — full CRUD with status advancement validation
// ---------------------------------------------------------------------------

import type {
  IdeasProvider,
  Idea,
  IdeaStatus,
  PlatformName,
} from "../../types.js";
import { getDb } from "../../db.js";
import crypto from "node:crypto";

/** Valid transitions: current status -> allowed target statuses */
const VALID_TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  idea: ["draft"],
  draft: ["pending_review"],
  pending_review: ["approved", "rejected"],
  approved: ["scheduled"],
  rejected: [], // terminal
  scheduled: ["published"],
  published: [], // terminal
};

interface IdeaRow {
  id: string;
  content: string;
  platforms_json: string;
  status: string;
  media_urls_json: string | null;
  campaign_id: string | null;
  scheduled_at: string | null;
  tags_json: string | null;
  notes: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteIdeasProvider implements IdeasProvider {
  readonly name = "sqlite";

  async create(
    idea: Omit<Idea, "id" | "status" | "createdAt" | "updatedAt">,
  ): Promise<Idea> {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO ideas (id, content, platforms_json, status, media_urls_json, campaign_id, scheduled_at, tags_json, notes, created_by, reviewed_by, created_at, updated_at)
      VALUES (?, ?, ?, 'idea', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      idea.content,
      JSON.stringify(idea.platforms),
      idea.mediaUrls ? JSON.stringify(idea.mediaUrls) : null,
      idea.campaignId ?? null,
      idea.scheduledAt ?? null,
      idea.tags ? JSON.stringify(idea.tags) : null,
      idea.notes ?? null,
      idea.createdBy ?? null,
      idea.reviewedBy ?? null,
      now,
      now,
    );

    return {
      id,
      content: idea.content,
      platforms: idea.platforms,
      status: "idea",
      mediaUrls: idea.mediaUrls,
      campaignId: idea.campaignId,
      scheduledAt: idea.scheduledAt,
      tags: idea.tags,
      notes: idea.notes,
      createdBy: idea.createdBy,
      reviewedBy: idea.reviewedBy,
      createdAt: now,
      updatedAt: now,
    };
  }

  async get(ideaId: string): Promise<Idea> {
    const db = getDb();
    const row = db.prepare("SELECT * FROM ideas WHERE id = ?").get(ideaId) as IdeaRow | undefined;
    if (!row) throw new Error(`Idea ${ideaId} not found`);
    return rowToIdea(row);
  }

  async update(
    ideaId: string,
    updates: Partial<Pick<Idea, "content" | "platforms" | "mediaUrls" | "campaignId" | "scheduledAt" | "tags" | "notes">>,
  ): Promise<Idea> {
    const db = getDb();
    const existing = db.prepare("SELECT * FROM ideas WHERE id = ?").get(ideaId) as IdeaRow | undefined;
    if (!existing) throw new Error(`Idea ${ideaId} not found`);

    const now = new Date().toISOString();
    const sets: string[] = ["updated_at = ?"];
    const params: unknown[] = [now];

    if (updates.content !== undefined) {
      sets.push("content = ?");
      params.push(updates.content);
    }
    if (updates.platforms !== undefined) {
      sets.push("platforms_json = ?");
      params.push(JSON.stringify(updates.platforms));
    }
    if (updates.mediaUrls !== undefined) {
      sets.push("media_urls_json = ?");
      params.push(JSON.stringify(updates.mediaUrls));
    }
    if (updates.campaignId !== undefined) {
      sets.push("campaign_id = ?");
      params.push(updates.campaignId);
    }
    if (updates.scheduledAt !== undefined) {
      sets.push("scheduled_at = ?");
      params.push(updates.scheduledAt);
    }
    if (updates.tags !== undefined) {
      sets.push("tags_json = ?");
      params.push(JSON.stringify(updates.tags));
    }
    if (updates.notes !== undefined) {
      sets.push("notes = ?");
      params.push(updates.notes);
    }

    params.push(ideaId);
    db.prepare(`UPDATE ideas SET ${sets.join(", ")} WHERE id = ?`).run(...params);

    return this.get(ideaId);
  }

  async delete(ideaId: string): Promise<void> {
    const db = getDb();
    const result = db.prepare("DELETE FROM ideas WHERE id = ?").run(ideaId);
    if (result.changes === 0) throw new Error(`Idea ${ideaId} not found`);
  }

  async list(
    filters?: { status?: IdeaStatus; campaignId?: string; tags?: string[] },
  ): Promise<Idea[]> {
    const db = getDb();
    let sql = "SELECT * FROM ideas WHERE 1=1";
    const params: unknown[] = [];

    if (filters?.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }
    if (filters?.campaignId) {
      sql += " AND campaign_id = ?";
      params.push(filters.campaignId);
    }

    sql += " ORDER BY updated_at DESC";

    let ideas = (db.prepare(sql).all(...params) as IdeaRow[]).map(rowToIdea);

    // Filter by tags in application layer (JSON array stored as text)
    if (filters?.tags && filters.tags.length > 0) {
      ideas = ideas.filter((idea) => {
        if (!idea.tags) return false;
        return filters.tags!.some((tag) => idea.tags!.includes(tag));
      });
    }

    return ideas;
  }

  async advance(ideaId: string, targetStatus: IdeaStatus, notes?: string): Promise<Idea> {
    const db = getDb();
    const row = db.prepare("SELECT * FROM ideas WHERE id = ?").get(ideaId) as IdeaRow | undefined;
    if (!row) throw new Error(`Idea ${ideaId} not found`);

    const currentStatus = row.status as IdeaStatus;
    const allowed = VALID_TRANSITIONS[currentStatus];

    if (!allowed || !allowed.includes(targetStatus)) {
      throw new Error(
        `Invalid status transition: ${currentStatus} -> ${targetStatus}. ` +
        `Allowed transitions from ${currentStatus}: ${allowed?.join(", ") || "none (terminal state)"}`,
      );
    }

    const now = new Date().toISOString();
    const sets = ["status = ?", "updated_at = ?"];
    const params: unknown[] = [targetStatus, now];

    if (notes !== undefined) {
      sets.push("notes = ?");
      params.push(notes);
    }

    // Track reviewer for review-related transitions
    if (targetStatus === "approved" || targetStatus === "rejected") {
      sets.push("reviewed_by = ?");
      params.push("system"); // In production, this would be the authenticated user
    }

    params.push(ideaId);
    db.prepare(`UPDATE ideas SET ${sets.join(", ")} WHERE id = ?`).run(...params);

    return this.get(ideaId);
  }
}

function rowToIdea(row: IdeaRow): Idea {
  return {
    id: row.id,
    content: row.content,
    platforms: JSON.parse(row.platforms_json) as PlatformName[],
    status: row.status as IdeaStatus,
    mediaUrls: row.media_urls_json ? JSON.parse(row.media_urls_json) : undefined,
    campaignId: row.campaign_id ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    tags: row.tags_json ? JSON.parse(row.tags_json) : undefined,
    notes: row.notes ?? undefined,
    createdBy: row.created_by ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
