# Unified Social Media MCP Server

An MCP (Model Context Protocol) server that gives AI agents comprehensive social media management capabilities — cross-platform posting, scheduling, analytics, content pipeline, campaign management, media management, link tracking, brand monitoring, and more — through a single, unified interface with swappable provider backends.

## Architecture

The server is built around a **provider abstraction layer**. Every capability is defined by a TypeScript interface, and concrete implementations wrap specific tools/APIs. Swapping a tool means writing a new provider class — zero changes to the MCP server or tool definitions.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         MCP Server (44 tools)                          │
├──────────────────────────────────────────────────────────────────────────┤
│                         Provider Registry                              │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ Platform │ Sched-   │ Analyt-  │ Media    │ Trends   │ Ideas Pipeline   │
│ Posting  │ uling    │ ics      │ Mgmt     │ Research │                  │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤
│ Twitter  │ SQLite   │ SQLite + │Cloudinary│ Google   │ SQLite           │
│ Bluesky  │          │ Platform │+ Unsplash│ Trends + │                  │
│ LinkedIn │          │ APIs     │          │ Reddit   │                  │
│ Facebook │          │          │          │          │                  │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤
│Campaigns │ Links    │Monitoring│ Brand    │ Profile  │ Rate Limiter     │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤
│ SQLite   │ Dub.co   │ Social   │ SQLite   │ Local    │ Token Bucket     │
│          │          │ Searcher │          │          │                  │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────────────┘
```

## MCP Tools (44 total)

### Platform Posting (7)
| Tool | Description |
|---|---|
| `post_to_platform` | Publish a post to a single platform |
| `crosspost` | Publish to multiple platforms at once |
| `post_thread` | Post a thread (connected posts) |
| `post_poll` | Create a poll |
| `delete_post` | Delete a post |
| `get_post` | Retrieve a post and its metrics |
| `list_configured_platforms` | List available platforms |

### Engagement (7)
| Tool | Description |
|---|---|
| `get_mentions` | Get recent mentions of your account |
| `get_comments` | Get comments on a post |
| `reply_to_post` | Reply to a post or comment |
| `get_direct_messages` | Get DMs from a platform |
| `send_direct_message` | Send a DM |
| `like_post` | Like a post |
| `unlike_post` | Unlike a post |

### Scheduling (4)
| Tool | Description |
|---|---|
| `schedule_post` | Schedule a post for future publishing |
| `cancel_scheduled_post` | Cancel a scheduled post |
| `list_scheduled_posts` | List scheduled posts (filterable by campaign/status) |
| `get_scheduled_post` | Get a scheduled post's details |

### Analytics & Post History (4)
| Tool | Description |
|---|---|
| `get_post_metrics` | Get engagement metrics for a post |
| `sync_posts` | Pull recent posts into local storage for historical analysis |
| `get_post_history` | Query locally-stored post history |
| `get_audience_insights` | Get follower demographics, growth, best posting times |

### Media Management (6)
| Tool | Description |
|---|---|
| `search_stock_media` | Search for stock photos (Unsplash) |
| `upload_media` | Upload media from URL to Cloudinary |
| `list_media` | List uploaded media (filterable by tags/type) |
| `get_media` | Get details of a media item |
| `delete_media` | Delete a media item |
| `resize_media` | Get a resized version via Cloudinary transformations |

### Trends & Hashtags (3)
| Tool | Description |
|---|---|
| `get_trending_topics` | Get trending topics from Google Trends, Reddit, or a platform |
| `lookup_hashtag` | Look up hashtag stats and related tags |
| `suggest_hashtags` | Suggest hashtags for a piece of text |

### Ideas Pipeline (6)
| Tool | Description |
|---|---|
| `create_idea` | Create a new content idea |
| `get_idea` | Get idea details |
| `update_idea` | Update an idea's content or metadata |
| `delete_idea` | Delete an idea |
| `list_ideas` | List ideas (filterable by status/campaign/tags) |
| `advance_idea` | Advance through: idea → draft → pending_review → approved/rejected → scheduled → published |

### Campaigns & Calendar (6)
| Tool | Description |
|---|---|
| `create_campaign` | Create a content campaign |
| `get_campaign` | Get campaign details |
| `update_campaign` | Update a campaign |
| `delete_campaign` | Delete a campaign |
| `list_campaigns` | List all campaigns |
| `get_content_calendar` | Get a unified calendar view of ideas, scheduled posts, and published content |

### Link Management (4)
| Tool | Description |
|---|---|
| `shorten_link` | Shorten a URL (Dub.co) |
| `add_utm_params` | Add UTM tracking parameters |
| `get_link_stats` | Get click stats for a link |
| `list_links` | List all shortened links |

### Brand Monitoring (3)
| Tool | Description |
|---|---|
| `search_brand_mentions` | Search for brand/keyword mentions (Social Searcher) |
| `analyze_sentiment` | Analyze sentiment of mentions |
| `get_competitor_profile` | Get competitor profile and activity |

### Brand Context (4)
| Tool | Description |
|---|---|
| `set_brand_context` | Store a brand context value (voice, audience, guidelines) |
| `get_brand_context` | Retrieve a brand context value |
| `list_brand_context` | List all stored brand context |
| `delete_brand_context` | Delete a brand context key |

### Profile Management (4)
| Tool | Description |
|---|---|
| `list_accounts` | List all configured accounts |
| `get_profile` | Get profile details |
| `update_profile` | Update display name, bio, avatar |
| `set_default_account` | Set default account for a platform |

### Rate Limiting (2)
| Tool | Description |
|---|---|
| `check_rate_limit` | Check rate limit for a platform endpoint |
| `get_rate_limit_status` | Get all rate limit statuses |

## Quick Start

### 1. Install

```bash
npm install
npm run build
```

### 2. Configure

Copy `.env.example` to `.env` and fill in credentials for the providers you want to use:

```bash
cp .env.example .env
```

You only need to configure the providers you plan to use.

### 3. Add to your MCP client

Add this to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "social-media": {
      "command": "node",
      "args": ["/path/to/unified-social-media-mcp/dist/index.js"],
      "env": {
        "ENABLED_PLATFORMS": "bluesky",
        "BLUESKY_IDENTIFIER": "you.bsky.social",
        "BLUESKY_PASSWORD": "your-app-password"
      }
    }
  }
}
```

