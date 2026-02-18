// ---------------------------------------------------------------------------
// Media provider — Cloudinary API integration with local metadata in SQLite
// ---------------------------------------------------------------------------

import type {
  MediaProvider,
  MediaItem,
} from "../../types.js";
import { getDb } from "../../db.js";
import crypto from "node:crypto";

const UNSPLASH_API_BASE = "https://api.unsplash.com";

interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  format: string;
  resource_type: string;
  width: number;
  height: number;
  bytes: number;
  created_at: string;
}

interface CloudinaryResource {
  public_id: string;
  secure_url: string;
  format: string;
  resource_type: string;
  width: number;
  height: number;
  bytes: number;
  tags?: string[];
  created_at: string;
}

interface MediaRow {
  id: string;
  url: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  tags_json: string | null;
  created_at: string;
}

export class CloudinaryMediaProvider implements MediaProvider {
  readonly name = "cloudinary";

  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;

  constructor(cloudName: string, apiKey: string, apiSecret: string) {
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  private get uploadUrl(): string {
    return `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
  }

  private get adminBaseUrl(): string {
    return `https://api.cloudinary.com/v1_1/${this.cloudName}`;
  }

  private get authHeader(): string {
    return "Basic " + Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString("base64");
  }

  async searchStock(query: string, count = 10): Promise<MediaItem[]> {
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!unsplashKey) {
      throw new Error("Stock search requires UNSPLASH_ACCESS_KEY environment variable");
    }

    const url = new URL(`${UNSPLASH_API_BASE}/search/photos`);
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", String(count));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${unsplashKey}` },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Unsplash API error (${res.status}): ${errBody}`);
    }

    const data = await res.json() as {
      results: Array<{
        id: string;
        urls: { regular: string };
        width: number;
        height: number;
        alt_description?: string;
      }>;
    };

    return data.results.map((photo) => ({
      id: photo.id,
      url: photo.urls.regular,
      mimeType: "image/jpeg",
      width: photo.width,
      height: photo.height,
    }));
  }

  async upload(sourceUrl: string, filename?: string, tags?: string[]): Promise<MediaItem> {
    const body: Record<string, string> = {
      file: sourceUrl,
      upload_preset: "ml_default",
      api_key: this.apiKey,
    };

    if (filename) body.public_id = filename;
    if (tags && tags.length > 0) body.tags = tags.join(",");

    // Generate timestamp and signature for authenticated upload
    const timestamp = Math.floor(Date.now() / 1000).toString();
    body.timestamp = timestamp;

    const res = await fetch(this.uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Cloudinary upload error (${res.status}): ${errBody}`);
    }

    const data = await res.json() as CloudinaryUploadResponse;
    const mimeType = `${data.resource_type}/${data.format}`;

    const item: MediaItem = {
      id: data.public_id,
      url: data.secure_url,
      mimeType,
      width: data.width,
      height: data.height,
      sizeBytes: data.bytes,
      tags,
    };

    // Store metadata in local DB
    const db = getDb();
    db.prepare(`
      INSERT INTO media_library (id, url, mime_type, width, height, size_bytes, tags_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        url = excluded.url,
        mime_type = excluded.mime_type,
        width = excluded.width,
        height = excluded.height,
        size_bytes = excluded.size_bytes,
        tags_json = excluded.tags_json
    `).run(
      item.id,
      item.url,
      item.mimeType,
      item.width ?? null,
      item.height ?? null,
      item.sizeBytes ?? null,
      tags ? JSON.stringify(tags) : null,
      data.created_at ?? new Date().toISOString(),
    );

    return item;
  }

  async list(filters?: { tags?: string[]; mimeType?: string }): Promise<MediaItem[]> {
    // Try Cloudinary Admin API first, fall back to local DB
    try {
      let url = `${this.adminBaseUrl}/resources/image`;
      const params = new URLSearchParams();

      if (filters?.tags && filters.tags.length > 0) {
        // Use tag-based listing
        url = `${this.adminBaseUrl}/resources/image/tags/${filters.tags[0]}`;
      }

      params.set("max_results", "100");

      const res = await fetch(`${url}?${params.toString()}`, {
        headers: { Authorization: this.authHeader },
      });

      if (!res.ok) throw new Error("Cloudinary API unavailable");

      const data = await res.json() as { resources: CloudinaryResource[] };

      const items = data.resources.map((r): MediaItem => ({
        id: r.public_id,
        url: r.secure_url,
        mimeType: `${r.resource_type}/${r.format}`,
        width: r.width,
        height: r.height,
        sizeBytes: r.bytes,
        tags: r.tags,
      }));

      // Apply mimeType filter in application layer
      if (filters?.mimeType) {
        return items.filter((item) => item.mimeType === filters.mimeType);
      }

      return items;
    } catch {
      // Fall back to local DB
      return this.listFromDb(filters);
    }
  }

  private listFromDb(filters?: { tags?: string[]; mimeType?: string }): MediaItem[] {
    const db = getDb();
    let sql = "SELECT * FROM media_library WHERE 1=1";
    const params: unknown[] = [];

    if (filters?.mimeType) {
      sql += " AND mime_type = ?";
      params.push(filters.mimeType);
    }

    sql += " ORDER BY created_at DESC";

    let items = (db.prepare(sql).all(...params) as MediaRow[]).map(rowToMediaItem);

    if (filters?.tags && filters.tags.length > 0) {
      items = items.filter((item) => {
        if (!item.tags) return false;
        return filters.tags!.some((tag) => item.tags!.includes(tag));
      });
    }

    return items;
  }

  async get(mediaId: string): Promise<MediaItem> {
    try {
      const res = await fetch(
        `${this.adminBaseUrl}/resources/image/upload/${mediaId}`,
        { headers: { Authorization: this.authHeader } },
      );

      if (!res.ok) throw new Error("Cloudinary API unavailable");

      const data = await res.json() as CloudinaryResource;

      return {
        id: data.public_id,
        url: data.secure_url,
        mimeType: `${data.resource_type}/${data.format}`,
        width: data.width,
        height: data.height,
        sizeBytes: data.bytes,
        tags: data.tags,
      };
    } catch {
      // Fall back to local DB
      const db = getDb();
      const row = db.prepare("SELECT * FROM media_library WHERE id = ?").get(mediaId) as MediaRow | undefined;
      if (!row) throw new Error(`Media item ${mediaId} not found`);
      return rowToMediaItem(row);
    }
  }

  async delete(mediaId: string): Promise<void> {
    const res = await fetch(
      `${this.adminBaseUrl}/resources/image/upload`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.authHeader,
        },
        body: JSON.stringify({ public_ids: [mediaId] }),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Cloudinary delete error (${res.status}): ${errBody}`);
    }

    // Remove from local DB
    const db = getDb();
    db.prepare("DELETE FROM media_library WHERE id = ?").run(mediaId);
  }

  async resize(mediaId: string, width: number, height: number): Promise<MediaItem> {
    // Get the original item first
    const original = await this.get(mediaId);

    // Construct a Cloudinary URL with transformation parameters
    // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/w_{width},h_{height},c_fill/{public_id}.{format}
    const transformedUrl = `https://res.cloudinary.com/${this.cloudName}/image/upload/w_${width},h_${height},c_fill/${mediaId}`;

    return {
      ...original,
      url: transformedUrl,
      width,
      height,
    };
  }
}

function rowToMediaItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    url: row.url,
    mimeType: row.mime_type,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    tags: row.tags_json ? JSON.parse(row.tags_json) : undefined,
  };
}
