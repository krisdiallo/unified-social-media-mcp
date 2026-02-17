// ---------------------------------------------------------------------------
// Engagement provider — delegates to platform APIs for community management
// ---------------------------------------------------------------------------

import type {
  EngagementProvider,
  Mention,
  Comment,
  DirectMessage,
  ReplyRequest,
  PostResult,
  PlatformName,
  PlatformProvider,
} from "../../types.js";

/**
 * Platform-native engagement provider.
 *
 * Each method delegates to the relevant platform's API. In a real
 * implementation you'd make HTTP calls to Twitter's mentions timeline,
 * Bluesky's notifications, LinkedIn's social actions, etc.
 *
 * Swap this out for a unified community management tool (e.g. Sprinklr,
 * Hootsuite Inbox) by implementing the EngagementProvider interface.
 */
export class PlatformEngagementProvider implements EngagementProvider {
  readonly name = "platform-native";

  constructor(
    private platformProviders: Map<PlatformName, PlatformProvider>,
  ) {}

  async getMentions(platform: PlatformName, sinceId?: string): Promise<Mention[]> {
    this.requirePlatform(platform);
    // Twitter: GET /2/users/:id/mentions
    // Bluesky: app.bsky.notification.listNotifications (filter reason=mention)
    // LinkedIn: GET /socialActions/{postUrn}/comments (mentions embedded)
    // Facebook: GET /{page-id}/tagged
    void sinceId;
    return [];
  }

  async getComments(platform: PlatformName, postId: string): Promise<Comment[]> {
    this.requirePlatform(platform);
    // Twitter: GET /2/tweets/:id with conversation lookup
    // Bluesky: app.bsky.feed.getPostThread
    // LinkedIn: GET /socialActions/{postUrn}/comments
    // Facebook: GET /{post-id}/comments
    void postId;
    return [];
  }

  async reply(request: ReplyRequest): Promise<PostResult> {
    const provider = this.requirePlatform(request.platform);

    // Most platforms accept a reply by posting with a reply-to parameter.
    // We use the platform's post() with extra metadata.
    return provider.post({
      text: request.text,
      extra: { reply_to: request.postId },
    });
  }

  async getDirectMessages(platform: PlatformName, conversationId?: string): Promise<DirectMessage[]> {
    this.requirePlatform(platform);
    // Twitter: GET /2/dm_conversations or /2/dm_events
    // Facebook: GET /{page-id}/conversations (Messenger API)
    // LinkedIn: messaging API (restricted access)
    // Bluesky: no DM API yet
    void conversationId;
    return [];
  }

  async sendDirectMessage(platform: PlatformName, recipientId: string, text: string): Promise<DirectMessage> {
    this.requirePlatform(platform);
    void recipientId;
    // Placeholder — real implementation calls platform DM endpoints
    return {
      id: `dm-${Date.now()}`,
      platform,
      senderId: "self",
      senderHandle: "self",
      text,
      createdAt: new Date().toISOString(),
    };
  }

  async likePost(platform: PlatformName, postId: string): Promise<void> {
    this.requirePlatform(platform);
    // Twitter: POST /2/users/:id/likes
    // Bluesky: com.atproto.repo.createRecord (app.bsky.feed.like)
    // LinkedIn: POST /socialActions/{postUrn}/likes
    // Facebook: POST /{post-id}/likes
    void postId;
  }

  async unlikePost(platform: PlatformName, postId: string): Promise<void> {
    this.requirePlatform(platform);
    void postId;
  }

  private requirePlatform(platform: PlatformName): PlatformProvider {
    const provider = this.platformProviders.get(platform);
    if (!provider) {
      throw new Error(`No provider configured for platform: ${platform}`);
    }
    return provider;
  }
}
