// ---------------------------------------------------------------------------
// Link management provider — Dub.co API integration
// ---------------------------------------------------------------------------

import type {
  LinkProvider,
  ShortenedLink,
  UTMParams,
} from "../../types.js";

const DUB_API_BASE = "https://api.dub.co";

export class DubLinkProvider implements LinkProvider {
  readonly name = "dub";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async shorten(url: string, customAlias?: string): Promise<ShortenedLink> {
    const body: Record<string, unknown> = { url };
    if (customAlias) body.key = customAlias;

    const res = await fetch(`${DUB_API_BASE}/links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Dub API error (${res.status}): ${errBody}`);
    }

    const data = await res.json() as {
      id: string;
      url: string;
      shortLink: string;
      clicks: number;
      createdAt: string;
    };

    return {
      id: data.id,
      originalUrl: data.url,
      shortUrl: data.shortLink,
      clicks: data.clicks ?? 0,
      createdAt: data.createdAt,
    };
  }

  async addUTM(url: string, params: UTMParams): Promise<string> {
    const parsed = new URL(url);
    parsed.searchParams.set("utm_source", params.source);
    parsed.searchParams.set("utm_medium", params.medium);
    parsed.searchParams.set("utm_campaign", params.campaign);
    if (params.term) parsed.searchParams.set("utm_term", params.term);
    if (params.content) parsed.searchParams.set("utm_content", params.content);
    return parsed.toString();
  }

  async getLinkStats(linkId: string): Promise<ShortenedLink> {
    const res = await fetch(`${DUB_API_BASE}/links/${linkId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Dub API error (${res.status}): ${errBody}`);
    }

    const data = await res.json() as {
      id: string;
      url: string;
      shortLink: string;
      clicks: number;
      createdAt: string;
    };

    return {
      id: data.id,
      originalUrl: data.url,
      shortUrl: data.shortLink,
      clicks: data.clicks ?? 0,
      createdAt: data.createdAt,
    };
  }

  async listLinks(): Promise<ShortenedLink[]> {
    const res = await fetch(`${DUB_API_BASE}/links`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Dub API error (${res.status}): ${errBody}`);
    }

    const data = await res.json() as Array<{
      id: string;
      url: string;
      shortLink: string;
      clicks: number;
      createdAt: string;
    }>;

    return data.map((item) => ({
      id: item.id,
      originalUrl: item.url,
      shortUrl: item.shortLink,
      clicks: item.clicks ?? 0,
      createdAt: item.createdAt,
    }));
  }
}
