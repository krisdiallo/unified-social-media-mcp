// ---------------------------------------------------------------------------
// Media provider — Unsplash (free stock photos) + basic resize stub
//
// For a full media pipeline swap this out for Cloudinary, Imgix, or similar.
// ---------------------------------------------------------------------------

import type {
  MediaProvider,
  MediaItem,
  SearchMediaRequest,
  ResizeMediaRequest,
} from "../../types.js";

export class UnsplashMediaProvider implements MediaProvider {
  readonly name = "unsplash";
  private baseUrl = "https://api.unsplash.com";

  constructor(private accessKey: string) {}

  async search(request: SearchMediaRequest): Promise<MediaItem[]> {
    const count = request.count ?? 5;
    const qs = new URLSearchParams({
      query: request.query,
      per_page: String(count),
    });

    const res = await fetch(`${this.baseUrl}/search/photos?${qs.toString()}`, {
      headers: { Authorization: `Client-ID ${this.accessKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Unsplash API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      results: {
        id: string;
        urls: { regular: string; small: string };
        width: number;
        height: number;
      }[];
    };

    return data.results.map((photo) => ({
      id: photo.id,
      url: photo.urls.regular,
      mimeType: "image/jpeg",
      width: photo.width,
      height: photo.height,
    }));
  }

  async resize(request: ResizeMediaRequest): Promise<MediaItem> {
    // Unsplash supports on-the-fly transforms via URL params
    const url = new URL(request.url);
    url.searchParams.set("w", String(request.width));
    url.searchParams.set("h", String(request.height));
    url.searchParams.set("fit", "crop");

    return {
      id: `resized-${Date.now()}`,
      url: url.toString(),
      mimeType: "image/jpeg",
      width: request.width,
      height: request.height,
    };
  }
}
