// ---------------------------------------------------------------------------
// Shared types for the unified social-media MCP server
// ---------------------------------------------------------------------------

// ---- Content Generation ---------------------------------------------------

export interface GenerateContentRequest {
  topic: string;
  platform: PlatformName;
  tone?: string;
  maxLength?: number;
  hashtags?: boolean;
  /** Any additional context the user wants folded into the prompt. */
  context?: string;
}

export interface GeneratedContent {
  text: string;
  hashtags: string[];
  platform: PlatformName;
  estimatedCharCount: number;
}

export interface RepurposeRequest {
  originalText: string;
  sourcePlatform: PlatformName;
  targetPlatforms: PlatformName[];
  tone?: string;
}

export interface RepurposedContent {
  platform: PlatformName;
  text: string;
  hashtags: string[];
  estimatedCharCount: number;
}

export interface ContentGenerationProvider {
  readonly name: string;
  generate(request: GenerateContentRequest): Promise<GeneratedContent>;
  repurpose(request: RepurposeRequest): Promise<RepurposedContent[]>;
}

// ---- Platform / Posting ---------------------------------------------------

export type PlatformName = "twitter" | "bluesky" | "linkedin" | "facebook";

export interface PostContent {
  text: string;
  mediaUrls?: string[];
  /** Platform-specific extras (e.g. link preview settings). */
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

export interface PlatformProvider {
  readonly name: string;
  readonly platform: PlatformName;
  post(content: PostContent): Promise<PostResult>;
  deletePost(postId: string): Promise<void>;
  getPost(postId: string): Promise<PostResult & { text: string; metrics?: PostMetrics }>;
  postThread?(posts: ThreadPost[]): Promise<ThreadResult>;
  postPoll?(poll: PollContent): Promise<PostResult>;
}

// ---- Engagement / Community -----------------------------------------------

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

export interface ReplyRequest {
  platform: PlatformName;
  postId: string;
  text: string;
}

export interface EngagementProvider {
  readonly name: string;
  getMentions(platform: PlatformName, sinceId?: string): Promise<Mention[]>;
  getComments(platform: PlatformName, postId: string): Promise<Comment[]>;
  reply(request: ReplyRequest): Promise<PostResult>;
  getDirectMessages(platform: PlatformName, conversationId?: string): Promise<DirectMessage[]>;
  sendDirectMessage(platform: PlatformName, recipientId: string, text: string): Promise<DirectMessage>;
  likePost(platform: PlatformName, postId: string): Promise<void>;
  unlikePost(platform: PlatformName, postId: string): Promise<void>;
}

// ---- Scheduling -----------------------------------------------------------

export interface ScheduledPost {
  id: string;
  content: PostContent;
  platforms: PlatformName[];
  scheduledAt: string; // ISO-8601
  status: "pending" | "published" | "failed" | "cancelled";
  campaignId?: string;
  results?: PostResult[];
  error?: string;
}

export interface ScheduleRequest {
  content: PostContent;
  platforms: PlatformName[];
  scheduledAt: string; // ISO-8601
  campaignId?: string;
}

export interface SchedulingProvider {
  readonly name: string;
  schedule(request: ScheduleRequest): Promise<ScheduledPost>;
  cancel(scheduleId: string): Promise<void>;
  list(filters?: { campaignId?: string; status?: string }): Promise<ScheduledPost[]>;
  get(scheduleId: string): Promise<ScheduledPost>;
}

// ---- Analytics ------------------------------------------------------------

export interface PostMetrics {
  likes: number;
  shares: number;
  comments: number;
  impressions: number;
  clicks: number;
  [key: string]: number; // extensible
}

export interface AnalyticsSummary {
  platform: PlatformName;
  periodStart: string;
  periodEnd: string;
  totalPosts: number;
  totalImpressions: number;
  totalEngagements: number;
  engagementRate: number;
  topPost?: { id: string; metrics: PostMetrics };
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
  getSummary(platform: PlatformName, periodStart: string, periodEnd: string): Promise<AnalyticsSummary>;
  getAudienceInsights(platform: PlatformName): Promise<AudienceInsights>;
}

// ---- Media ----------------------------------------------------------------

export interface MediaItem {
  id: string;
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

export interface SearchMediaRequest {
  query: string;
  count?: number;
}

export interface ResizeMediaRequest {
  url: string;
  width: number;
  height: number;
}

export interface MediaProvider {
  readonly name: string;
  search(request: SearchMediaRequest): Promise<MediaItem[]>;
  resize(request: ResizeMediaRequest): Promise<MediaItem>;
}

// ---- Hashtag & Trend Research ---------------------------------------------

export interface TrendingTopic {
  name: string;
  volume?: number;
  url?: string;
  platform: PlatformName;
}

export interface HashtagInfo {
  tag: string;
  postCount?: number;
  recentGrowth?: string;
  relatedTags?: string[];
}

export interface TrendsProvider {
  readonly name: string;
  getTrending(platform: PlatformName, region?: string): Promise<TrendingTopic[]>;
  lookupHashtag(platform: PlatformName, tag: string): Promise<HashtagInfo>;
  suggestHashtags(platform: PlatformName, text: string): Promise<string[]>;
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
  postIds: string[];
}

export interface CalendarEntry {
  id: string;
  scheduledAt: string;
  platform: PlatformName;
  content: PostContent;
  status: "draft" | "scheduled" | "published" | "failed";
  campaignId?: string;
}

export interface CampaignProvider {
  readonly name: string;
  createCampaign(campaign: Omit<Campaign, "id" | "postIds">): Promise<Campaign>;
  getCampaign(campaignId: string): Promise<Campaign>;
  updateCampaign(campaignId: string, updates: Partial<Pick<Campaign, "name" | "description" | "status" | "endDate" | "tags">>): Promise<Campaign>;
  deleteCampaign(campaignId: string): Promise<void>;
  listCampaigns(filters?: { status?: string }): Promise<Campaign[]>;
  getCalendar(startDate: string, endDate: string, platform?: PlatformName): Promise<CalendarEntry[]>;
}

// ---- Link Management ------------------------------------------------------

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

// ---- Approval / Draft Workflow --------------------------------------------

export type DraftStatus = "draft" | "pending_review" | "approved" | "rejected" | "published";

export interface Draft {
  id: string;
  content: PostContent;
  platforms: PlatformName[];
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  campaignId?: string;
  reviewNotes?: string;
  createdBy?: string;
  reviewedBy?: string;
}

export interface WorkflowProvider {
  readonly name: string;
  createDraft(draft: Omit<Draft, "id" | "status" | "createdAt" | "updatedAt">): Promise<Draft>;
  getDraft(draftId: string): Promise<Draft>;
  updateDraft(draftId: string, updates: Partial<Pick<Draft, "content" | "platforms" | "scheduledAt" | "campaignId">>): Promise<Draft>;
  submitForReview(draftId: string): Promise<Draft>;
  approve(draftId: string, notes?: string): Promise<Draft>;
  reject(draftId: string, notes: string): Promise<Draft>;
  listDrafts(filters?: { status?: DraftStatus; campaignId?: string }): Promise<Draft[]>;
  deleteDraft(draftId: string): Promise<void>;
}

// ---- Template Management --------------------------------------------------

export interface Template {
  id: string;
  name: string;
  description?: string;
  content: string;
  platforms: PlatformName[];
  variables: string[]; // e.g. ["product_name", "link"]
  tags?: string[];
  createdAt: string;
}

export interface TemplateProvider {
  readonly name: string;
  createTemplate(template: Omit<Template, "id" | "createdAt">): Promise<Template>;
  getTemplate(templateId: string): Promise<Template>;
  updateTemplate(templateId: string, updates: Partial<Omit<Template, "id" | "createdAt">>): Promise<Template>;
  deleteTemplate(templateId: string): Promise<void>;
  listTemplates(filters?: { platform?: PlatformName; tags?: string[] }): Promise<Template[]>;
  renderTemplate(templateId: string, variables: Record<string, string>): Promise<string>;
}

// ---- Brand Monitoring / Competitor Analysis -------------------------------

export interface BrandMention {
  id: string;
  platform: PlatformName;
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
  searchMentions(platform: PlatformName, query: string, since?: string): Promise<BrandMention[]>;
  analyzeSentiment(platform: PlatformName, query: string, since?: string): Promise<{
    positive: number;
    neutral: number;
    negative: number;
    total: number;
    mentions: BrandMention[];
  }>;
  getCompetitorProfile(platform: PlatformName, handle: string): Promise<CompetitorProfile>;
}

// ---- Reporting & Export ---------------------------------------------------

export interface ReportConfig {
  platforms: PlatformName[];
  periodStart: string;
  periodEnd: string;
  includeMetrics?: boolean;
  includeAudience?: boolean;
  includeCampaigns?: boolean;
  includeTopPosts?: boolean;
  format: "json" | "csv" | "markdown";
}

export interface Report {
  id: string;
  generatedAt: string;
  config: ReportConfig;
  data: Record<string, unknown>;
  formatted: string;
}

export interface ReportingProvider {
  readonly name: string;
  generateReport(config: ReportConfig): Promise<Report>;
  exportPostData(platform: PlatformName, postIds: string[], format: "json" | "csv"): Promise<string>;
}

// ---- Multi-Account & Profile Management -----------------------------------

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
  contentGeneration: ContentGenerationProvider;
  platforms: Map<PlatformName, PlatformProvider>;
  scheduling: SchedulingProvider;
  analytics: AnalyticsProvider;
  media: MediaProvider;
  engagement: EngagementProvider;
  trends: TrendsProvider;
  campaigns: CampaignProvider;
  links: LinkProvider;
  workflow: WorkflowProvider;
  templates: TemplateProvider;
  monitoring: MonitoringProvider;
  reporting: ReportingProvider;
  profile: ProfileProvider;
  rateLimiter: RateLimiter;
}
