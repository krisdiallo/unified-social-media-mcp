// ---------------------------------------------------------------------------
// Provider Registry — instantiates the right providers based on config
// ---------------------------------------------------------------------------

import type { ProviderRegistry, PlatformName, PlatformProvider } from "./types.js";
import type { ServerConfig } from "./config/index.js";

import { TwitterProvider } from "./providers/platforms/twitter/index.js";
import { BlueskyProvider } from "./providers/platforms/bluesky/index.js";
import { LinkedInProvider } from "./providers/platforms/linkedin/index.js";
import { FacebookProvider } from "./providers/platforms/facebook/index.js";
import { SqliteSchedulingProvider } from "./providers/scheduling/index.js";
import { SqliteAnalyticsProvider } from "./providers/analytics/index.js";
import { CloudinaryMediaProvider } from "./providers/media/index.js";
import { MultiSourceTrendsProvider } from "./providers/trends/index.js";
import { SqliteIdeasProvider } from "./providers/ideas/index.js";
import { SqliteCampaignProvider } from "./providers/campaigns/index.js";
import { DubLinkProvider } from "./providers/links/index.js";
import { SocialSearcherMonitoringProvider } from "./providers/monitoring/index.js";
import { SqliteBrandContextProvider } from "./providers/brand-context/index.js";
import { LocalProfileProvider } from "./providers/profile/index.js";
import { TokenBucketRateLimiter } from "./providers/rate-limiter/index.js";

export function buildRegistry(config: ServerConfig): ProviderRegistry {
  // -- Platform providers ---------------------------------------------------
  const platforms = new Map<PlatformName, PlatformProvider>();

  if (config.platforms.twitter) {
    const c = config.platforms.twitter;
    if (c.apiKey && c.apiSecret && c.accessToken && c.accessTokenSecret) {
      platforms.set(
        "twitter",
        new TwitterProvider({
          apiKey: c.apiKey,
          apiSecret: c.apiSecret,
          accessToken: c.accessToken,
          accessTokenSecret: c.accessTokenSecret,
        }),
      );
    }
  }

  if (config.platforms.bluesky) {
    const c = config.platforms.bluesky;
    if (c.identifier && c.password) {
      platforms.set(
        "bluesky",
        new BlueskyProvider({ identifier: c.identifier, password: c.password }),
      );
    }
  }

  if (config.platforms.linkedin) {
    const c = config.platforms.linkedin;
    if (c.linkedinAccessToken) {
      platforms.set(
        "linkedin",
        new LinkedInProvider({ accessToken: c.linkedinAccessToken }),
      );
    }
  }

  if (config.platforms.facebook) {
    const c = config.platforms.facebook;
    if (c.facebookPageToken && c.facebookPageId) {
      platforms.set(
        "facebook",
        new FacebookProvider({
          pageToken: c.facebookPageToken,
          pageId: c.facebookPageId,
        }),
      );
    }
  }

  // -- Scheduling -----------------------------------------------------------
  const scheduling = new SqliteSchedulingProvider(platforms);

  // -- Analytics ------------------------------------------------------------
  const analytics = new SqliteAnalyticsProvider(platforms);

  // -- Media ----------------------------------------------------------------
  const media = new CloudinaryMediaProvider(
    config.cloudinaryCloudName ?? "",
    config.cloudinaryApiKey ?? "",
    config.cloudinaryApiSecret ?? "",
  );

  // -- Trends ---------------------------------------------------------------
  const trends = new MultiSourceTrendsProvider();

  // -- Ideas ----------------------------------------------------------------
  const ideas = new SqliteIdeasProvider();

  // -- Campaigns ------------------------------------------------------------
  const campaigns = new SqliteCampaignProvider();

  // -- Links ----------------------------------------------------------------
  const links = new DubLinkProvider(config.dubApiKey ?? "");

  // -- Monitoring -----------------------------------------------------------
  const monitoring = new SocialSearcherMonitoringProvider(config.socialSearcherApiKey);

  // -- Brand Context --------------------------------------------------------
  const brandContext = new SqliteBrandContextProvider();

  // -- Profile --------------------------------------------------------------
  const profile = new LocalProfileProvider([...platforms.keys()]);

  // -- Rate Limiter ---------------------------------------------------------
  const rateLimiter = new TokenBucketRateLimiter();

  return {
    platforms,
    scheduling,
    analytics,
    media,
    trends,
    ideas,
    campaigns,
    links,
    monitoring,
    brandContext,
    profile,
    rateLimiter,
  };
}
