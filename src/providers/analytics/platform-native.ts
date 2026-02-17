// ---------------------------------------------------------------------------
// Analytics provider — delegates to each platform's native metrics endpoints
// ---------------------------------------------------------------------------

import type {
  AnalyticsProvider,
  AnalyticsSummary,
  AudienceInsights,
  PlatformName,
  PlatformProvider,
  PostMetrics,
} from "../../types.js";

export class PlatformNativeAnalyticsProvider implements AnalyticsProvider {
  readonly name = "platform-native";

  constructor(
    private platformProviders: Map<PlatformName, PlatformProvider>,
  ) {}

  async getPostMetrics(platform: PlatformName, postId: string): Promise<PostMetrics> {
    const provider = this.platformProviders.get(platform);
    if (!provider) {
      throw new Error(`No provider configured for platform: ${platform}`);
    }

    const post = await provider.getPost(postId);
    if (!post.metrics) {
      throw new Error(`Metrics not available for post ${postId} on ${platform}`);
    }
    return post.metrics;
  }

  async getSummary(
    platform: PlatformName,
    periodStart: string,
    periodEnd: string,
  ): Promise<AnalyticsSummary> {
    const provider = this.platformProviders.get(platform);
    if (!provider) {
      throw new Error(`No provider configured for platform: ${platform}`);
    }

    // Platform-native APIs generally don't have a single "summary" endpoint.
    // A real implementation would aggregate from the platform's reporting API.
    return {
      platform,
      periodStart,
      periodEnd,
      totalPosts: 0,
      totalImpressions: 0,
      totalEngagements: 0,
      engagementRate: 0,
      topPost: undefined,
    };
  }

  async getAudienceInsights(platform: PlatformName): Promise<AudienceInsights> {
    const provider = this.platformProviders.get(platform);
    if (!provider) {
      throw new Error(`No provider configured for platform: ${platform}`);
    }

    // Audience insights require platform-specific reporting APIs.
    // Twitter: GET /2/users/:id with user.fields=public_metrics
    // Facebook: GET /{page-id}/insights
    // LinkedIn: GET /organizationalEntityAcls + /followerStatistics
    // Bluesky: limited — followers list only
    // A full implementation would call those endpoints here.
    return {
      platform,
      followerCount: 0,
      followingCount: 0,
    };
  }
}
