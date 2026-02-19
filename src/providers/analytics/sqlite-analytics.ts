// ---------------------------------------------------------------------------
// Analytics provider — stores post history in SQLite, delegates live metrics
// to platform providers.
// ---------------------------------------------------------------------------

import type {
  AnalyticsProvider,
  PostMetrics,
  StoredPost,
  AudienceInsights,
  PlatformName,
  PlatformProvider,
} from "../../types.js";
import { getDb } from "../../db.js";

interface PostHistoryRow {
  id: string;
  platform: string;
  text: string;
  media_urls_json: string | null;
  created_at: string;
  metrics_json: string | null;
  campaign_id: string | null;
  synced_at: string;
}

export class SqliteAnalyticsProvider implements AnalyticsProvider {
  readonly name = "sqlite";

  constructor(private platformProviders: Map<PlatformName, PlatformProvider>) {}

  async getPostMetrics(platform: PlatformName, postId: string): Promise<PostMetrics> {
    const provider = this.platformProviders.get(platform);
    if (!provider) throw new Error(`No platform provider for ${platform}`);

    const post = await provider.getPost(postId);
    return post.metrics ?? { likes: 0, shares: 0, comments: 0, impressions: 0, clicks: 0 };
  }

  async syncPosts(platform: PlatformName, limit = 50): Promise<StoredPost[]> {
    const provider = this.platformProviders.get(platform);
    if (!provider) throw new Error(`No platform provider for ${platform}`);

    if (!provider.getRecentPosts) {
      throw new Error(`Platform provider ${platform} does not support getRecentPosts`);
    }

    const posts = await provider.getRecentPosts(limit);
    const db = getDb();
    const now = new Date().toISOString();

    const upsert = db.prepare(`
      INSERT INTO post_history (id, platform, text, media_urls_json, created_at, metrics_json, campaign_id, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, platform) DO UPDATE SET
        text = excluded.text,
        media_urls_json = excluded.media_urls_json,
        metrics_json = excluded.metrics_json,
        synced_at = excluded.synced_at
    `);

    const insertMany = db.transaction((items: StoredPost[]) => {
      for (const post of items) {
        upsert.run(
          post.id,
          platform,
          post.text,
          post.mediaUrls ? JSON.stringify(post.mediaUrls) : null,
          post.createdAt,
          post.metrics ? JSON.stringify(post.metrics) : null,
          post.campaignId ?? null,
          now,
        );
      }
    });

    insertMany(posts);
    return posts;
  }

  async getPostHistory(platform: PlatformName, limit: number, offset = 0): Promise<StoredPost[]> {
    const db = getDb();
    const rows = db.prepare(
      "SELECT * FROM post_history WHERE platform = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    ).all(platform, limit, offset) as PostHistoryRow[];

    return rows.map(rowToStoredPost);
  }

  async getAudienceInsights(platform: PlatformName): Promise<AudienceInsights> {
    const provider = this.platformProviders.get(platform);
    if (!provider) throw new Error(`No platform provider for ${platform}`);

    if (!provider.getAudienceInsights) {
      throw new Error(`Platform provider ${platform} does not support getAudienceInsights`);
    }

    return provider.getAudienceInsights();
  }
}

function rowToStoredPost(row: PostHistoryRow): StoredPost {
  return {
    id: row.id,
    platform: row.platform as PlatformName,
    text: row.text,
    mediaUrls: row.media_urls_json ? JSON.parse(row.media_urls_json) : undefined,
    createdAt: row.created_at,
    metrics: row.metrics_json ? JSON.parse(row.metrics_json) : undefined,
    campaignId: row.campaign_id ?? undefined,
  };
}
