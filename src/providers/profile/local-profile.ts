// ---------------------------------------------------------------------------
// Profile management provider — multi-account support
//
// Manages social media profiles and multi-account switching.
// In a real implementation, profile updates would call each platform's
// API to update bios, display names, and avatars.
// ---------------------------------------------------------------------------

import type {
  ProfileProvider,
  SocialProfile,
  ProfileUpdate,
  PlatformName,
} from "../../types.js";

export class LocalProfileProvider implements ProfileProvider {
  readonly name = "local";

  private accounts = new Map<string, SocialProfile>();
  private defaults = new Map<PlatformName, string>(); // platform → accountId

  constructor(configuredPlatforms: PlatformName[]) {
    // Bootstrap a default account entry for each configured platform
    for (const platform of configuredPlatforms) {
      const accountId = `${platform}-default`;
      this.accounts.set(accountId, {
        accountId,
        platform,
        handle: `[${platform} handle]`,
        displayName: `[${platform} display name]`,
        isDefault: true,
      });
      this.defaults.set(platform, accountId);
    }
  }

  async listAccounts(): Promise<SocialProfile[]> {
    return [...this.accounts.values()];
  }

  async getProfile(platform: PlatformName, accountId?: string): Promise<SocialProfile> {
    const id = accountId ?? this.defaults.get(platform);
    if (!id) throw new Error(`No account configured for ${platform}`);

    const account = this.accounts.get(id);
    if (!account) throw new Error(`Account ${id} not found`);

    return { ...account };
  }

  async updateProfile(
    platform: PlatformName,
    updates: ProfileUpdate,
    accountId?: string,
  ): Promise<SocialProfile> {
    const id = accountId ?? this.defaults.get(platform);
    if (!id) throw new Error(`No account configured for ${platform}`);

    const account = this.accounts.get(id);
    if (!account) throw new Error(`Account ${id} not found`);

    if (updates.displayName !== undefined) account.displayName = updates.displayName;
    if (updates.bio !== undefined) account.bio = updates.bio;
    if (updates.avatarUrl !== undefined) account.avatarUrl = updates.avatarUrl;

    // In a real implementation, this would call the platform API:
    // Twitter: PUT /2/users/:id (limited)
    // Bluesky: com.atproto.repo.putRecord (app.bsky.actor.profile)
    // LinkedIn: profile API (restricted)
    // Facebook: POST /{page-id} (limited fields)

    return { ...account };
  }

  async setDefaultAccount(platform: PlatformName, accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error(`Account ${accountId} not found`);
    if (account.platform !== platform) {
      throw new Error(`Account ${accountId} is for ${account.platform}, not ${platform}`);
    }

    // Unset previous default
    const prevId = this.defaults.get(platform);
    if (prevId) {
      const prev = this.accounts.get(prevId);
      if (prev) prev.isDefault = false;
    }

    account.isDefault = true;
    this.defaults.set(platform, accountId);
  }
}
