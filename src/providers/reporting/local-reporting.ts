// ---------------------------------------------------------------------------
// Reporting & export provider — local implementation
//
// Aggregates data from analytics, campaigns, and scheduling providers
// to generate reports in multiple formats.
// ---------------------------------------------------------------------------

import type {
  ReportingProvider,
  ReportConfig,
  Report,
  PlatformName,
  AnalyticsProvider,
  CampaignProvider,
} from "../../types.js";
import crypto from "node:crypto";

export class LocalReportingProvider implements ReportingProvider {
  readonly name = "local";

  constructor(
    private analytics: AnalyticsProvider,
    private campaigns: CampaignProvider,
  ) {}

  async generateReport(config: ReportConfig): Promise<Report> {
    const data: Record<string, unknown> = {};

    for (const platform of config.platforms) {
      const platformData: Record<string, unknown> = {};

      if (config.includeMetrics) {
        try {
          platformData.summary = await this.analytics.getSummary(
            platform,
            config.periodStart,
            config.periodEnd,
          );
        } catch {
          platformData.summary = { error: "Failed to fetch metrics" };
        }
      }

      if (config.includeAudience) {
        try {
          platformData.audience = await this.analytics.getAudienceInsights(platform);
        } catch {
          platformData.audience = { error: "Failed to fetch audience insights" };
        }
      }

      data[platform] = platformData;
    }

    if (config.includeCampaigns) {
      try {
        data.campaigns = await this.campaigns.listCampaigns();
      } catch {
        data.campaigns = { error: "Failed to fetch campaigns" };
      }
    }

    const formatted = this.formatReport(data, config);

    return {
      id: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      config,
      data,
      formatted,
    };
  }

  async exportPostData(
    platform: PlatformName,
    postIds: string[],
    format: "json" | "csv",
  ): Promise<string> {
    const posts: Record<string, unknown>[] = [];

    for (const postId of postIds) {
      try {
        const metrics = await this.analytics.getPostMetrics(platform, postId);
        posts.push({ postId, platform, ...metrics });
      } catch {
        posts.push({ postId, platform, error: "Failed to fetch metrics" });
      }
    }

    if (format === "csv") {
      if (posts.length === 0) return "";
      const headers = Object.keys(posts[0]);
      const rows = posts.map((p) => headers.map((h) => String(p[h] ?? "")).join(","));
      return [headers.join(","), ...rows].join("\n");
    }

    return JSON.stringify(posts, null, 2);
  }

  private formatReport(data: Record<string, unknown>, config: ReportConfig): string {
    if (config.format === "json") {
      return JSON.stringify(data, null, 2);
    }

    if (config.format === "csv") {
      // Flatten to CSV rows
      const rows: string[] = ["platform,metric,value"];
      for (const [platform, platformData] of Object.entries(data)) {
        if (platform === "campaigns") continue;
        const pd = platformData as Record<string, unknown>;
        if (pd.summary && typeof pd.summary === "object") {
          for (const [key, val] of Object.entries(pd.summary as Record<string, unknown>)) {
            rows.push(`${platform},${key},${val}`);
          }
        }
      }
      return rows.join("\n");
    }

    // Markdown format
    let md = `# Social Media Report\n\n`;
    md += `**Period:** ${config.periodStart} to ${config.periodEnd}\n\n`;

    for (const [platform, platformData] of Object.entries(data)) {
      if (platform === "campaigns") continue;
      md += `## ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n\n`;
      const pd = platformData as Record<string, unknown>;

      if (pd.summary && typeof pd.summary === "object") {
        const summary = pd.summary as Record<string, unknown>;
        md += `### Metrics\n\n`;
        md += `| Metric | Value |\n|---|---|\n`;
        for (const [key, val] of Object.entries(summary)) {
          if (key === "platform" || key === "topPost") continue;
          md += `| ${key} | ${val} |\n`;
        }
        md += "\n";
      }

      if (pd.audience && typeof pd.audience === "object") {
        const audience = pd.audience as Record<string, unknown>;
        md += `### Audience\n\n`;
        md += `- Followers: ${audience.followerCount ?? "N/A"}\n`;
        md += `- Following: ${audience.followingCount ?? "N/A"}\n\n`;
      }
    }

    if (data.campaigns && Array.isArray(data.campaigns)) {
      md += `## Campaigns\n\n`;
      for (const campaign of data.campaigns as { name: string; status: string }[]) {
        md += `- **${campaign.name}** (${campaign.status})\n`;
      }
      md += "\n";
    }

    return md;
  }
}
