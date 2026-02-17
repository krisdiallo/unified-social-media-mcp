#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Unified Social Media MCP Server
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { loadConfig } from "./config/index.js";
import { buildRegistry } from "./registry.js";
import type { PlatformName, DraftStatus } from "./types.js";

const PLATFORM_NAMES = ["twitter", "bluesky", "linkedin", "facebook"] as const;
const DRAFT_STATUSES = ["draft", "pending_review", "approved", "rejected", "published"] as const;

// Helper to wrap tool handlers with consistent error handling
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
    version: "0.2.0",
  });

  // ========================================================================
  // CONTENT GENERATION
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
        return ok(await registry.contentGeneration.generate({
          topic: params.topic,
          platform: params.platform as PlatformName,
          tone: params.tone,
          maxLength: params.maxLength,
          hashtags: params.hashtags,
          context: params.context,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "repurpose_content",
    "Adapt a post originally written for one platform to work on other platforms. Adjusts length, tone, and format for each target.",
    {
      originalText: z.string().describe("The original post text"),
      sourcePlatform: z.enum(PLATFORM_NAMES).describe("Platform the original was written for"),
      targetPlatforms: z.array(z.enum(PLATFORM_NAMES)).describe("Platforms to adapt the content for"),
      tone: z.string().optional().describe("Override tone for all adaptations"),
    },
    async (params) => {
      try {
        return ok(await registry.contentGeneration.repurpose({
          originalText: params.originalText,
          sourcePlatform: params.sourcePlatform as PlatformName,
          targetPlatforms: params.targetPlatforms as PlatformName[],
          tone: params.tone,
        }));
      } catch (e) { return err(e); }
    },
  );

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
    },
    async (params) => {
      try {
        const provider = registry.platforms.get(params.platform as PlatformName);
        if (!provider) return err(`Platform "${params.platform}" is not configured. Configured: ${[...registry.platforms.keys()].join(", ") || "none"}`);
        return ok(await provider.post({ text: params.text, mediaUrls: params.mediaUrls }));
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
        if (!provider) { results[platform] = { error: `Not configured` }; continue; }
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
  // ENGAGEMENT / COMMUNITY MANAGEMENT
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
        return ok(await registry.engagement.getMentions(params.platform as PlatformName, params.sinceId));
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
        return ok(await registry.engagement.getComments(params.platform as PlatformName, params.postId));
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
        return ok(await registry.engagement.reply({
          platform: params.platform as PlatformName,
          postId: params.postId,
          text: params.text,
        }));
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
        return ok(await registry.engagement.getDirectMessages(params.platform as PlatformName, params.conversationId));
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
        return ok(await registry.engagement.sendDirectMessage(params.platform as PlatformName, params.recipientId, params.text));
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
        await registry.engagement.likePost(params.platform as PlatformName, params.postId);
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
        await registry.engagement.unlikePost(params.platform as PlatformName, params.postId);
        return ok({ unliked: true, postId: params.postId, platform: params.platform });
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
  // ANALYTICS
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
    "get_analytics_summary",
    "Get an analytics summary for a platform over a time period.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to get analytics for"),
      periodStart: z.string().describe("Start of period (ISO-8601 date)"),
      periodEnd: z.string().describe("End of period (ISO-8601 date)"),
    },
    async (params) => {
      try { return ok(await registry.analytics.getSummary(params.platform as PlatformName, params.periodStart, params.periodEnd)); }
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
    "search_media",
    "Search for stock photos/images to use in social media posts.",
    {
      query: z.string().describe("Search query for images"),
      count: z.number().optional().describe("Number of results (default 5)"),
    },
    async (params) => {
      try { return ok(await registry.media.search({ query: params.query, count: params.count })); }
      catch (e) { return err(e); }
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
      try { return ok(await registry.media.resize({ url: params.url, width: params.width, height: params.height })); }
      catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // HASHTAG & TREND RESEARCH
  // ========================================================================

  server.tool(
    "get_trending_topics",
    "Get trending topics on a platform, optionally filtered by region.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to check trends on"),
      region: z.string().optional().describe("Region/country code for localized trends"),
    },
    async (params) => {
      try { return ok(await registry.trends.getTrending(params.platform as PlatformName, params.region)); }
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
    "Suggest relevant hashtags for a piece of text.",
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
        return ok(await registry.campaigns.createCampaign({
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
      try { return ok(await registry.campaigns.getCampaign(params.campaignId)); }
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
        return ok(await registry.campaigns.updateCampaign(params.campaignId, {
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
      try { await registry.campaigns.deleteCampaign(params.campaignId); return ok({ deleted: true }); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_campaigns",
    "List all campaigns, optionally filtered by status.",
    { status: z.enum(["draft", "active", "paused", "completed"]).optional().describe("Filter by status") },
    async (params) => {
      try { return ok(await registry.campaigns.listCampaigns(params.status ? { status: params.status } : undefined)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_content_calendar",
    "Get a calendar view of all scheduled content for a date range.",
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
    "Shorten a URL for use in social media posts.",
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
  // DRAFT / APPROVAL WORKFLOW
  // ========================================================================

  server.tool(
    "create_draft",
    "Create a draft post for review before publishing.",
    {
      text: z.string().describe("Post text content"),
      platforms: z.array(z.enum(PLATFORM_NAMES)).describe("Target platforms"),
      scheduledAt: z.string().optional().describe("When to publish after approval (ISO-8601)"),
      campaignId: z.string().optional().describe("Associate with a campaign"),
      createdBy: z.string().optional().describe("Who created the draft"),
    },
    async (params) => {
      try {
        return ok(await registry.workflow.createDraft({
          content: { text: params.text },
          platforms: params.platforms as PlatformName[],
          scheduledAt: params.scheduledAt,
          campaignId: params.campaignId,
          createdBy: params.createdBy,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_draft",
    "Get details of a draft post.",
    { draftId: z.string().describe("ID of the draft") },
    async (params) => {
      try { return ok(await registry.workflow.getDraft(params.draftId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_draft",
    "Update a draft post's content or metadata.",
    {
      draftId: z.string().describe("ID of the draft to update"),
      text: z.string().optional().describe("New post text"),
      platforms: z.array(z.enum(PLATFORM_NAMES)).optional().describe("New target platforms"),
      scheduledAt: z.string().optional().describe("New scheduled time"),
      campaignId: z.string().optional().describe("New campaign association"),
    },
    async (params) => {
      try {
        return ok(await registry.workflow.updateDraft(params.draftId, {
          content: params.text ? { text: params.text } : undefined,
          platforms: params.platforms as PlatformName[] | undefined,
          scheduledAt: params.scheduledAt,
          campaignId: params.campaignId,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "submit_draft_for_review",
    "Submit a draft for review/approval.",
    { draftId: z.string().describe("ID of the draft to submit") },
    async (params) => {
      try { return ok(await registry.workflow.submitForReview(params.draftId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "approve_draft",
    "Approve a draft that's pending review.",
    {
      draftId: z.string().describe("ID of the draft to approve"),
      notes: z.string().optional().describe("Approval notes"),
    },
    async (params) => {
      try { return ok(await registry.workflow.approve(params.draftId, params.notes)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "reject_draft",
    "Reject a draft that's pending review, with feedback.",
    {
      draftId: z.string().describe("ID of the draft to reject"),
      notes: z.string().describe("Reason for rejection / feedback"),
    },
    async (params) => {
      try { return ok(await registry.workflow.reject(params.draftId, params.notes)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_drafts",
    "List all drafts, optionally filtered by status or campaign.",
    {
      status: z.enum(DRAFT_STATUSES).optional().describe("Filter by draft status"),
      campaignId: z.string().optional().describe("Filter by campaign"),
    },
    async (params) => {
      try {
        return ok(await registry.workflow.listDrafts({
          status: params.status as DraftStatus | undefined,
          campaignId: params.campaignId,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "delete_draft",
    "Delete a draft post.",
    { draftId: z.string().describe("ID of the draft to delete") },
    async (params) => {
      try { await registry.workflow.deleteDraft(params.draftId); return ok({ deleted: true }); }
      catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // TEMPLATES
  // ========================================================================

  server.tool(
    "create_template",
    "Create a reusable content template with variable placeholders (e.g. {{product_name}}).",
    {
      name: z.string().describe("Template name"),
      description: z.string().optional().describe("Template description"),
      content: z.string().describe("Template content with {{variable}} placeholders"),
      platforms: z.array(z.enum(PLATFORM_NAMES)).describe("Platforms this template is designed for"),
      variables: z.array(z.string()).describe("Variable names used in the template"),
      tags: z.array(z.string()).optional().describe("Tags for organizing templates"),
    },
    async (params) => {
      try {
        return ok(await registry.templates.createTemplate({
          name: params.name,
          description: params.description,
          content: params.content,
          platforms: params.platforms as PlatformName[],
          variables: params.variables,
          tags: params.tags,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_template",
    "Get a specific content template.",
    { templateId: z.string().describe("ID of the template") },
    async (params) => {
      try { return ok(await registry.templates.getTemplate(params.templateId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_templates",
    "List all content templates, optionally filtered by platform or tags.",
    {
      platform: z.enum(PLATFORM_NAMES).optional().describe("Filter by platform"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
    },
    async (params) => {
      try {
        return ok(await registry.templates.listTemplates({
          platform: params.platform as PlatformName | undefined,
          tags: params.tags,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "render_template",
    "Render a template by substituting variables with provided values.",
    {
      templateId: z.string().describe("ID of the template to render"),
      variables: z.record(z.string(), z.string()).describe("Variable values (key-value pairs)"),
    },
    async (params) => {
      try { return ok({ rendered: await registry.templates.renderTemplate(params.templateId, params.variables as Record<string, string>) }); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_template",
    "Update an existing content template.",
    {
      templateId: z.string().describe("ID of the template to update"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      content: z.string().optional().describe("New template content"),
      platforms: z.array(z.enum(PLATFORM_NAMES)).optional().describe("New platforms"),
      variables: z.array(z.string()).optional().describe("New variables list"),
      tags: z.array(z.string()).optional().describe("New tags"),
    },
    async (params) => {
      try {
        return ok(await registry.templates.updateTemplate(params.templateId, {
          name: params.name,
          description: params.description,
          content: params.content,
          platforms: params.platforms as PlatformName[] | undefined,
          variables: params.variables,
          tags: params.tags,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "delete_template",
    "Delete a content template.",
    { templateId: z.string().describe("ID of the template to delete") },
    async (params) => {
      try { await registry.templates.deleteTemplate(params.templateId); return ok({ deleted: true }); }
      catch (e) { return err(e); }
    },
  );

  // ========================================================================
  // BRAND MONITORING / COMPETITOR ANALYSIS
  // ========================================================================

  server.tool(
    "search_brand_mentions",
    "Search for mentions of a brand, keyword, or topic on a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to search on"),
      query: z.string().describe("Search query (brand name, keyword, etc.)"),
      since: z.string().optional().describe("Only return mentions after this date (ISO-8601)"),
    },
    async (params) => {
      try { return ok(await registry.monitoring.searchMentions(params.platform as PlatformName, params.query, params.since)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "analyze_sentiment",
    "Analyze sentiment of mentions for a brand or keyword on a platform.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform to analyze"),
      query: z.string().describe("Brand name or keyword to analyze sentiment for"),
      since: z.string().optional().describe("Start date for analysis (ISO-8601)"),
    },
    async (params) => {
      try { return ok(await registry.monitoring.analyzeSentiment(params.platform as PlatformName, params.query, params.since)); }
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
  // REPORTING & EXPORT
  // ========================================================================

  server.tool(
    "generate_report",
    "Generate a comprehensive analytics report across platforms for a time period.",
    {
      platforms: z.array(z.enum(PLATFORM_NAMES)).describe("Platforms to include"),
      periodStart: z.string().describe("Report start date (ISO-8601)"),
      periodEnd: z.string().describe("Report end date (ISO-8601)"),
      includeMetrics: z.boolean().optional().describe("Include engagement metrics (default true)"),
      includeAudience: z.boolean().optional().describe("Include audience insights"),
      includeCampaigns: z.boolean().optional().describe("Include campaign data"),
      includeTopPosts: z.boolean().optional().describe("Include top-performing posts"),
      format: z.enum(["json", "csv", "markdown"]).describe("Output format"),
    },
    async (params) => {
      try {
        return ok(await registry.reporting.generateReport({
          platforms: params.platforms as PlatformName[],
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
          includeMetrics: params.includeMetrics ?? true,
          includeAudience: params.includeAudience,
          includeCampaigns: params.includeCampaigns,
          includeTopPosts: params.includeTopPosts,
          format: params.format,
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "export_post_data",
    "Export metrics data for specific posts in JSON or CSV format.",
    {
      platform: z.enum(PLATFORM_NAMES).describe("Platform the posts are on"),
      postIds: z.array(z.string()).describe("IDs of posts to export data for"),
      format: z.enum(["json", "csv"]).describe("Export format"),
    },
    async (params) => {
      try {
        const data = await registry.reporting.exportPostData(params.platform as PlatformName, params.postIds, params.format);
        return { content: [{ type: "text" as const, text: data }] };
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
