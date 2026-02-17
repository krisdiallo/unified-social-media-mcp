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

export interface ContentGenerationProvider {
  readonly name: string;
  generate(request: GenerateContentRequest): Promise<GeneratedContent>;
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

export interface PlatformProvider {
  readonly name: string;
  readonly platform: PlatformName;
  post(content: PostContent): Promise<PostResult>;
  deletePost(postId: string): Promise<void>;
  getPost(postId: string): Promise<PostResult & { text: string; metrics?: PostMetrics }>;
}

// ---- Scheduling -----------------------------------------------------------

export interface ScheduledPost {
  id: string;
  content: PostContent;
  platforms: PlatformName[];
  scheduledAt: string; // ISO-8601
  status: "pending" | "published" | "failed" | "cancelled";
  results?: PostResult[];
  error?: string;
}

export interface ScheduleRequest {
  content: PostContent;
  platforms: PlatformName[];
  scheduledAt: string; // ISO-8601
}

export interface SchedulingProvider {
  readonly name: string;
  schedule(request: ScheduleRequest): Promise<ScheduledPost>;
  cancel(scheduleId: string): Promise<void>;
  list(): Promise<ScheduledPost[]>;
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

export interface AnalyticsProvider {
  readonly name: string;
  getPostMetrics(platform: PlatformName, postId: string): Promise<PostMetrics>;
  getSummary(platform: PlatformName, periodStart: string, periodEnd: string): Promise<AnalyticsSummary>;
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

// ---- Provider Registry ----------------------------------------------------

export interface ProviderRegistry {
  contentGeneration: ContentGenerationProvider;
  platforms: Map<PlatformName, PlatformProvider>;
  scheduling: SchedulingProvider;
  analytics: AnalyticsProvider;
  media: MediaProvider;
}
