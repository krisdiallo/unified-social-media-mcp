// ---------------------------------------------------------------------------
// Provider Registry — instantiates the right providers based on config
// ---------------------------------------------------------------------------

import type { ProviderRegistry, PlatformName, PlatformProvider } from "./types.js";
import type { ServerConfig } from "./config/index.js";

import { OpenAIContentProvider, OllamaContentProvider } from "./providers/content/index.js";
import { TwitterProvider } from "./providers/platforms/twitter/index.js";
import { BlueskyProvider } from "./providers/platforms/bluesky/index.js";
import { LinkedInProvider } from "./providers/platforms/linkedin/index.js";
import { FacebookProvider } from "./providers/platforms/facebook/index.js";
import { LocalSchedulingProvider } from "./providers/scheduling/index.js";
import { PlatformNativeAnalyticsProvider } from "./providers/analytics/index.js";
import { UnsplashMediaProvider } from "./providers/media/index.js";
import { PlatformEngagementProvider } from "./providers/engagement/index.js";
import { PlatformTrendsProvider } from "./providers/trends/index.js";
import { LocalCampaignProvider } from "./providers/campaigns/index.js";
import { LocalLinkProvider } from "./providers/links/index.js";
import { LocalWorkflowProvider } from "./providers/workflow/index.js";
import { LocalTemplateProvider } from "./providers/templates/index.js";
import { PlatformMonitoringProvider } from "./providers/monitoring/index.js";
import { LocalReportingProvider } from "./providers/reporting/index.js";
import { LocalProfileProvider } from "./providers/profile/index.js";
import { TokenBucketRateLimiter } from "./providers/rate-limiter/index.js";

export function buildRegistry(config: ServerConfig): ProviderRegistry {
  // -- Content generation ---------------------------------------------------
  const contentGeneration =
    config.contentProvider === "ollama"
      ? new OllamaContentProvider(config.ollamaBaseUrl, config.ollamaModel)
      : new OpenAIContentProvider(config.openaiApiKey ?? "", config.openaiModel);

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
  const scheduling = new LocalSchedulingProvider(platforms);

  // -- Analytics ------------------------------------------------------------
  const analytics = new PlatformNativeAnalyticsProvider(platforms);

  // -- Media ----------------------------------------------------------------
  const media = new UnsplashMediaProvider(config.unsplashAccessKey ?? "");

  // -- Engagement -----------------------------------------------------------
  const engagement = new PlatformEngagementProvider(platforms);

  // -- Trends ---------------------------------------------------------------
  const trends = new PlatformTrendsProvider();

  // -- Campaigns ------------------------------------------------------------
  const campaigns = new LocalCampaignProvider(scheduling);

  // -- Links ----------------------------------------------------------------
  const links = new LocalLinkProvider();

  // -- Workflow -------------------------------------------------------------
  const workflow = new LocalWorkflowProvider();

  // -- Templates ------------------------------------------------------------
  const templates = new LocalTemplateProvider();

  // -- Monitoring -----------------------------------------------------------
  const monitoring = new PlatformMonitoringProvider();

  // -- Reporting ------------------------------------------------------------
  const reporting = new LocalReportingProvider(analytics, campaigns);

  // -- Profile --------------------------------------------------------------
  const profile = new LocalProfileProvider([...platforms.keys()]);

  // -- Rate Limiter ---------------------------------------------------------
  const rateLimiter = new TokenBucketRateLimiter();

  return {
    contentGeneration,
    platforms,
    scheduling,
    analytics,
    media,
    engagement,
    trends,
    campaigns,
    links,
    workflow,
    templates,
    monitoring,
    reporting,
    profile,
    rateLimiter,
  };
}
