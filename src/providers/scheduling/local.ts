// ---------------------------------------------------------------------------
// Local in-memory scheduling provider
//
// Uses setTimeout for scheduling. Posts are stored in memory — a production
// swap could use a database-backed scheduler, Buffer, or a cloud queue.
// ---------------------------------------------------------------------------

import type {
  SchedulingProvider,
  ScheduleRequest,
  ScheduledPost,
  PlatformProvider,
  PlatformName,
} from "../../types.js";
import crypto from "node:crypto";

export class LocalSchedulingProvider implements SchedulingProvider {
  readonly name = "local";

  private posts = new Map<string, ScheduledPost>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private platformProviders: Map<PlatformName, PlatformProvider>,
  ) {}

  async schedule(request: ScheduleRequest): Promise<ScheduledPost> {
    const id = crypto.randomUUID();
    const scheduledAt = new Date(request.scheduledAt);
    const delay = scheduledAt.getTime() - Date.now();

    const post: ScheduledPost = {
      id,
      content: request.content,
      platforms: request.platforms,
      scheduledAt: request.scheduledAt,
      status: "pending",
    };

    this.posts.set(id, post);

    if (delay <= 0) {
      // Publish immediately
      await this.publish(id);
    } else {
      const timer = setTimeout(() => {
        this.publish(id).catch((err) => {
          const p = this.posts.get(id);
          if (p) {
            p.status = "failed";
            p.error = String(err);
          }
        });
      }, delay);
      this.timers.set(id, timer);
    }

    return { ...post };
  }

  async cancel(scheduleId: string): Promise<void> {
    const post = this.posts.get(scheduleId);
    if (!post) throw new Error(`Scheduled post ${scheduleId} not found`);
    if (post.status !== "pending") throw new Error(`Cannot cancel post with status ${post.status}`);

    const timer = this.timers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(scheduleId);
    }

    post.status = "cancelled";
  }

  async list(): Promise<ScheduledPost[]> {
    return [...this.posts.values()];
  }

  async get(scheduleId: string): Promise<ScheduledPost> {
    const post = this.posts.get(scheduleId);
    if (!post) throw new Error(`Scheduled post ${scheduleId} not found`);
    return { ...post };
  }

  // -- Internal -------------------------------------------------------------

  private async publish(id: string): Promise<void> {
    const post = this.posts.get(id);
    if (!post || post.status !== "pending") return;

    const results = [];
    const errors: string[] = [];

    for (const platform of post.platforms) {
      const provider = this.platformProviders.get(platform);
      if (!provider) {
        errors.push(`No provider configured for ${platform}`);
        continue;
      }
      try {
        const result = await provider.post(post.content);
        results.push(result);
      } catch (err) {
        errors.push(`${platform}: ${err}`);
      }
    }

    post.results = results;

    if (errors.length > 0 && results.length === 0) {
      post.status = "failed";
      post.error = errors.join("; ");
    } else {
      post.status = "published";
      if (errors.length > 0) {
        post.error = `Partial failures: ${errors.join("; ")}`;
      }
    }

    this.timers.delete(id);
  }
}
