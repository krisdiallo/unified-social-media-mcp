// ---------------------------------------------------------------------------
// Shared types for the unified social-media MCP server
// ---------------------------------------------------------------------------

// ---- Common ---------------------------------------------------------------

export type PlatformName = "twitter" | "bluesky" | "linkedin" | "facebook";

// ---- Platform / Posting ---------------------------------------------------

export interface PostContent {
  text: string;
  mediaUrls?: string[];
  /** Platform-specific extras (e.g. reply_to_id, link preview settings). */
  extra?: Record<string, unknown>;
}

export interface PostResult {
  id: string;
  url: string;
  platform: PlatformName;
  createdAt: string;
}

export interface ThreadPost {
  text: string;
  mediaUrls?: string[];
}

export interface ThreadResult {
  threadId: string;
  posts: PostResult[];
  platform: PlatformName;
}

export interface PollOption {
  text: string;
}

export interface PollContent {
  question: string;
  options: PollOption[];
  durationMinutes: number;
}

export interface PostMetrics {
  likes: number;
  shares: number;
  comments: number;
  impressions: number;
  clicks: number;
  [key: string]: number;
}

export interface PlatformProvider {
  readonly name: string;
  readonly platform: PlatformName;
  post(content: PostContent): Promise<PostResult>;
  deletePost(postId: string): Promise<void>;
  getPost(postId: string): Promise<PostResult & { text: string; metrics?: PostMetrics }>;
  postThread?(posts: ThreadPost[]): Promise<ThreadResult>;
  postPoll?(poll: PollContent): Promise<PostResult>;
  // Engagement — each platform implements its own API calls
  getMentions?(sinceId?: string): Promise<Mention[]>;
  getComments?(postId: string): Promise<Comment[]>;
  reply?(postId: string, text: string): Promise<PostResult>;
  likePost?(postId: string): Promise<void>;
  unlikePost?(postId: string): Promise<void>;
  getDirectMessages?(conversationId?: string): Promise<DirectMessage[]>;
  sendDirectMessage?(recipientId: string, text: string): Promise<DirectMessage>;
  // Analytics — platform-specific data access
  getRecentPosts?(limit: number, cursor?: string): Promise<StoredPost[]>;
  getAudienceInsights?(): Promise<AudienceInsights>;
}

// ---- Engagement types -----------------------------------------------------

export interface Mention {
  id: string;
  platform: PlatformName;
  authorId: string;
  authorHandle: string;
  text: string;
  postId?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  platform: PlatformName;
  postId: string;
  authorId: string;
  authorHandle: string;
  text: string;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  platform: PlatformName;
  senderId: string;
  senderHandle: string;
  text: string;
  createdAt: string;
  conversationId?: string;
}

// ---- Content Generation (optional — BYOM for image/video) -----------------

export interface GenerateImageRequest {
  prompt: string;
  width?: number;
  height?: number;
  style?: string;
}

export interface GenerateVideoRequest {
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: string;
}

