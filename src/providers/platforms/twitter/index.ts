// ---------------------------------------------------------------------------
// Twitter / X platform provider
// Uses Twitter API v2 via direct HTTP (no heavy SDK dependency).
// ---------------------------------------------------------------------------

import type {
  PlatformProvider,
  PostContent,
  PostResult,
  PostMetrics,
} from "../../../types.js";
import crypto from "node:crypto";

export interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export class TwitterProvider implements PlatformProvider {
  readonly name = "twitter";
  readonly platform = "twitter" as const;

  constructor(private creds: TwitterCredentials) {}

  // -- Public API -----------------------------------------------------------

  async post(content: PostContent): Promise<PostResult> {
    const body: Record<string, unknown> = { text: content.text };

    if (content.mediaUrls?.length) {
      // Media upload is a separate endpoint — callers should upload first and
      // pass media IDs via `content.extra.media_ids`.
      if (content.extra?.media_ids) {
        body.media = { media_ids: content.extra.media_ids };
      }
    }

    const res = await this.request("POST", "https://api.twitter.com/2/tweets", body);
    const data = res.data as { id: string };
    return {
      id: data.id,
      url: `https://twitter.com/i/status/${data.id}`,
      platform: "twitter",
      createdAt: new Date().toISOString(),
    };
  }

  async deletePost(postId: string): Promise<void> {
    await this.request("DELETE", `https://api.twitter.com/2/tweets/${postId}`);
  }

  async getPost(postId: string): Promise<PostResult & { text: string; metrics?: PostMetrics }> {
    const res = await this.request(
      "GET",
      `https://api.twitter.com/2/tweets/${postId}?tweet.fields=created_at,public_metrics`,
    );
    const tweet = res.data as {
      id: string;
      text: string;
      created_at?: string;
      public_metrics?: {
        like_count: number;
        retweet_count: number;
        reply_count: number;
        impression_count: number;
      };
    };

    const pm = tweet.public_metrics;
    return {
      id: tweet.id,
      url: `https://twitter.com/i/status/${tweet.id}`,
      platform: "twitter",
      createdAt: tweet.created_at ?? new Date().toISOString(),
      text: tweet.text,
      metrics: pm
        ? {
            likes: pm.like_count,
            shares: pm.retweet_count,
            comments: pm.reply_count,
            impressions: pm.impression_count,
            clicks: 0,
          }
        : undefined,
    };
  }

  // -- OAuth 1.0a signing ---------------------------------------------------

  private async request(
    method: string,
    url: string,
    body?: Record<string, unknown>,
  ): Promise<{ data: unknown }> {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.creds.apiKey,
      oauth_nonce: crypto.randomBytes(16).toString("hex"),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: this.creds.accessToken,
      oauth_version: "1.0",
    };

    const baseUrl = url.split("?")[0];
    const queryString = url.includes("?") ? url.split("?")[1] : "";
    const queryParams: Record<string, string> = {};
    if (queryString) {
      for (const pair of queryString.split("&")) {
        const [k, v] = pair.split("=");
        queryParams[k] = decodeURIComponent(v);
      }
    }

    const sigParams = { ...oauthParams, ...queryParams };
    const paramString = Object.keys(sigParams)
      .sort()
      .map((k) => `${encodeRFC3986(k)}=${encodeRFC3986(sigParams[k])}`)
      .join("&");

    const signatureBase = `${method.toUpperCase()}&${encodeRFC3986(baseUrl)}&${encodeRFC3986(paramString)}`;
    const signingKey = `${encodeRFC3986(this.creds.apiSecret)}&${encodeRFC3986(this.creds.accessTokenSecret)}`;
    const signature = crypto.createHmac("sha1", signingKey).update(signatureBase).digest("base64");

    oauthParams.oauth_signature = signature;

    const authHeader =
      "OAuth " +
      Object.keys(oauthParams)
        .sort()
        .map((k) => `${encodeRFC3986(k)}="${encodeRFC3986(oauthParams[k])}"`)
        .join(", ");

    const headers: Record<string, string> = { Authorization: authHeader };
    const fetchOpts: RequestInit = { method, headers };

    if (body && (method === "POST" || method === "PUT")) {
      headers["Content-Type"] = "application/json";
      fetchOpts.body = JSON.stringify(body);
    }

    const res = await fetch(url, fetchOpts);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twitter API error (${res.status}): ${text}`);
    }
    // DELETE returns 204 with no body
    if (res.status === 204) return { data: {} };
    return (await res.json()) as { data: unknown };
  }
}

function encodeRFC3986(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
