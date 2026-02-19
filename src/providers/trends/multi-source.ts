// ---------------------------------------------------------------------------
// Trends provider — aggregates trending topics from Google Trends, Reddit,
// and platform-specific sources
// ---------------------------------------------------------------------------

import type {
  TrendsProvider,
  TrendingTopic,
  HashtagInfo,
  TrendSource,
  PlatformName,
} from "../../types.js";

const GOOGLE_TRENDS_RSS = "https://trends.google.com/trending/rss";
const REDDIT_POPULAR_JSON = "https://www.reddit.com/r/popular.json";

export class MultiSourceTrendsProvider implements TrendsProvider {
  readonly name = "multi-source";

  async getTrending(source: TrendSource, region?: string): Promise<TrendingTopic[]> {
    switch (source) {
      case "google":
        return this.getGoogleTrends(region);
      case "reddit":
        return this.getRedditTrends();
      default:
        // Platform-specific trends require platform API access
        return [];
    }
  }

  async lookupHashtag(_platform: PlatformName, tag: string): Promise<HashtagInfo> {
    // Placeholder — full hashtag lookup requires platform-specific APIs
    const normalizedTag = tag.startsWith("#") ? tag.slice(1) : tag;
    return {
      tag: normalizedTag,
      source: _platform,
    };
  }

  async suggestHashtags(_platform: PlatformName, text: string): Promise<string[]> {
    // Simple keyword extraction: split into words, filter meaningful ones,
    // and prepend # to create hashtag suggestions
    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "shall", "can", "need", "dare", "ought",
      "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
      "as", "into", "through", "during", "before", "after", "above",
      "below", "between", "out", "off", "over", "under", "again",
      "further", "then", "once", "here", "there", "when", "where", "why",
      "how", "all", "each", "every", "both", "few", "more", "most",
      "other", "some", "such", "no", "nor", "not", "only", "own", "same",
      "so", "than", "too", "very", "just", "because", "but", "and", "or",
      "if", "while", "about", "this", "that", "these", "those", "it", "i",
      "me", "my", "we", "our", "you", "your", "he", "him", "his", "she",
      "her", "they", "them", "their", "what", "which", "who", "whom",
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));

    // Deduplicate and take up to 10 suggestions
    const unique = [...new Set(words)];
    return unique.slice(0, 10).map((w) => `#${w}`);
  }

  private async getGoogleTrends(region?: string): Promise<TrendingTopic[]> {
    const url = new URL(GOOGLE_TRENDS_RSS);
    url.searchParams.set("geo", region ?? "US");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Google Trends RSS error (${res.status}): ${await res.text()}`);
    }

    const xml = await res.text();
    return this.parseGoogleTrendsXml(xml, region);
  }

  private parseGoogleTrendsXml(xml: string, region?: string): TrendingTopic[] {
    const topics: TrendingTopic[] = [];

    // Simple XML parsing — extract <item> elements
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];

      const title = this.extractXmlTag(itemXml, "title");
      const link = this.extractXmlTag(itemXml, "link");
      const approxTraffic = this.extractXmlTag(itemXml, "ht:approx_traffic");

      if (title) {
        const volume = approxTraffic
          ? parseInt(approxTraffic.replace(/[^0-9]/g, ""), 10) || undefined
          : undefined;

        topics.push({
          name: title,
          volume,
          url: link || undefined,
          source: "google",
          region: region ?? "US",
        });
      }
    }

    return topics;
  }

  private async getRedditTrends(): Promise<TrendingTopic[]> {
    const res = await fetch(REDDIT_POPULAR_JSON, {
      headers: {
        "User-Agent": "social-mcp/1.0",
      },
    });

    if (!res.ok) {
      throw new Error(`Reddit API error (${res.status}): ${await res.text()}`);
    }

    const data = await res.json() as {
      data: {
        children: Array<{
          data: {
            title: string;
            subreddit: string;
            score: number;
            permalink: string;
            num_comments: number;
          };
        }>;
      };
    };

    return data.data.children.map((child) => ({
      name: child.data.title,
      volume: child.data.score,
      url: `https://www.reddit.com${child.data.permalink}`,
      source: "reddit" as TrendSource,
    }));
  }

  private extractXmlTag(xml: string, tag: string): string | null {
    // Handle both regular tags and namespaced tags
    const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, "s");
    const match = regex.exec(xml);
    return match ? match[1].trim() : null;
  }
}
