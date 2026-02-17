// ---------------------------------------------------------------------------
// Trends provider — hashtag research and trending topics
// ---------------------------------------------------------------------------

import type {
  TrendsProvider,
  TrendingTopic,
  HashtagInfo,
  PlatformName,
} from "../../types.js";

/**
 * Platform-native trends provider.
 *
 * Twitter: GET /2/trends/place, GET /2/tweets/search/recent
 * Bluesky: app.bsky.unspecced.getPopularFeedGenerators (limited)
 * LinkedIn: no public trends API — would scrape trending articles
 * Facebook: no public trends API
 *
 * For a richer implementation, swap with a service like BuzzSumo, Brandwatch,
 * or a custom scraping/aggregation layer.
 */
export class PlatformTrendsProvider implements TrendsProvider {
  readonly name = "platform-native";

  async getTrending(platform: PlatformName, region?: string): Promise<TrendingTopic[]> {
    // Twitter has the strongest trends API.
    // Other platforms would require third-party data sources.
    void region;
    return [
      {
        name: `[${platform} trends require API credentials to be configured]`,
        platform,
      },
    ];
  }

  async lookupHashtag(platform: PlatformName, tag: string): Promise<HashtagInfo> {
    // Twitter: GET /2/tweets/search/recent?query=%23{tag}
    // Bluesky: app.bsky.feed.searchPosts
    // LinkedIn/Facebook: limited hashtag APIs
    return {
      tag,
      postCount: 0,
      relatedTags: [],
    };
  }

  async suggestHashtags(platform: PlatformName, text: string): Promise<string[]> {
    // Simple keyword extraction — a real implementation could use NLP or
    // call a trends API to find related popular hashtags.
    void platform;
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 4);

    // Deduplicate and take top 5
    return [...new Set(words)].slice(0, 5);
  }
}
