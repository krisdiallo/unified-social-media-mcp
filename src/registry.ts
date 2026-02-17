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

  return { contentGeneration, platforms, scheduling, analytics, media };
}
