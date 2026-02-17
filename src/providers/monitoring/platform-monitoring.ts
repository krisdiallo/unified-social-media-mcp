// ---------------------------------------------------------------------------
// Brand monitoring / competitor analysis provider
//
// Delegates to platform search APIs for mention tracking and basic
// sentiment classification. For production, swap with Brandwatch,
// Mention, Brand24, or Sprout Social's listening tools.
// ---------------------------------------------------------------------------

import type {
  MonitoringProvider,
  BrandMention,
  CompetitorProfile,
  PlatformName,
  PostMetrics,
} from "../../types.js";

export class PlatformMonitoringProvider implements MonitoringProvider {
  readonly name = "platform-native";

  async searchMentions(
    platform: PlatformName,
    query: string,
    since?: string,
  ): Promise<BrandMention[]> {
    // Twitter: GET /2/tweets/search/recent?query={query}
    // Bluesky: app.bsky.feed.searchPosts
    // LinkedIn: limited search API
    // Facebook: GET /{page-id}/tagged + /feed with keyword filter
    void since;
    void query;
    return [
      {
        id: "placeholder",
        platform,
        authorHandle: "unknown",
        text: `[Configure ${platform} credentials to search mentions for "${query}"]`,
        sentiment: "neutral",
        url: "",
        createdAt: new Date().toISOString(),
      },
    ];
  }

  async analyzeSentiment(
    platform: PlatformName,
    query: string,
    since?: string,
  ): Promise<{
    positive: number;
    neutral: number;
    negative: number;
    total: number;
    mentions: BrandMention[];
  }> {
    const mentions = await this.searchMentions(platform, query, since);

    // Basic keyword-based sentiment (real implementation would use NLP/AI)
    let positive = 0;
    let neutral = 0;
    let negative = 0;

    const positiveWords = ["love", "great", "amazing", "awesome", "excellent", "best", "fantastic"];
    const negativeWords = ["hate", "terrible", "awful", "worst", "bad", "horrible", "disappointed"];

    for (const mention of mentions) {
      const lower = mention.text.toLowerCase();
      const hasPositive = positiveWords.some((w) => lower.includes(w));
      const hasNegative = negativeWords.some((w) => lower.includes(w));

      if (hasPositive && !hasNegative) {
        mention.sentiment = "positive";
        positive++;
      } else if (hasNegative && !hasPositive) {
        mention.sentiment = "negative";
        negative++;
      } else {
        mention.sentiment = "neutral";
        neutral++;
      }
    }

    return { positive, neutral, negative, total: mentions.length, mentions };
  }

  async getCompetitorProfile(
    platform: PlatformName,
    handle: string,
  ): Promise<CompetitorProfile> {
    // Twitter: GET /2/users/by/username/{handle}?user.fields=public_metrics
    // Bluesky: app.bsky.actor.getProfile
    // LinkedIn: limited public profile API
    // Facebook: GET /{page-id}?fields=fan_count
    return {
      handle,
      platform,
      followerCount: 0,
      recentPosts: [],
    };
  }
}
