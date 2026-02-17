// ---------------------------------------------------------------------------
// Bluesky (AT Protocol) platform provider
// ---------------------------------------------------------------------------

import type {
  PlatformProvider,
  PostContent,
  PostResult,
  PostMetrics,
} from "../../../types.js";

export interface BlueskyCredentials {
  identifier: string; // handle or DID
  password: string;   // app password
}

interface BlueskySession {
  did: string;
  accessJwt: string;
  handle: string;
}

export class BlueskyProvider implements PlatformProvider {
  readonly name = "bluesky";
  readonly platform = "bluesky" as const;

  private session: BlueskySession | null = null;
  private serviceUrl = "https://bsky.social";

  constructor(private creds: BlueskyCredentials) {}

  // -- Public API -----------------------------------------------------------

  async post(content: PostContent): Promise<PostResult> {
    await this.ensureSession();

    const record: Record<string, unknown> = {
      $type: "app.bsky.feed.post",
      text: content.text,
      createdAt: new Date().toISOString(),
    };

    // Detect facets (links, mentions, hashtags) for rich text
    const facets = this.detectFacets(content.text);
    if (facets.length > 0) {
      record.facets = facets;
    }

    const res = await this.xrpc("com.atproto.repo.createRecord", {
      repo: this.session!.did,
      collection: "app.bsky.feed.post",
      record,
    });

    const data = res as { uri: string; cid: string };
    const rkey = data.uri.split("/").pop()!;

    return {
      id: data.uri,
      url: `https://bsky.app/profile/${this.session!.handle}/post/${rkey}`,
      platform: "bluesky",
      createdAt: new Date().toISOString(),
    };
  }

  async deletePost(postId: string): Promise<void> {
    await this.ensureSession();
    const rkey = postId.split("/").pop()!;

    await this.xrpc("com.atproto.repo.deleteRecord", {
      repo: this.session!.did,
      collection: "app.bsky.feed.post",
      rkey,
    });
  }

  async getPost(postId: string): Promise<PostResult & { text: string; metrics?: PostMetrics }> {
    await this.ensureSession();

    const res = await this.xrpcGet("app.bsky.feed.getPostThread", {
      uri: postId,
      depth: 0,
    });

    const thread = res as {
      thread: {
        post: {
          uri: string;
          record: { text: string; createdAt: string };
          likeCount?: number;
          repostCount?: number;
          replyCount?: number;
        };
      };
    };

    const post = thread.thread.post;
    const rkey = post.uri.split("/").pop()!;

    return {
      id: post.uri,
      url: `https://bsky.app/profile/${this.session!.handle}/post/${rkey}`,
      platform: "bluesky",
      createdAt: post.record.createdAt,
      text: post.record.text,
      metrics: {
        likes: post.likeCount ?? 0,
        shares: post.repostCount ?? 0,
        comments: post.replyCount ?? 0,
        impressions: 0,
        clicks: 0,
      },
    };
  }

  // -- AT Protocol helpers --------------------------------------------------

  private async ensureSession(): Promise<void> {
    if (this.session) return;

    const res = await fetch(`${this.serviceUrl}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: this.creds.identifier,
        password: this.creds.password,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bluesky auth error (${res.status}): ${text}`);
    }

    this.session = (await res.json()) as BlueskySession;
  }

  private async xrpc(method: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.serviceUrl}/xrpc/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.session!.accessJwt}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bluesky XRPC error (${res.status}): ${text}`);
    }
    return res.json();
  }

  private async xrpcGet(method: string, params: Record<string, string | number>): Promise<unknown> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      qs.set(k, String(v));
    }

    const res = await fetch(`${this.serviceUrl}/xrpc/${method}?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${this.session!.accessJwt}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bluesky XRPC error (${res.status}): ${text}`);
    }
    return res.json();
  }

  private detectFacets(text: string): unknown[] {
    const facets: unknown[] = [];
    const encoder = new TextEncoder();

    // Hashtag detection
    const hashtagRegex = /#(\w+)/g;
    let match;
    while ((match = hashtagRegex.exec(text)) !== null) {
      const start = encoder.encode(text.slice(0, match.index)).byteLength;
      const end = start + encoder.encode(match[0]).byteLength;
      facets.push({
        index: { byteStart: start, byteEnd: end },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag: match[1] }],
      });
    }

    // URL detection
    const urlRegex = /https?:\/\/[^\s)]+/g;
    while ((match = urlRegex.exec(text)) !== null) {
      const start = encoder.encode(text.slice(0, match.index)).byteLength;
      const end = start + encoder.encode(match[0]).byteLength;
      facets.push({
        index: { byteStart: start, byteEnd: end },
        features: [{ $type: "app.bsky.richtext.facet#link", uri: match[0] }],
      });
    }

    return facets;
  }
}
