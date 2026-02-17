// ---------------------------------------------------------------------------
// Configuration — reads from env vars so providers can be swapped via config.
// ---------------------------------------------------------------------------

import type { PlatformName } from "../types.js";

export interface ServerConfig {
  // Content generation
  contentProvider: "openai" | "ollama";
  openaiApiKey?: string;
  openaiModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;

  // Platform credentials
  platforms: Partial<Record<PlatformName, PlatformCredentials>>;

  // Scheduling
  schedulingProvider: "local";

  // Analytics
  analyticsProvider: "platform-native";

  // Media
  mediaProvider: "unsplash";
  unsplashAccessKey?: string;
}

export interface PlatformCredentials {
  /** Twitter / X */
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  /** Bluesky */
  identifier?: string;
  password?: string;
  /** LinkedIn */
  linkedinAccessToken?: string;
  /** Facebook / Meta */
  facebookPageToken?: string;
  facebookPageId?: string;
}

export function loadConfig(): ServerConfig {
  const env = process.env;

  const enabledPlatforms = (env.ENABLED_PLATFORMS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as PlatformName[];

  const platforms: Partial<Record<PlatformName, PlatformCredentials>> = {};

  for (const p of enabledPlatforms) {
    switch (p) {
      case "twitter":
        platforms.twitter = {
          apiKey: env.TWITTER_API_KEY,
          apiSecret: env.TWITTER_API_SECRET,
          accessToken: env.TWITTER_ACCESS_TOKEN,
          accessTokenSecret: env.TWITTER_ACCESS_TOKEN_SECRET,
        };
        break;
      case "bluesky":
        platforms.bluesky = {
          identifier: env.BLUESKY_IDENTIFIER,
          password: env.BLUESKY_PASSWORD,
        };
        break;
      case "linkedin":
        platforms.linkedin = {
          linkedinAccessToken: env.LINKEDIN_ACCESS_TOKEN,
        };
        break;
      case "facebook":
        platforms.facebook = {
          facebookPageToken: env.FACEBOOK_PAGE_TOKEN,
          facebookPageId: env.FACEBOOK_PAGE_ID,
        };
        break;
    }
  }

  return {
    contentProvider: (env.CONTENT_PROVIDER as "openai" | "ollama") ?? "openai",
    openaiApiKey: env.OPENAI_API_KEY,
    openaiModel: env.OPENAI_MODEL ?? "gpt-4o-mini",
    ollamaBaseUrl: env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    ollamaModel: env.OLLAMA_MODEL ?? "llama3",

    platforms,

    schedulingProvider: "local",
    analyticsProvider: "platform-native",

    mediaProvider: "unsplash",
    unsplashAccessKey: env.UNSPLASH_ACCESS_KEY,
  };
}
