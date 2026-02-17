// ---------------------------------------------------------------------------
// Campaign & content calendar provider — local in-memory
// ---------------------------------------------------------------------------

import type {
  CampaignProvider,
  Campaign,
  CalendarEntry,
  PlatformName,
  SchedulingProvider,
} from "../../types.js";
import crypto from "node:crypto";

/**
 * In-memory campaign manager. Tracks campaigns and builds a calendar view
 * by combining campaign data with the scheduling provider's post list.
 *
 * For production, swap with a database-backed implementation or integrate
 * with tools like Notion, Airtable, or a dedicated social media planner.
 */
export class LocalCampaignProvider implements CampaignProvider {
  readonly name = "local";

  private campaigns = new Map<string, Campaign>();

  constructor(private scheduling: SchedulingProvider) {}

  async createCampaign(input: Omit<Campaign, "id" | "postIds">): Promise<Campaign> {
    const campaign: Campaign = {
      ...input,
      id: crypto.randomUUID(),
      postIds: [],
    };
    this.campaigns.set(campaign.id, campaign);
    return { ...campaign };
  }

  async getCampaign(campaignId: string): Promise<Campaign> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
    return { ...campaign };
  }

  async updateCampaign(
    campaignId: string,
    updates: Partial<Pick<Campaign, "name" | "description" | "status" | "endDate" | "tags">>,
  ): Promise<Campaign> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    if (updates.name !== undefined) campaign.name = updates.name;
    if (updates.description !== undefined) campaign.description = updates.description;
    if (updates.status !== undefined) campaign.status = updates.status;
    if (updates.endDate !== undefined) campaign.endDate = updates.endDate;
    if (updates.tags !== undefined) campaign.tags = updates.tags;

    return { ...campaign };
  }

  async deleteCampaign(campaignId: string): Promise<void> {
    if (!this.campaigns.has(campaignId)) {
      throw new Error(`Campaign ${campaignId} not found`);
    }
    this.campaigns.delete(campaignId);
  }

  async listCampaigns(filters?: { status?: string }): Promise<Campaign[]> {
    let campaigns = [...this.campaigns.values()];
    if (filters?.status) {
      campaigns = campaigns.filter((c) => c.status === filters.status);
    }
    return campaigns;
  }

  async getCalendar(
    startDate: string,
    endDate: string,
    platform?: PlatformName,
  ): Promise<CalendarEntry[]> {
    const scheduled = await this.scheduling.list();
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    const entries: CalendarEntry[] = [];

    for (const post of scheduled) {
      const postTime = new Date(post.scheduledAt).getTime();
      if (postTime < start || postTime > end) continue;

      for (const plat of post.platforms) {
        if (platform && plat !== platform) continue;
        entries.push({
          id: post.id,
          scheduledAt: post.scheduledAt,
          platform: plat,
          content: post.content,
          status: post.status === "pending" ? "scheduled" : post.status === "published" ? "published" : "failed",
          campaignId: post.campaignId,
        });
      }
    }

    return entries.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }
}
