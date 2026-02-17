#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Unified Social Media MCP Server
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { loadConfig } from "./config/index.js";
import { buildRegistry } from "./registry.js";
import type { PlatformName } from "./types.js";

const PLATFORM_NAMES = ["twitter", "bluesky", "linkedin", "facebook"] as const;

async function main() {
  const config = loadConfig();
  const registry = buildRegistry(config);

  const server = new McpServer({
    name: "unified-social-media",
    version: "0.1.0",
  });

  // ========================================================================
  // CONTENT GENERATION TOOLS
  // ========================================================================

  server.tool(
    "generate_content",
    "Generate a social media post for a specific platform using AI. Returns the generated text with hashtags.",
    {
      topic: z.string().describe("The topic or subject for the post"),
      platform: z.enum(PLATFORM_NAMES).describe("Target platform"),
      tone: z.string().optional().describe("Desired tone (e.g. professional, casual, humorous)"),
      maxLength: z.number().optional().describe("Maximum character count"),
      hashtags: z.boolean().optional().describe("Whether to include hashtags (default true)"),
      context: z.string().optional().describe("Additional context to include in the prompt"),
    },
    async (params) => {
      try {
        const result = await registry.contentGeneration.generate({
          topic: params.topic,
          platform: params.platform as PlatformName,
          tone: params.tone,
          maxLength: params.maxLength,
          hashtags: params.hashtags,
          context: params.context,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    },
  );

  // ========================================================================
  // PLATFORM / POSTING TOOLS
  // ========================================================================

  server.tool(
    "post_to_platform",
    "Publish a post to a social media platform. Returns the post ID and URL.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to post to"),
      text: z.string().describe("Post text content"),
      mediaUrls: z.array(z.string()).optional().describe("URLs of media to attach"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: Platform "${params.platform}" is not configured. Configured platforms: ${[...registry.platforms.keys()].join(", ") || "none"}`,
              },
            ],
            isError: true,
          };
        }
        const result = await provider.post({
          text: params.text,
          mediaUrls: params.mediaUrls,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "crosspost",
    "Publish the same content to multiple platforms at once. Returns results for each platform.",
    {
      platforms: z.array(z.enum(PLATFORM_NAMES)).describe("Platforms to post to"),
      text: z.string().describe("Post text content"),
      mediaUrls: z.array(z.string()).optional().describe("URLs of media to attach"),
    },
    async (params) => {
      const results: Record<string, unknown> = {};
      for (const platform of params.platforms) {
        const provider = registry.platforms.get(platform as PlatformName);
        if (!provider) {
          results[platform] = { error: `Platform "${platform}" is not configured` };
          continue;
        }
        try {
          results[platform] = await provider.post({
            text: params.text,
            mediaUrls: params.mediaUrls,
          });
        } catch (err) {
          results[platform] = { error: String(err) };
        }
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  server.tool(
    "delete_post",
    "Delete a post from a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform the post is on"),
      postId: z.string().describe("ID of the post to delete"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) {
          return {
            content: [{ type: "text" as const, text: `Error: Platform "${params.platform}" not configured` }],
            isError: true,
          };
        }
        await provider.deletePost(params.postId);
        return {
          content: [{ type: "text" as const, text: `Post ${params.postId} deleted from ${params.platform}` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_post",
    "Retrieve a post and its metrics from a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform the post is on"),
      postId: z.string().describe("ID of the post"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) {
          return {
            content: [{ type: "text" as const, text: `Error: Platform "${params.platform}" not configured` }],
            isError: true,
          };
        }
        const result = await provider.getPost(params.postId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "list_configured_platforms",
    "List all currently configured and available social media platforms.",
    {},
    async () => {
      const platforms = [...registry.platforms.keys()];
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                configuredPlatforms: platforms,
                availablePlatforms: PLATFORM_NAMES,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ========================================================================
  // SCHEDULING TOOLS
  // ========================================================================

  server.tool(
    "schedule_post",
    "Schedule a post to be published at a future time on one or more platforms.",
    {
      text: z.string().describe("Post text content"),
      platforms: z.array(z.enum(PLATFORM_NAMES)).describe("Platforms to post to"),
      scheduledAt: z.string().describe("ISO-8601 datetime for when to publish"),
      mediaUrls: z.array(z.string()).optional().describe("URLs of media to attach"),
    },
    async (params) => {
      try {
        const result = await registry.scheduling.schedule({
          content: { text: params.text, mediaUrls: params.mediaUrls },
          platforms: params.platforms as PlatformName[],
          scheduledAt: params.scheduledAt,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "cancel_scheduled_post",
    "Cancel a previously scheduled post.",
    {
      scheduleId: z.string().describe("ID of the scheduled post to cancel"),
    },
    async (params) => {
      try {
        await registry.scheduling.cancel(params.scheduleId);
        return {
          content: [{ type: "text" as const, text: `Scheduled post ${params.scheduleId} cancelled.` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "list_scheduled_posts",
    "List all scheduled posts and their statuses.",
    {},
    async () => {
      try {
        const posts = await registry.scheduling.list();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(posts, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_scheduled_post",
    "Get the details and status of a specific scheduled post.",
    {
      scheduleId: z.string().describe("ID of the scheduled post"),
    },
    async (params) => {
      try {
        const post = await registry.scheduling.get(params.scheduleId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(post, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    },
  );

  // ========================================================================
  // ANALYTICS TOOLS
  // ========================================================================

  server.tool(
    "get_post_metrics",
    "Get engagement metrics (likes, shares, comments, impressions) for a specific post.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform the post is on"),
      postId: z.string().describe("ID of the post"),
    },
    async (params) => {
      try {
        const metrics = await registry.analytics.getPostMetrics(
          params.platform as PlatformName,
          params.postId,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(metrics, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_analytics_summary",
    "Get an analytics summary for a platform over a time period.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to get analytics for"),
      periodStart: z.string().describe("Start of period (ISO-8601 date)"),
      periodEnd: z.string().describe("End of period (ISO-8601 date)"),
    },
    async (params) => {
      try {
        const summary = await registry.analytics.getSummary(
          params.platform as PlatformName,
          params.periodStart,
          params.periodEnd,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    },
  );

  // ========================================================================
  // MEDIA TOOLS
  // ========================================================================

  server.tool(
    "search_media",
    "Search for stock photos/images to use in social media posts.",
    {
      query: z.string().describe("Search query for images"),
      count: z.number().optional().describe("Number of results (default 5)"),
    },
    async (params) => {
      try {
        const results = await registry.media.search({
          query: params.query,
          count: params.count,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "resize_media",
    "Resize an image to specific dimensions for a platform.",
    {
      url: z.string().describe("URL of the image to resize"),
      width: z.number().describe("Target width in pixels"),
      height: z.number().describe("Target height in pixels"),
    },
    async (params) => {
      try {
        const result = await registry.media.resize({
          url: params.url,
          width: params.width,
          height: params.height,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    },
  );

  // ========================================================================
  // START SERVER
  // ========================================================================

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Unified Social Media MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