export interface GeneratedMedia {
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface ContentGenerationProvider {
  readonly name: string;
  generateImage?(request: GenerateImageRequest): Promise<GeneratedMedia>;
  generateVideo?(request: GenerateVideoRequest): Promise<GeneratedMedia>;
}

// ---- Scheduling -----------------------------------------------------------

export interface ScheduledPost {
  id: string;
  content: PostContent;
  platforms: PlatformName[];
  scheduledAt: string;
  status: "pending" | "published" | "failed" | "cancelled";
  campaignId?: string;
  results?: PostResult[];
  error?: string;
  createdAt: string;
}

export interface ScheduleRequest {
  content: PostContent;
  platforms: PlatformName[];
  scheduledAt: string;
  campaignId?: string;
}

export interface SchedulingProvider {
  readonly name: string;
  schedule(request: ScheduleRequest): Promise<ScheduledPost>;
  cancel(scheduleId: string): Promise<void>;
  list(filters?: { campaignId?: string; status?: string }): Promise<ScheduledPost[]>;
  get(scheduleId: string): Promise<ScheduledPost>;
}

// ---- Analytics / Post History ---------------------------------------------

export interface StoredPost {
  id: string;
  platform: PlatformName;
  text: string;
  mediaUrls?: string[];
  createdAt: string;
  metrics?: PostMetrics;
  campaignId?: string;
}

export interface AudienceInsights {
  platform: PlatformName;
  followerCount: number;
  followingCount: number;
  followerGrowth?: { period: string; net: number; gained: number; lost: number };
  demographics?: {
    topCountries?: { country: string; percentage: number }[];
    topCities?: { city: string; percentage: number }[];
    ageRanges?: { range: string; percentage: number }[];
    genderSplit?: Record<string, number>;
  };
  bestPostingTimes?: { day: string; hour: number; engagementRate: number }[];
}

export interface AnalyticsProvider {
  readonly name: string;
  getPostMetrics(platform: PlatformName, postId: string): Promise<PostMetrics>;
  /** Sync recent posts from platform into local storage for historical analysis. */
  syncPosts(platform: PlatformName, limit?: number): Promise<StoredPost[]>;
  /** Query locally-stored post history. */
  getPostHistory(platform: PlatformName, limit: number, offset?: number): Promise<StoredPost[]>;
  getAudienceInsights(platform: PlatformName): Promise<AudienceInsights>;
}

// ---- Media Management -----------------------------------------------------

export interface MediaItem {
  id: string;
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  tags?: string[];
}

export interface MediaProvider {
  readonly name: string;
  /** Search stock images (Unsplash, etc.). */
  searchStock?(query: string, count?: number): Promise<MediaItem[]>;
  /** Upload a file from URL to the media storage backend. */
  upload(sourceUrl: string, filename?: string, tags?: string[]): Promise<MediaItem>;
  /** List user's uploaded media. */
  list(filters?: { tags?: string[]; mimeType?: string }): Promise<MediaItem[]>;
  /** Get a specific media item. */
  get(mediaId: string): Promise<MediaItem>;
  /** Delete a media item. */
  delete(mediaId: string): Promise<void>;
  /** Resize an image. */
  resize(mediaId: string, width: number, height: number): Promise<MediaItem>;
}

// ---- Trend Research -------------------------------------------------------

export type TrendSource = "google" | "reddit" | PlatformName;

export interface TrendingTopic {
  name: string;
  volume?: number;
  url?: string;
  source: TrendSource;
  region?: string;
}

export interface HashtagInfo {
  tag: string;
  postCount?: number;
  recentGrowth?: string;
  relatedTags?: string[];
  source: TrendSource;
}

export interface TrendsProvider {
  readonly name: string;
  getTrending(source: TrendSource, region?: string): Promise<TrendingTopic[]>;
  lookupHashtag(platform: PlatformName, tag: string): Promise<HashtagInfo>;
  suggestHashtags(platform: PlatformName, text: string): Promise<string[]>;
}

// ---- Ideas Pipeline -------------------------------------------------------

export type IdeaStatus = "idea" | "draft" | "pending_review" | "approved" | "rejected" | "scheduled" | "published";

export interface Idea {
  id: string;
  content: string;
  platforms: PlatformName[];
  status: IdeaStatus;
  mediaUrls?: string[];
  campaignId?: string;
  scheduledAt?: string;
  tags?: string[];
  notes?: string;
  createdBy?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdeasProvider {
  readonly name: string;
  create(idea: Omit<Idea, "id" | "status" | "createdAt" | "updatedAt">): Promise<Idea>;
  get(ideaId: string): Promise<Idea>;
  update(ideaId: string, updates: Partial<Pick<Idea, "content" | "platforms" | "mediaUrls" | "campaignId" | "scheduledAt" | "tags" | "notes">>): Promise<Idea>;
  delete(ideaId: string): Promise<void>;
  list(filters?: { status?: IdeaStatus; campaignId?: string; tags?: string[] }): Promise<Idea[]>;
  /** Advance through the pipeline: idea → draft → pending_review → approved/rejected → scheduled → published */
  advance(ideaId: string, targetStatus: IdeaStatus, notes?: string): Promise<Idea>;
}

// ---- Campaign & Content Calendar ------------------------------------------

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  platforms: PlatformName[];
  status: "draft" | "active" | "paused" | "completed";
  tags?: string[];
  createdAt: string;
}

export interface CalendarEntry {
  id: string;
  type: "idea" | "scheduled" | "published";
  date: string;
  platform: PlatformName;
  content: string;
  status: string;
  campaignId?: string;
}

export interface CampaignProvider {
  readonly name: string;
  create(campaign: Omit<Campaign, "id" | "createdAt">): Promise<Campaign>;
  get(campaignId: string): Promise<Campaign>;
  update(campaignId: string, updates: Partial<Pick<Campaign, "name" | "description" | "status" | "endDate" | "tags">>): Promise<Campaign>;
  delete(campaignId: string): Promise<void>;
  list(filters?: { status?: string }): Promise<Campaign[]>;
  getCalendar(startDate: string, endDate: string, platform?: PlatformName): Promise<CalendarEntry[]>;
}

// ---- Link Management (Dub.co) ---------------------------------------------

export interface ShortenedLink {
  id: string;
  originalUrl: string;
  shortUrl: string;
  clicks: number;
  createdAt: string;
}

export interface UTMParams {
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

export interface LinkProvider {
  readonly name: string;
  shorten(url: string, customAlias?: string): Promise<ShortenedLink>;
  addUTM(url: string, params: UTMParams): Promise<string>;
  getLinkStats(linkId: string): Promise<ShortenedLink>;
  listLinks(): Promise<ShortenedLink[]>;
}

// ---- Brand Monitoring -----------------------------------------------------

export interface BrandMention {
  id: string;
  platform: string;
  authorHandle: string;
  text: string;
  sentiment: "positive" | "neutral" | "negative";
  url: string;
  createdAt: string;
}

export interface CompetitorProfile {
  handle: string;
  platform: PlatformName;
  followerCount: number;
  postFrequency?: string;
  engagementRate?: number;
  recentPosts?: { text: string; metrics: PostMetrics; createdAt: string }[];
}

export interface MonitoringProvider {
  readonly name: string;
  searchMentions(query: string, platform?: PlatformName, since?: string): Promise<BrandMention[]>;
  analyzeSentiment(query: string, platform?: PlatformName, since?: string): Promise<{
    positive: number;
    neutral: number;
    negative: number;
    total: number;
    mentions: BrandMention[];
  }>;
  getCompetitorProfile(platform: PlatformName, handle: string): Promise<CompetitorProfile>;
}

// ---- Brand Context --------------------------------------------------------

export interface BrandContext {
  key: string;
  value: string;
  updatedAt: string;
}

export interface BrandContextProvider {
  readonly name: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  getAll(): Promise<BrandContext[]>;
  delete(key: string): Promise<void>;
}

// ---- Profile Management ---------------------------------------------------

export interface SocialProfile {
  accountId: string;
  platform: PlatformName;
  handle: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  followerCount?: number;
  isDefault: boolean;
}

export interface ProfileUpdate {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface ProfileProvider {
  readonly name: string;
  listAccounts(): Promise<SocialProfile[]>;
  getProfile(platform: PlatformName, accountId?: string): Promise<SocialProfile>;
  updateProfile(platform: PlatformName, updates: ProfileUpdate, accountId?: string): Promise<SocialProfile>;
  setDefaultAccount(platform: PlatformName, accountId: string): Promise<void>;
}

// ---- Rate Limiting --------------------------------------------------------

export interface RateLimitStatus {
  platform: PlatformName;
  endpoint: string;
  limit: number;
  remaining: number;
  resetsAt: string;
}

export interface RateLimiter {
  readonly name: string;
  checkLimit(platform: PlatformName, endpoint: string): Promise<RateLimitStatus>;
  getStatus(): Promise<RateLimitStatus[]>;
}

// ---- Provider Registry ----------------------------------------------------

export interface ProviderRegistry {
  platforms: Map<PlatformName, PlatformProvider>;
  contentGeneration?: ContentGenerationProvider;
  scheduling: SchedulingProvider;
  analytics: AnalyticsProvider;
  media: MediaProvider;
  trends: TrendsProvider;
  ideas: IdeasProvider;
  campaigns: CampaignProvider;
  links: LinkProvider;
  monitoring: MonitoringProvider;
  brandContext: BrandContextProvider;
  profile: ProfileProvider;
  rateLimiter: RateLimiter;
}
