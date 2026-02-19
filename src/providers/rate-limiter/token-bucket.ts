// ---------------------------------------------------------------------------
// Rate limiter — token bucket implementation
//
// Tracks API rate limits per platform/endpoint. The MCP server checks
// this before making API calls to avoid hitting rate limits.
// ---------------------------------------------------------------------------

import type { RateLimiter, RateLimitStatus, PlatformName } from "../../types.js";

interface BucketConfig {
  limit: number;
  windowMs: number; // refill window in ms
}

interface Bucket {
  remaining: number;
  resetsAt: number;
  config: BucketConfig;
}

// Default rate limits per platform (conservative estimates)
const DEFAULT_LIMITS: Record<string, BucketConfig> = {
  "twitter:post": { limit: 200, windowMs: 15 * 60 * 1000 }, // 200 per 15 min
  "twitter:read": { limit: 900, windowMs: 15 * 60 * 1000 },
  "bluesky:post": { limit: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
  "bluesky:read": { limit: 3000, windowMs: 5 * 60 * 1000 },
  "linkedin:post": { limit: 100, windowMs: 24 * 60 * 60 * 1000 }, // 100 per day
  "linkedin:read": { limit: 100, windowMs: 24 * 60 * 60 * 1000 },
  "facebook:post": { limit: 200, windowMs: 60 * 60 * 1000 },
  "facebook:read": { limit: 200, windowMs: 60 * 60 * 1000 },
};

export class TokenBucketRateLimiter implements RateLimiter {
  readonly name = "token-bucket";

  private buckets = new Map<string, Bucket>();

  async checkLimit(platform: PlatformName, endpoint: string): Promise<RateLimitStatus> {
    const key = `${platform}:${endpoint}`;
    const bucket = this.getOrCreateBucket(key);

    // Refill if window has passed
    if (Date.now() >= bucket.resetsAt) {
      bucket.remaining = bucket.config.limit;
      bucket.resetsAt = Date.now() + bucket.config.windowMs;
    }

    return {
      platform,
      endpoint,
      limit: bucket.config.limit,
      remaining: bucket.remaining,
      resetsAt: new Date(bucket.resetsAt).toISOString(),
    };
  }

  async getStatus(): Promise<RateLimitStatus[]> {
    const statuses: RateLimitStatus[] = [];

    for (const [key, bucket] of this.buckets) {
      const [platform, endpoint] = key.split(":") as [PlatformName, string];

      // Refill if needed
      if (Date.now() >= bucket.resetsAt) {
        bucket.remaining = bucket.config.limit;
        bucket.resetsAt = Date.now() + bucket.config.windowMs;
      }

      statuses.push({
        platform,
        endpoint,
        limit: bucket.config.limit,
        remaining: bucket.remaining,
        resetsAt: new Date(bucket.resetsAt).toISOString(),
      });
    }

    return statuses;
  }

  private getOrCreateBucket(key: string): Bucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      const config = DEFAULT_LIMITS[key] ?? { limit: 100, windowMs: 15 * 60 * 1000 };
      bucket = {
        remaining: config.limit,
        resetsAt: Date.now() + config.windowMs,
        config,
      };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }
}
