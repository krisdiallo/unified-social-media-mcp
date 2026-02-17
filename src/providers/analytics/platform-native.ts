// ---------------------------------------------------------------------------
// Analytics provider — delegates to each platform's native metrics endpoints
//
// This is the "glue" provider that pulls metrics from whichever platform
// providers are configured. Swap this out for a third-party analytics tool
// (e.g. Sprout Social, Hootsuite Analytics) by implementing AnalyticsProvider.
// ---------------------------------------------------------------------------

import type {
  AnalyticsProvider,
  AnalyticsSummary,
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
    // Platform-native APIs generally don't have a single "summary" endpoint.
    // This is a placeholder that returns a structure the agent can work with.
    // A real implementation would aggregate from the platform's reporting API.
    const provider = this.platformProviders.get(platform);
    if (!provider) {
      throw new Error(`No provider configured for platform: ${platform}`);
    }

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
}