## Swapping Providers

To replace any provider:

1. Create a new class implementing the relevant interface from `src/types.ts`
2. Add it to the registry in `src/registry.ts`
3. Add any new config/env vars to `src/config/index.ts`

The MCP tool definitions don't change — the agent's interface stays stable regardless of which backends are active.

### Provider Interfaces

| Interface | Default Implementation |
|---|---|
| `PlatformProvider` | Twitter, Bluesky, LinkedIn, Facebook |
| `SchedulingProvider` | SQLite + in-process timers |
| `AnalyticsProvider` | SQLite post history + platform API delegation |
| `MediaProvider` | Cloudinary (upload/resize) + Unsplash (stock search) |
| `TrendsProvider` | Google Trends RSS + Reddit popular |
| `IdeasProvider` | SQLite with status pipeline |
| `CampaignProvider` | SQLite with calendar view |
| `LinkProvider` | Dub.co API |
| `MonitoringProvider` | Social Searcher API |
| `BrandContextProvider` | SQLite key-value store |
| `ProfileProvider` | Local (file-based) |
| `RateLimiter` | Token bucket (in-memory) |

## Project Structure

```
src/
├── index.ts                              # MCP server + tool definitions
├── types.ts                              # All shared interfaces
├── registry.ts                           # Provider instantiation from config
├── db.ts                                 # SQLite schema & connection
├── config/
│   └── index.ts                          # Env var loading
└── providers/
    ├── platforms/
    │   ├── twitter/index.ts              # Twitter/X API v2
    │   ├── bluesky/index.ts              # Bluesky AT Protocol
    │   ├── linkedin/index.ts             # LinkedIn API v2
    │   └── facebook/index.ts             # Facebook Graph API
    ├── scheduling/
    │   └── sqlite-scheduling.ts          # SQLite-backed scheduler with timers
    ├── analytics/
    │   └── sqlite-analytics.ts           # Post history + platform API delegation
    ├── media/
    │   └── cloudinary.ts                 # Cloudinary upload/resize + Unsplash search
    ├── trends/
    │   └── multi-source.ts               # Google Trends + Reddit trending
    ├── ideas/
    │   └── sqlite-ideas.ts               # Ideas pipeline with status machine
    ├── campaigns/
    │   └── sqlite-campaigns.ts           # Campaign CRUD + calendar
    ├── links/
    │   └── dub.ts                        # Dub.co link shortening & UTM
    ├── monitoring/
    │   └── social-searcher.ts            # Social Searcher mentions & sentiment
    ├── brand-context/
    │   └── sqlite-brand-context.ts       # Persistent brand context store
    ├── profile/
    │   └── local-profile.ts              # Multi-account profile management
    └── rate-limiter/
        └── token-bucket.ts               # API rate limit tracking
```

## License

MIT
