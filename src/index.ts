#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Unified Social Media MCP Server
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { loadConfig } from "./config/index.js";
import { buildRegistry } from "./registry.js";
import type { PlatformName, TrendSource, IdeaStatus } from "./types.js";

const PLATFORM_NAMES = ["twitter", "bluesky", "linkedin", "facebook"] as const;
const TREND_SOURCES = ["google", "reddit", "twitter", "bluesky", "linkedin", "facebook"] as const;
const IDEA_STATUSES = ["idea", "draft", "pending_review", "approved", "rejected", "scheduled", "published"] as const;

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function err(error: unknown) {
  return { content: [{ type: "text" as const, text: `Error: ${error}` }], isError: true as const };
}

async function main() {
  const config = loadConfig();
  const registry = buildRegistry(config);

  const server = new McpServer({
    name: "unified-social-media",
    version: "1.0.0",
  });

  // ========================================================================
  // PLATFORM / POSTING
  // ========================================================================

  server.tool(
    "post_to_platform",
    "Publish a post to a social media platform. Returns the post ID and URL.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to post to"),
      text: z.string().describe("Post text content"),
      mediaUrls: z.array(z.string()).optional().describe("URLs of media to attach"),
      extra: z.record(z.string(), z.unknown()).optional().describe("Platform-specific extras (e.g. reply_to_id)"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) return err(`Platform "${params.platform}" is not configured. Configured: ${[...registry.platforms.keys()].join(", ") || "none"}`);
        return ok(await provider.post({ text: params.text, mediaUrls: params.mediaUrls, extra: params.extra as Record<string, unknown> }));
      } catch (e) { return err(e); }
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
        if (!provider) { results[platform] = { error: "Not configured" }; continue; }
        try { results[platform] = await provider.post({ text: params.text, mediaUrls: params.mediaUrls }); }
        catch (e) { results[platform] = { error: String(e) }; }
      }
      return ok(results);
    },
  );

  server.tool(
    "post_thread",
    "Post a thread (multiple connected posts) on a platform that supports threads.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to post the thread on"),
      posts: z.array(z.object({
        text: z.string().describe("Text for this post in the thread"),
        mediaUrls: z.array(z.string()).optional().describe("Media URLs for this post"),
      })).describe("Ordered list of posts in the thread"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) return err(`Platform "${params.platform}" is not configured`);
        if (!provider.postThread) return err(`Platform "${params.platform}" does not support threads`);
        return ok(await provider.postThread(params.posts));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "post_poll",
    "Create a poll on a platform that supports polls.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to create the poll on"),
      question: z.string().describe("The poll question"),
      options: z.array(z.string()).describe("Poll answer options (2-4)"),
      durationMinutes: z.number().describe("How long the poll should run (in minutes)"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) return err(`Platform "${params.platform}" is not configured`);
        if (!provider.postPoll) return err(`Platform "${params.platform}" does not support polls`);
        return ok(await provider.postPoll({
          question: params.question,
          options: params.options.map((text) => ({ text })),
          durationMinutes: params.durationMinutes,
        }));
      } catch (e) { return err(e); }
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
        if (!provider) return err(`Platform "${params.platform}" not configured`);
        await provider.deletePost(params.postId);
        return ok({ deleted: true, postId: params.postId, platform: params.platform });
      } catch (e) { return err(e); }
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
        if (!provider) return err(`Platform "${params.platform}" not configured`);
        return ok(await provider.getPost(params.postId));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_configured_platforms",
    "List all currently configured and available social media platforms.",
    {},
    async () => ok({
      configuredPlatforms: [...registry.platforms.keys()],
      availablePlatforms: PLATFORM_NAMES,
    }),
  );

  // ========================================================================
  // ENGAGEMENT (via platform providers)
  // ========================================================================

  server.tool(
    "get_mentions",
    "Get recent mentions of your account on a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to check mentions on"),
      sinceId: z.string().optional().describe("Only return mentions after this ID"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) return err(`Platform "${params.platform}" not configured`);
        if (!provider.getMentions) return err(`Platform "${params.platform}" does not support getMentions`);
        return ok(await provider.getMentions(params.sinceId));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_comments",
    "Get comments on a specific post.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform the post is on"),
      postId: z.string().describe("ID of the post to get comments for"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) return err(`Platform "${params.platform}" not configured`);
        if (!provider.getComments) return err(`Platform "${params.platform}" does not support getComments`);
        return ok(await provider.getComments(params.postId));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "reply_to_post",
    "Reply to a post or comment on a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform the post is on"),
      postId: z.string().describe("ID of the post to reply to"),
      text: z.string().describe("Reply text"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) return err(`Platform "${params.platform}" not configured`);
        if (!provider.reply) return err(`Platform "${params.platform}" does not support reply`);
        return ok(await provider.reply(params.postId, params.text));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "like_post",
    "Like a post on a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform the post is on"),
      postId: z.string().describe("ID of the post to like"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) return err(`Platform "${params.platform}" not configured`);
        if (!provider.likePost) return err(`Platform "${params.platform}" does not support likePost`);
        await provider.likePost(params.postId);
        return ok({ liked: true, postId: params.postId, platform: params.platform });
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "unlike_post",
    "Remove a like from a post on a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform the post is on"),
      postId: z.string().describe("ID of the post to unlike"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) return err(`Platform "${params.platform}" not configured`);
        if (!provider.unlikePost) return err(`Platform "${params.platform}" does not support unlikePost`);
        await provider.unlikePost(params.postId);
        return ok({ unliked: true, postId: params.postId, platform: params.platform });
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_direct_messages",
    "Get direct messages from a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to get DMs from"),
      conversationId: z.string().optional().describe("Specific conversation to fetch"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) return err(`Platform "${params.platform}" not configured`);
        if (!provider.getDirectMessages) return err(`Platform "${params.platform}" does not support getDirectMessages`);
        return ok(await provider.getDirectMessages(params.conversationId));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "send_direct_message",
    "Send a direct message to a user on a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to send the DM on"),
      recipientId: z.string().describe("ID of the recipient"),
      text: z.string().describe("Message text"),
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) return err(`Platform "${params.platform}" not configured`);
        if (!provider.sendDirectMessage) return err(`Platform "${params.platform}" does not support sendDirectMessage`);
        return ok(await provider.sendDirectMessage(params.recipientId, params.text));
      } catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // SCHEDULING
  // ========================================================================

  server.tool(
    "schedule_post",
    "Schedule a post to be published at a future time on one or more platforms.",
    {
      text: z.string().describe("Post text content"),
      platforms: z.array(z.enum(PLATFORM_NAMES)).describe("Platforms to post to"),
      scheduledAt: z.string().describe("ISO-8601 datetime for when to publish"),
      mediaUrls: z.array(z.string()).optional().describe("URLs of media to attach"),
      campaignId: z.string().optional().describe("Associate with a campaign"),
    },
    async (params) => {
      try {
        return ok(await registry.scheduling.schedule({
          content: { text: params.text, mediaUrls: params.mediaUrls },
          platforms: params.platforms as PlatformName[],
          scheduledAt: params.scheduledAt,
          campaignId: params.campaignId,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "cancel_scheduled_post",
    "Cancel a previously scheduled post.",
    { scheduleId: z.string().describe("ID of the scheduled post to cancel") },
    async (params) => {
      try {
        await registry.scheduling.cancel(params.scheduleId);
        return ok({ cancelled: true, scheduleId: params.scheduleId });
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_scheduled_posts",
    "List all scheduled posts, optionally filtered by campaign or status.",
    {
      campaignId: z.string().optional().describe("Filter by campaign ID"),
      status: z.string().optional().describe("Filter by status (pending, published, failed, cancelled)"),
    },
    async (params) => {
      try {
        return ok(await registry.scheduling.list({
          campaignId: params.campaignId,
          status: params.status,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_scheduled_post",
    "Get the details and status of a specific scheduled post.",
    { scheduleId: z.string().describe("ID of the scheduled post") },
    async (params) => {
      try { return ok(await registry.scheduling.get(params.scheduleId)); }
      catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // ANALYTICS & POST HISTORY
  // ========================================================================

  server.tool(
    "get_post_metrics",
    "Get engagement metrics (likes, shares, comments, impressions) for a specific post.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform the post is on"),
      postId: z.string().describe("ID of the post"),
    },
    async (params) => {
      try { return ok(await registry.analytics.getPostMetrics(params.platform as PlatformName, params.postId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "sync_posts",
    "Pull recent posts from a platform into local storage for historical analysis. Run this periodically to build post history.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to sync from"),
      limit: z.number().optional().describe("Max number of posts to sync (default 50)"),
    },
    async (params) => {
      try { return ok(await registry.analytics.syncPosts(params.platform as PlatformName, params.limit)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_post_history",
    "Query locally-stored post history for a platform. Use sync_posts first to populate.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to get history for"),
      limit: z.number().optional().describe("Number of posts to return (default 50)"),
      offset: z.number().optional().describe("Offset for pagination"),
    },
    async (params) => {
      try { return ok(await registry.analytics.getPostHistory(params.platform as PlatformName, params.limit ?? 50, params.offset)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_audience_insights",
    "Get audience insights for a platform — follower demographics, growth, best posting times.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to get audience data for"),
    },
    async (params) => {
      try { return ok(await registry.analytics.getAudienceInsights(params.platform as PlatformName)); }
      catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // MEDIA
  // ========================================================================

  server.tool(
    "search_stock_media",
    "Search for stock photos from Unsplash to use in social media posts.",
    {
      query: z.string().describe("Search query for images"),
      count: z.number().optional().describe("Number of results (default 10)"),
    },
    async (params) => {
      try {
        if (!registry.media.searchStock) return err("Stock search is not available");
        return ok(await registry.media.searchStock(params.query, params.count));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "upload_media",
    "Upload media from a URL to Cloudinary for use in posts.",
    {
      sourceUrl: z.string().describe("URL of the file to upload"),
      filename: z.string().optional().describe("Custom filename/public_id"),
      tags: z.array(z.string()).optional().describe("Tags for organizing media"),
    },
    async (params) => {
      try { return ok(await registry.media.upload(params.sourceUrl, params.filename, params.tags)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_media",
    "List uploaded media, optionally filtered by tags or MIME type.",
    {
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      mimeType: z.string().optional().describe("Filter by MIME type (e.g. image/jpeg)"),
    },
    async (params) => {
      try { return ok(await registry.media.list({ tags: params.tags, mimeType: params.mimeType })); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_media",
    "Get details of a specific media item.",
    { mediaId: z.string().describe("ID of the media item") },
    async (params) => {
      try { return ok(await registry.media.get(params.mediaId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "delete_media",
    "Delete a media item from Cloudinary and local catalog.",
    { mediaId: z.string().describe("ID of the media item to delete") },
    async (params) => {
      try {
        await registry.media.delete(params.mediaId);
        return ok({ deleted: true, mediaId: params.mediaId });
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "resize_media",
    "Get a resized version of an image via Cloudinary transformations.",
    {
      mediaId: z.string().describe("ID of the media item to resize"),
      width: z.number().describe("Target width in pixels"),
      height: z.number().describe("Target height in pixels"),
    },
    async (params) => {
      try { return ok(await registry.media.resize(params.mediaId, params.width, params.height)); }
      catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // TRENDS & HASHTAGS
  // ========================================================================

  server.tool(
    "get_trending_topics",
    "Get trending topics from Google Trends, Reddit, or a specific platform.",
    {
      source: z.enum(TREND_SOURCES).describe("Trend source (google, reddit, or a platform name)"),
      region: z.string().optional().describe("Region/country code for localized trends (e.g. US, GB)"),
    },
    async (params) => {
      try { return ok(await registry.trends.getTrending(params.source as TrendSource, params.region)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "lookup_hashtag",
    "Look up information about a specific hashtag — post count, growth, related tags.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to look up the hashtag on"),
      tag: z.string().describe("Hashtag to look up (without #)"),
    },
    async (params) => {
      try { return ok(await registry.trends.lookupHashtag(params.platform as PlatformName, params.tag)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "suggest_hashtags",
    "Suggest relevant hashtags for a piece of text based on keyword extraction.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Target platform"),
      text: z.string().describe("Text to suggest hashtags for"),
    },
    async (params) => {
      try { return ok(await registry.trends.suggestHashtags(params.platform as PlatformName, params.text)); }
      catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // IDEAS PIPELINE
  // ========================================================================

  server.tool(
    "create_idea",
    "Create a new content idea. Ideas flow through: idea → draft → pending_review → approved → scheduled → published.",
    {
      content: z.string().describe("The idea text/content"),
      platforms: z.array(z.enum(PLATFORM_NAMES)).describe("Target platforms"),
      mediaUrls: z.array(z.string()).optional().describe("Media URLs for the idea"),
      campaignId: z.string().optional().describe("Associate with a campaign"),
      tags: z.array(z.string()).optional().describe("Tags for organizing ideas"),
      notes: z.string().optional().describe("Internal notes"),
    },
    async (params) => {
      try {
        return ok(await registry.ideas.create({
          content: params.content,
          platforms: params.platforms as PlatformName[],
          mediaUrls: params.mediaUrls,
          campaignId: params.campaignId,
          tags: params.tags,
          notes: params.notes,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_idea",
    "Get details of a specific idea.",
    { ideaId: z.string().describe("ID of the idea") },
    async (params) => {
      try { return ok(await registry.ideas.get(params.ideaId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_idea",
    "Update an idea's content or metadata.",
    {
      ideaId: z.string().describe("ID of the idea to update"),
      content: z.string().optional().describe("New content text"),
      platforms: z.array(z.enum(PLATFORM_NAMES)).optional().describe("New target platforms"),
      mediaUrls: z.array(z.string()).optional().describe("New media URLs"),
      campaignId: z.string().optional().describe("New campaign association"),
      scheduledAt: z.string().optional().describe("Scheduled publish time (ISO-8601)"),
      tags: z.array(z.string()).optional().describe("New tags"),
      notes: z.string().optional().describe("New notes"),
    },
    async (params) => {
      try {
        return ok(await registry.ideas.update(params.ideaId, {
          content: params.content,
          platforms: params.platforms as PlatformName[] | undefined,
          mediaUrls: params.mediaUrls,
          campaignId: params.campaignId,
          scheduledAt: params.scheduledAt,
          tags: params.tags,
          notes: params.notes,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "delete_idea",
    "Delete an idea.",
    { ideaId: z.string().describe("ID of the idea to delete") },
    async (params) => {
      try { await registry.ideas.delete(params.ideaId); return ok({ deleted: true }); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_ideas",
    "List ideas, optionally filtered by status, campaign, or tags.",
    {
      status: z.enum(IDEA_STATUSES).optional().describe("Filter by pipeline status"),
      campaignId: z.string().optional().describe("Filter by campaign"),
      tags: z.array(z.string()).optional().describe("Filter by tags (any match)"),
    },
    async (params) => {
      try {
        return ok(await registry.ideas.list({
          status: params.status as IdeaStatus | undefined,
          campaignId: params.campaignId,
          tags: params.tags,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "advance_idea",
    "Advance an idea through the pipeline. Valid transitions: idea→draft, draft→pending_review, pending_review→approved/rejected, approved→scheduled, scheduled→published.",
    {
      ideaId: z.string().describe("ID of the idea to advance"),
      targetStatus: z.enum(IDEA_STATUSES).describe("Target status to move to"),
      notes: z.string().optional().describe("Notes for this status change (e.g. review feedback)"),
    },
    async (params) => {
      try { return ok(await registry.ideas.advance(params.ideaId, params.targetStatus as IdeaStatus, params.notes)); }
      catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // CAMPAIGNS & CONTENT CALENDAR
  // ========================================================================

  server.tool(
    "create_campaign",
    "Create a new content campaign to organize posts around a theme or goal.",
    {
      name: z.string().describe("Campaign name"),
      description: z.string().optional().describe("Campaign description"),
      startDate: z.string().describe("Campaign start date (ISO-8601)"),
      endDate: z.string().describe("Campaign end date (ISO-8601)"),
      platforms: z.array(z.enum(PLATFORM_NAMES)).describe("Platforms for this campaign"),
      status: z.enum(["draft", "active", "paused", "completed"]).optional().describe("Initial status (default: draft)"),
      tags: z.array(z.string()).optional().describe("Tags for organizing campaigns"),
    },
    async (params) => {
      try {
        return ok(await registry.campaigns.create({
          name: params.name,
          description: params.description,
          startDate: params.startDate,
          endDate: params.endDate,
          platforms: params.platforms as PlatformName[],
          status: params.status ?? "draft",
          tags: params.tags,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_campaign",
    "Get details of a specific campaign.",
    { campaignId: z.string().describe("ID of the campaign") },
    async (params) => {
      try { return ok(await registry.campaigns.get(params.campaignId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_campaign",
    "Update a campaign's details.",
    {
      campaignId: z.string().describe("ID of the campaign to update"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      status: z.enum(["draft", "active", "paused", "completed"]).optional().describe("New status"),
      endDate: z.string().optional().describe("New end date"),
      tags: z.array(z.string()).optional().describe("New tags"),
    },
    async (params) => {
      try {
        return ok(await registry.campaigns.update(params.campaignId, {
          name: params.name,
          description: params.description,
          status: params.status,
          endDate: params.endDate,
          tags: params.tags,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "delete_campaign",
    "Delete a campaign.",
    { campaignId: z.string().describe("ID of the campaign to delete") },
    async (params) => {
      try { await registry.campaigns.delete(params.campaignId); return ok({ deleted: true }); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_campaigns",
    "List all campaigns, optionally filtered by status.",
    { status: z.enum(["draft", "active", "paused", "completed"]).optional().describe("Filter by status") },
    async (params) => {
      try { return ok(await registry.campaigns.list(params.status ? { status: params.status } : undefined)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_content_calendar",
    "Get a unified calendar view of all ideas, scheduled posts, and published content for a date range.",
    {
      startDate: z.string().describe("Start date (ISO-8601)"),
      endDate: z.string().describe("End date (ISO-8601)"),
      platform: z.enum(PLATFORM_NAMES).optional().describe("Filter to a specific platform"),
    },
    async (params) => {
      try { return ok(await registry.campaigns.getCalendar(params.startDate, params.endDate, params.platform as PlatformName | undefined)); }
      catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // LINK MANAGEMENT
  // ========================================================================

  server.tool(
    "shorten_link",
    "Shorten a URL using Dub.co for use in social media posts.",
    {
      url: z.string().describe("URL to shorten"),
      customAlias: z.string().optional().describe("Custom short alias"),
    },
    async (params) => {
      try { return ok(await registry.links.shorten(params.url, params.customAlias)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "add_utm_params",
    "Add UTM tracking parameters to a URL for campaign attribution.",
    {
      url: z.string().describe("URL to add UTM parameters to"),
      source: z.string().describe("UTM source (e.g. twitter, newsletter)"),
      medium: z.string().describe("UTM medium (e.g. social, email)"),
      campaign: z.string().describe("UTM campaign name"),
      term: z.string().optional().describe("UTM term"),
      content: z.string().optional().describe("UTM content (for A/B testing)"),
    },
    async (params) => {
      try {
        return ok({ url: await registry.links.addUTM(params.url, {
          source: params.source,
          medium: params.medium,
          campaign: params.campaign,
          term: params.term,
          content: params.content,
        })});
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_link_stats",
    "Get click statistics for a shortened link.",
    { linkId: z.string().describe("ID of the shortened link") },
    async (params) => {
      try { return ok(await registry.links.getLinkStats(params.linkId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_links",
    "List all shortened links and their stats.",
    {},
    async () => {
      try { return ok(await registry.links.listLinks()); }
      catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // BRAND MONITORING
  // ========================================================================

  server.tool(
    "search_brand_mentions",
    "Search for mentions of a brand, keyword, or topic across social media using Social Searcher.",
    {
      query: z.string().describe("Search query (brand name, keyword, etc.)"),
      platform: z.enum(PLATFORM_NAMES).optional().describe("Filter to a specific platform"),
      since: z.string().optional().describe("Only return mentions after this date (ISO-8601)"),
    },
    async (params) => {
      try { return ok(await registry.monitoring.searchMentions(params.query, params.platform as PlatformName | undefined, params.since)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "analyze_sentiment",
    "Analyze sentiment of mentions for a brand or keyword.",
    {
      query: z.string().describe("Brand name or keyword to analyze sentiment for"),
      platform: z.enum(PLATFORM_NAMES).optional().describe("Filter to a specific platform"),
      since: z.string().optional().describe("Start date for analysis (ISO-8601)"),
    },
    async (params) => {
      try { return ok(await registry.monitoring.analyzeSentiment(params.query, params.platform as PlatformName | undefined, params.since)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_competitor_profile",
    "Get a competitor's profile and recent activity on a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to look up"),
      handle: z.string().describe("Competitor's handle/username"),
    },
    async (params) => {
      try { return ok(await registry.monitoring.getCompetitorProfile(params.platform as PlatformName, params.handle)); }
      catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // BRAND CONTEXT
  // ========================================================================

  server.tool(
    "set_brand_context",
    "Store a brand context value (e.g. brand_voice, target_audience, content_guidelines). Persists across sessions.",
    {
      key: z.string().describe("Context key (e.g. brand_voice, target_audience, content_pillars)"),
      value: z.string().describe("Context value"),
    },
    async (params) => {
      try {
        await registry.brandContext.set(params.key, params.value);
        return ok({ saved: true, key: params.key });
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_brand_context",
    "Retrieve a specific brand context value.",
    { key: z.string().describe("Context key to retrieve") },
    async (params) => {
      try {
        const value = await registry.brandContext.get(params.key);
        if (value === null) return ok({ key: params.key, value: null, found: false });
        return ok({ key: params.key, value, found: true });
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_brand_context",
    "List all stored brand context key-value pairs.",
    {},
    async () => {
      try { return ok(await registry.brandContext.getAll()); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "delete_brand_context",
    "Delete a brand context key.",
    { key: z.string().describe("Context key to delete") },
    async (params) => {
      try {
        await registry.brandContext.delete(params.key);
        return ok({ deleted: true, key: params.key });
      } catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // PROFILE MANAGEMENT
  // ========================================================================

  server.tool(
    "list_accounts",
    "List all configured social media accounts across all platforms.",
    {},
    async () => {
      try { return ok(await registry.profile.listAccounts()); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_profile",
    "Get the profile details for an account on a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to get profile for"),
      accountId: z.string().optional().describe("Specific account ID (uses default if omitted)"),
    },
    async (params) => {
      try { return ok(await registry.profile.getProfile(params.platform as PlatformName, params.accountId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_profile",
    "Update profile information (display name, bio, avatar) on a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to update profile on"),
      displayName: z.string().optional().describe("New display name"),
      bio: z.string().optional().describe("New bio/description"),
      avatarUrl: z.string().optional().describe("New avatar image URL"),
      accountId: z.string().optional().describe("Specific account ID (uses default if omitted)"),
    },
    async (params) => {
      try {
        return ok(await registry.profile.updateProfile(
          params.platform as PlatformName,
          { displayName: params.displayName, bio: params.bio, avatarUrl: params.avatarUrl },
          params.accountId,
        ));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "set_default_account",
    "Set which account to use by default for a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform"),
      accountId: z.string().describe("Account ID to set as default"),
    },
    async (params) => {
      try {
        await registry.profile.setDefaultAccount(params.platform as PlatformName, params.accountId);
        return ok({ success: true, platform: params.platform, defaultAccountId: params.accountId });
      } catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // RATE LIMITING
  // ========================================================================

  server.tool(
    "check_rate_limit",
    "Check the rate limit status for a specific platform endpoint.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to check"),
      endpoint: z.string().describe("Endpoint type (e.g. 'post', 'read')"),
    },
    async (params) => {
      try { return ok(await registry.rateLimiter.checkLimit(params.platform as PlatformName, params.endpoint)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_rate_limit_status",
    "Get rate limit status across all platforms and endpoints.",
    {},
    async () => {
      try { return ok(await registry.rateLimiter.getStatus()); }
      catch (e) { return err(e); }
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
