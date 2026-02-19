// ---------------------------------------------------------------------------
// Facebook / Meta platform provider — uses Graph API (Page posts)
// ---------------------------------------------------------------------------

import type {
  PlatformProvider,
  PostContent,
  PostResult,
  PostMetrics,
} from "../../../types.js";

export interface FacebookCredentials {
  pageToken: string;
  pageId: string;
}

export class FacebookProvider implements PlatformProvider {
  readonly name = "facebook";
  readonly platform = "facebook" as const;
  private graphUrl = "https://graph.facebook.com/v19.0";

  constructor(private creds: FacebookCredentials) {}

  async post(content: PostContent): Promise<PostResult> {
    const params = new URLSearchParams({
      message: content.text,
      access_token: this.creds.pageToken,
    });

    const res = await fetch(`${this.graphUrl}/${this.creds.pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Facebook API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { id: string };

    return {
      id: data.id,
      url: `https://www.facebook.com/${data.id.replace("_", "/posts/")}`,
      platform: "facebook",
      createdAt: new Date().toISOString(),
    };
  }

  async deletePost(postId: string): Promise<void> {
    const res = await fetch(
      `${this.graphUrl}/${postId}?access_token=${this.creds.pageToken}`,
      { method: "DELETE" },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Facebook API error (${res.status}): ${text}`);
    }
  }

  async getPost(postId: string): Promise<PostResult & { text: string; metrics?: PostMetrics }> {
    const fields = "id,message,created_time,likes.summary(true),comments.summary(true),shares";
    const res = await fetch(
      `${this.graphUrl}/${postId}?fields=${fields}&access_token=${this.creds.pageToken}`,
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Facebook API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      id: string;
      message: string;
      created_time: string;
      likes?: { summary: { total_count: number } };
      comments?: { summary: { total_count: number } };
      shares?: { count: number };
    };

    return {
      id: data.id,
      url: `https://www.facebook.com/${data.id.replace("_", "/posts/")}`,
      platform: "facebook",
      createdAt: data.created_time,
      text: data.message,
      metrics: {
        likes: data.likes?.summary?.total_count ?? 0,
        shares: data.shares?.count ?? 0,
        comments: data.comments?.summary?.total_count ?? 0,
        impressions: 0,
        clicks: 0,
      },
    };
  }
}
