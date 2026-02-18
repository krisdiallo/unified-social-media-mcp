// ---------------------------------------------------------------------------
// Configuration — reads from env vars so providers can be swapped via config.
// ---------------------------------------------------------------------------

import type { PlatformName } from "../types.js";

export interface ServerConfig {
  // Platform credentials
  platforms: Partial<Record<PlatformName, PlatformCredentials>>;

  // Cloudinary (media management)
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;

  // Unsplash (stock image search)
  unsplashAccessKey?: string;

  // Dub.co (link management)
  dubApiKey?: string;

  // Social Searcher (brand monitoring)
  socialSearcherApiKey?: string;

  // SQLite DB path override (default: ~/.social-mcp/data.db)
  dbPath?: string;
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
    platforms,

    cloudinaryCloudName: env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: env.CLOUDINARY_API_SECRET,

    unsplashAccessKey: env.UNSPLASH_ACCESS_KEY,

    dubApiKey: env.DUB_API_KEY,

    socialSearcherApiKey: env.SOCIAL_SEARCHER_API_KEY,

    dbPath: env.SOCIAL_MCP_DB_PATH,
  };
}
