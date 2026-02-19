// ---------------------------------------------------------------------------
// Monitoring provider — Social Searcher API integration
// (https://api.social-searcher.com/v2 — free tier available)
// ---------------------------------------------------------------------------

import type {
  MonitoringProvider,
  BrandMention,
  CompetitorProfile,
  PlatformName,
} from "../../types.js";

const SOCIAL_SEARCHER_API = "https://api.social-searcher.com/v2";

export class SocialSearcherMonitoringProvider implements MonitoringProvider {
  readonly name = "social-searcher";
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async searchMentions(
    query: string,
    platform?: PlatformName,
    since?: string,
  ): Promise<BrandMention[]> {
    const url = new URL(`${SOCIAL_SEARCHER_API}/search`);
    url.searchParams.set("q", query);

    if (platform) {
      url.searchParams.set("network", platformToNetwork(platform));
    }

    if (since) {
      url.searchParams.set("date_from", since);
    }

    if (this.apiKey) {
      url.searchParams.set("key", this.apiKey);
    }

    const res = await fetch(url.toString());

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Social Searcher API error (${res.status}): ${errBody}`);
    }

    const data = await res.json() as {
      posts: Array<{
        postid: string;
        network: string;
        user: { userid: string; name: string };
        text: string;
        sentiment: string;
        url: string;
        posted: string;
      }>;
    };

    if (!data.posts) return [];

    return data.posts.map((post): BrandMention => ({
      id: post.postid,
      platform: networkToPlatform(post.network),
      authorHandle: post.user?.name ?? "unknown",
      text: post.text,
      sentiment: normalizeSentiment(post.sentiment),
      url: post.url,
      createdAt: post.posted,
    }));
  }

  async analyzeSentiment(
    query: string,
    platform?: PlatformName,
    since?: string,
  ): Promise<{
    positive: number;
    neutral: number;
    negative: number;
    total: number;
    mentions: BrandMention[];
  }> {
    const mentions = await this.searchMentions(query, platform, since);

    let positive = 0;
    let neutral = 0;
    let negative = 0;

    for (const mention of mentions) {
      switch (mention.sentiment) {
        case "positive":
          positive++;
          break;
        case "negative":
          negative++;
          break;
        default:
          neutral++;
          break;
      }
    }

    return {
      positive,
      neutral,
      negative,
      total: mentions.length,
      mentions,
    };
  }

  async getCompetitorProfile(
    platform: PlatformName,
    handle: string,
  ): Promise<CompetitorProfile> {
    // Competitor profile analysis requires platform-specific API access
    // (e.g., Twitter API v2 user lookup, LinkedIn company API, etc.)
    // Return a placeholder with a note about the limitation.
    return {
      handle,
      platform,
      followerCount: 0,
      postFrequency: "unknown — requires platform-specific API access",
      engagementRate: undefined,
      recentPosts: [],
    };
  }
}

/** Map our PlatformName to Social Searcher network identifiers */
function platformToNetwork(platform: PlatformName): string {
  switch (platform) {
    case "twitter":
      return "twitter";
    case "facebook":
      return "facebook";
    case "linkedin":
      return "linkedin";
    case "bluesky":
      return "bluesky";
    default:
      return platform;
  }
}

/** Map Social Searcher network identifiers back to PlatformName (best effort) */
function networkToPlatform(network: string): string {
  switch (network?.toLowerCase()) {
    case "twitter":
      return "twitter";
    case "facebook":
      return "facebook";
    case "linkedin":
      return "linkedin";
    case "bluesky":
      return "bluesky";
    default:
      return network ?? "unknown";
  }
}

/** Normalize sentiment values from Social Searcher to our enum */
function normalizeSentiment(sentiment: string): "positive" | "neutral" | "negative" {
  switch (sentiment?.toLowerCase()) {
    case "positive":
    case "pos":
      return "positive";
    case "negative":
    case "neg":
      return "negative";
    default:
      return "neutral";
  }
}
