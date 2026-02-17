// ---------------------------------------------------------------------------
// Link management provider — local in-memory
//
// Handles UTM parameter building and tracks shortened links locally.
// For production, swap with Bitly, Short.io, Rebrandly, or Dub.
// ---------------------------------------------------------------------------

import type { LinkProvider, ShortenedLink, UTMParams } from "../../types.js";
import crypto from "node:crypto";

export class LocalLinkProvider implements LinkProvider {
  readonly name = "local";

  private links = new Map<string, ShortenedLink>();

  async shorten(url: string, customAlias?: string): Promise<ShortenedLink> {
    const id = customAlias ?? crypto.randomBytes(4).toString("hex");
    const link: ShortenedLink = {
      id,
      originalUrl: url,
      shortUrl: `https://link.local/${id}`,
      clicks: 0,
      createdAt: new Date().toISOString(),
    };
    this.links.set(id, link);
    return { ...link };
  }

  async addUTM(url: string, params: UTMParams): Promise<string> {
    const u = new URL(url);
    u.searchParams.set("utm_source", params.source);
    u.searchParams.set("utm_medium", params.medium);
    u.searchParams.set("utm_campaign", params.campaign);
    if (params.term) u.searchParams.set("utm_term", params.term);
    if (params.content) u.searchParams.set("utm_content", params.content);
    return u.toString();
  }

  async getLinkStats(linkId: string): Promise<ShortenedLink> {
    const link = this.links.get(linkId);
    if (!link) throw new Error(`Link ${linkId} not found`);
    return { ...link };
  }

  async listLinks(): Promise<ShortenedLink[]> {
    return [...this.links.values()];
  }
}
