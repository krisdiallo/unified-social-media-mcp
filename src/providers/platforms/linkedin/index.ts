// ---------------------------------------------------------------------------
// LinkedIn platform provider — uses LinkedIn Marketing / Community API v2
// ---------------------------------------------------------------------------

import type {
  PlatformProvider,
  PostContent,
  PostResult,
  PostMetrics,
} from "../../../types.js";

export interface LinkedInCredentials {
  accessToken: string;
}

export class LinkedInProvider implements PlatformProvider {
  readonly name = "linkedin";
  readonly platform = "linkedin" as const;
  private baseUrl = "https://api.linkedin.com/v2";

  constructor(private creds: LinkedInCredentials) {}

  async post(content: PostContent): Promise<PostResult> {
    // First, get the current user's profile URN
    const profileUrn = await this.getProfileUrn();

    const body: Record<string, unknown> = {
      author: profileUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content.text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    const res = await fetch(`${this.baseUrl}/ugcPosts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.creds.accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LinkedIn API error (${res.status}): ${text}`);
    }

    const postId = res.headers.get("x-restli-id") ?? "";

    return {
      id: postId,
      url: `https://www.linkedin.com/feed/update/${postId}`,
      platform: "linkedin",
      createdAt: new Date().toISOString(),
    };
  }

  async deletePost(postId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/ugcPosts/${encodeURIComponent(postId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.creds.accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LinkedIn API error (${res.status}): ${text}`);
    }
  }

  async getPost(postId: string): Promise<PostResult & { text: string; metrics?: PostMetrics }> {
    const res = await fetch(`${this.baseUrl}/ugcPosts/${encodeURIComponent(postId)}`, {
      headers: {
        Authorization: `Bearer ${this.creds.accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LinkedIn API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      id: string;
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: string };
        };
      };
      created: { time: number };
    };

    const text = data.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text ?? "";

    // Fetch social metrics
    let metrics: PostMetrics | undefined;
    try {
      const statsRes = await fetch(
        `${this.baseUrl}/socialActions/${encodeURIComponent(postId)}`,
        {
          headers: {
            Authorization: `Bearer ${this.creds.accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
        },
      );
      if (statsRes.ok) {
        const stats = (await statsRes.json()) as {
          likesSummary?: { totalLikes: number };
          commentsSummary?: { totalFirstLevelComments: number };
        };
        metrics = {
          likes: stats.likesSummary?.totalLikes ?? 0,
          shares: 0,
          comments: stats.commentsSummary?.totalFirstLevelComments ?? 0,
          impressions: 0,
          clicks: 0,
        };
      }
    } catch {
      // metrics are best-effort
    }

    return {
      id: data.id,
      url: `https://www.linkedin.com/feed/update/${data.id}`,
      platform: "linkedin",
      createdAt: new Date(data.created.time).toISOString(),
      text,
      metrics,
    };
  }

  private async getProfileUrn(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/me`, {
      headers: {
        Authorization: `Bearer ${this.creds.accessToken}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LinkedIn API error fetching profile (${res.status}): ${text}`);
    }

    const profile = (await res.json()) as { id: string };
    return `urn:li:person:${profile.id}`;
  }
}
