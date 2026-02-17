// ---------------------------------------------------------------------------
// Approval / Draft Workflow provider — local in-memory
//
// Implements a draft → review → approve/reject → publish pipeline.
// For production, swap with a tool like Planable, Sprout Social, or a
// custom database-backed approval system.
// ---------------------------------------------------------------------------

import type { WorkflowProvider, Draft, DraftStatus } from "../../types.js";
import crypto from "node:crypto";

export class LocalWorkflowProvider implements WorkflowProvider {
  readonly name = "local";

  private drafts = new Map<string, Draft>();

  async createDraft(input: Omit<Draft, "id" | "status" | "createdAt" | "updatedAt">): Promise<Draft> {
    const now = new Date().toISOString();
    const draft: Draft = {
      ...input,
      id: crypto.randomUUID(),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    this.drafts.set(draft.id, draft);
    return { ...draft };
  }

  async getDraft(draftId: string): Promise<Draft> {
    const draft = this.drafts.get(draftId);
    if (!draft) throw new Error(`Draft ${draftId} not found`);
    return { ...draft };
  }

  async updateDraft(
    draftId: string,
    updates: Partial<Pick<Draft, "content" | "platforms" | "scheduledAt" | "campaignId">>,
  ): Promise<Draft> {
    const draft = this.drafts.get(draftId);
    if (!draft) throw new Error(`Draft ${draftId} not found`);
    if (draft.status !== "draft" && draft.status !== "rejected") {
      throw new Error(`Cannot edit draft with status "${draft.status}". Only drafts and rejected items can be edited.`);
    }

    if (updates.content !== undefined) draft.content = updates.content;
    if (updates.platforms !== undefined) draft.platforms = updates.platforms;
    if (updates.scheduledAt !== undefined) draft.scheduledAt = updates.scheduledAt;
    if (updates.campaignId !== undefined) draft.campaignId = updates.campaignId;
    draft.updatedAt = new Date().toISOString();

    // Reset rejected drafts back to draft status on edit
    if (draft.status === "rejected") {
      draft.status = "draft";
      draft.reviewNotes = undefined;
    }

    return { ...draft };
  }

  async submitForReview(draftId: string): Promise<Draft> {
    const draft = this.drafts.get(draftId);
    if (!draft) throw new Error(`Draft ${draftId} not found`);
    if (draft.status !== "draft") {
      throw new Error(`Can only submit drafts for review, current status: ${draft.status}`);
    }

    draft.status = "pending_review";
    draft.updatedAt = new Date().toISOString();
    return { ...draft };
  }

  async approve(draftId: string, notes?: string): Promise<Draft> {
    const draft = this.drafts.get(draftId);
    if (!draft) throw new Error(`Draft ${draftId} not found`);
    if (draft.status !== "pending_review") {
      throw new Error(`Can only approve drafts pending review, current status: ${draft.status}`);
    }

    draft.status = "approved";
    draft.reviewNotes = notes;
    draft.updatedAt = new Date().toISOString();
    return { ...draft };
  }

  async reject(draftId: string, notes: string): Promise<Draft> {
    const draft = this.drafts.get(draftId);
    if (!draft) throw new Error(`Draft ${draftId} not found`);
    if (draft.status !== "pending_review") {
      throw new Error(`Can only reject drafts pending review, current status: ${draft.status}`);
    }

    draft.status = "rejected";
    draft.reviewNotes = notes;
    draft.updatedAt = new Date().toISOString();
    return { ...draft };
  }

  async listDrafts(filters?: { status?: DraftStatus; campaignId?: string }): Promise<Draft[]> {
    let drafts = [...this.drafts.values()];
    if (filters?.status) {
      drafts = drafts.filter((d) => d.status === filters.status);
    }
    if (filters?.campaignId) {
      drafts = drafts.filter((d) => d.campaignId === filters.campaignId);
    }
    return drafts;
  }

  async deleteDraft(draftId: string): Promise<void> {
    if (!this.drafts.has(draftId)) throw new Error(`Draft ${draftId} not found`);
    this.drafts.delete(draftId);
  }
}
