# Unified Social Media MCP Server

An MCP (Model Context Protocol) server that gives AI agents comprehensive social media management capabilities — content generation, cross-platform posting, community engagement, scheduling, analytics, campaign management, and more — through a single, unified interface with swappable provider backends.

## Architecture

The server is built around a **provider abstraction layer**. Every capability is defined by a TypeScript interface, and concrete implementations wrap specific tools/APIs. Swapping a tool means writing a new provider class — zero changes to the MCP server or tool definitions.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          MCP Server (50 tools)                          │
├──────────────────────────────────────────────────────────────────────────┤
│                          Provider Registry                              │
├─────────┬──────────┬──────────┬──────────┬──────────┬────────┬──────────┤
│ Content │ Platform │ Engage-  │ Sched-   │ Analyt-  │ Media  │ Trends   │
│ Gener.  │ Posting  │ ment     │ uling    │ ics      │ Mgmt   │ Research │
├─────────┼──────────┼──────────┼──────────┼──────────┼────────┼──────────┤
│ OpenAI  │ Twitter  │ Platform │ Local    │ Platform │Unsplash│ Platform │
│ Ollama  │ Bluesky  │ Native   │ (swap w/ │ Native   │(swap w/│ Native   │
│         │ LinkedIn │          │ Buffer)  │          │Cloudi- │          │
│         │ Facebook │          │          │          │nary)   │          │
├─────────┴──────────┴──────────┼──────────┼──────────┴────────┴──────────┤
│ Campaigns │ Links │ Workflow  │Templates │ Monitoring│Reporting│ Profile │
├───────────┼───────┼───────────┼──────────┼───────────┼─────────┼─────────┤
│ Local     │ Local │ Local     │ Local    │ Platform  │ Local   │ Local   │
│ (swap w/  │(swap  │ (swap w/  │ (swap w/ │ Native    │         │         │
│  Notion)  │Bitly) │ Planable) │ DB)      │ (Brandw.) │         │         │
└───────────┴───────┴───────────┴──────────┴───────────┴─────────┴─────────┘
```

## MCP Tools (50 total)

### Content Generation (2)
| Tool | Description |
|---|---|
| `generate_content` | Generate a platform-optimized post using AI |
| `repurpose_content` | Adapt a post for other platforms (adjusts tone, length, format) |

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

### Engagement / Community (7)
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

### Analytics (3)
| Tool | Description |
|---|---|
| `get_post_metrics` | Get engagement metrics for a post |
| `get_analytics_summary` | Get analytics summary for a time period |
| `get_audience_insights` | Get follower demographics, growth, best posting times |

### Media (2)
| Tool | Description |
|---|---|
| `search_media` | Search for stock photos |
| `resize_media` | Resize an image for a platform |

### Hashtag & Trend Research (3)
| Tool | Description |
|---|---|
| `get_trending_topics` | Get trending topics on a platform |
| `lookup_hashtag` | Look up hashtag stats and related tags |
| `suggest_hashtags` | Suggest hashtags for a piece of text |

### Campaigns & Calendar (6)
| Tool | Description |
|---|---|
| `create_campaign` | Create a content campaign |
| `get_campaign` | Get campaign details |
| `update_campaign` | Update a campaign |
| `delete_campaign` | Delete a campaign |
| `list_campaigns` | List all campaigns |
| `get_content_calendar` | Get a calendar view of scheduled content |

### Link Management (4)
| Tool | Description |
|---|---|
| `shorten_link` | Shorten a URL |
| `add_utm_params` | Add UTM tracking parameters |
| `get_link_stats` | Get click stats for a link |
| `list_links` | List all shortened links |

### Draft / Approval Workflow (8)
| Tool | Description |
|---|---|
| `create_draft` | Create a draft post |
| `get_draft` | Get draft details |
| `update_draft` | Edit a draft |
| `submit_draft_for_review` | Submit for review |
| `approve_draft` | Approve a pending draft |
| `reject_draft` | Reject with feedback |
| `list_drafts` | List drafts (filterable) |
| `delete_draft` | Delete a draft |

### Templates (6)
| Tool | Description |
|---|---|
| `create_template` | Create a reusable template with `{{variables}}` |
| `get_template` | Get a template |
| `list_templates` | List templates (filterable) |
| `render_template` | Render a template with variable values |
| `update_template` | Update a template |
| `delete_template` | Delete a template |

### Brand Monitoring (3)
| Tool | Description |
|---|---|
| `search_brand_mentions` | Search for brand/keyword mentions |
| `analyze_sentiment` | Analyze sentiment of mentions |
| `get_competitor_profile` | Get competitor profile and activity |

### Reporting (2)
| Tool | Description |
|---|---|
| `generate_report` | Generate a report (JSON, CSV, or Markdown) |
| `export_post_data` | Export post metrics data |

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

You only need to configure the providers you plan to use. For example, if you only want Bluesky + Ollama, just set those variables.

### 3. Add to your MCP client

Add this to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "social-media": {
      "command": "node",
      "args": ["/path/to/unified-social-media-mcp/dist/index.js"],
      "env": {
        "CONTENT_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-...",
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

The MCP tool definitions don't change at all — the agent's interface stays stable regardless of which backends are active.

### Provider Interfaces

| Interface | Methods | Default Implementation |
|---|---|---|
| `ContentGenerationProvider` | `generate()`, `repurpose()` | OpenAI, Ollama |
| `PlatformProvider` | `post()`, `deletePost()`, `getPost()`, `postThread?()`, `postPoll?()` | Twitter, Bluesky, LinkedIn, Facebook |
| `EngagementProvider` | `getMentions()`, `getComments()`, `reply()`, `likePost()`, DMs | Platform-native |
| `SchedulingProvider` | `schedule()`, `cancel()`, `list()`, `get()` | Local (in-memory) |
| `AnalyticsProvider` | `getPostMetrics()`, `getSummary()`, `getAudienceInsights()` | Platform-native |
| `MediaProvider` | `search()`, `resize()` | Unsplash |
| `TrendsProvider` | `getTrending()`, `lookupHashtag()`, `suggestHashtags()` | Platform-native |
| `CampaignProvider` | `createCampaign()`, CRUD, `getCalendar()` | Local (in-memory) |
| `LinkProvider` | `shorten()`, `addUTM()`, `getLinkStats()` | Local (in-memory) |
| `WorkflowProvider` | `createDraft()`, `submitForReview()`, `approve()`, `reject()` | Local (in-memory) |
| `TemplateProvider` | `createTemplate()`, `renderTemplate()`, CRUD | Local (in-memory) |
| `MonitoringProvider` | `searchMentions()`, `analyzeSentiment()`, `getCompetitorProfile()` | Platform-native |
| `ReportingProvider` | `generateReport()`, `exportPostData()` | Local |
| `ProfileProvider` | `listAccounts()`, `getProfile()`, `updateProfile()` | Local |
| `RateLimiter` | `checkLimit()`, `getStatus()` | Token bucket |

## Project Structure

```
src/
├── index.ts                              # MCP server + 50 tool definitions
├── types.ts                              # All shared interfaces
├── registry.ts                           # Provider instantiation from config
├── config/
│   └── index.ts                          # Env var loading
└── providers/
    ├── content/
    │   ├── openai.ts                     # OpenAI content generation + repurposing
    │   └── ollama.ts                     # Ollama (local LLM) content generation
    ├── platforms/
    │   ├── twitter/index.ts              # Twitter/X API v2 (OAuth 1.0a)
    │   ├── bluesky/index.ts              # Bluesky AT Protocol
    │   ├── linkedin/index.ts             # LinkedIn API v2
    │   └── facebook/index.ts             # Facebook Graph API
    ├── engagement/
    │   └── platform-engagement.ts        # Community management via platform APIs
    ├── scheduling/
    │   └── local.ts                      # In-memory scheduler (setTimeout)
    ├── analytics/
    │   └── platform-native.ts            # Delegates to platform APIs
    ├── media/
    │   └── unsplash.ts                   # Unsplash stock photo search
    ├── trends/
    │   └── platform-trends.ts            # Hashtag & trend research
    ├── campaigns/
    │   └── local-campaigns.ts            # Campaign & calendar management
    ├── links/
    │   └── local-links.ts               # URL shortening & UTM tracking
    ├── workflow/
    │   └── local-workflow.ts             # Draft → review → approve pipeline
    ├── templates/
    │   └── local-templates.ts            # Reusable content templates
    ├── monitoring/
    │   └── platform-monitoring.ts        # Brand mentions & sentiment analysis
    ├── reporting/
    │   └── local-reporting.ts            # Report generation & data export
    ├── profile/
    │   └── local-profile.ts             # Multi-account & profile management
    └── rate-limiter/
        └── token-bucket.ts               # API rate limit tracking
```

## License

MIT
