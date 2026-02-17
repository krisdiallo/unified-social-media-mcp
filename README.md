# Unified Social Media MCP Server

An MCP (Model Context Protocol) server that gives AI agents full social media management capabilities — content generation, cross-platform posting, scheduling, analytics, and media management — through a single, unified interface.

## Architecture

The server is built around a **provider abstraction layer**. Every capability is defined by a TypeScript interface, and concrete implementations wrap specific tools/APIs. Swapping a tool means writing a new provider class — zero changes to the MCP server or tool definitions.

```
┌─────────────────────────────────────────────────────┐
│                   MCP Server                        │
│              (tool definitions)                     │
├─────────────────────────────────────────────────────┤
│                Provider Registry                    │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│ Content  │ Platform │ Sched-   │ Analyt-  │ Media   │
│ Gener.   │ Posting  │ uling    │ ics      │ Mgmt    │
├──────────┼──────────┼──────────┼──────────┼─────────┤
│ OpenAI   │ Twitter  │ Local    │ Platform │Unsplash │
│ Ollama   │ Bluesky  │ (swap w/ │ Native   │(swap w/ │
│ (swap w/ │ LinkedIn │ Buffer,  │ (swap w/ │Cloudi-  │
│ any LLM) │ Facebook │ cloud)   │ 3rd pty) │nary)    │
└──────────┴──────────┴──────────┴──────────┴─────────┘
```

## MCP Tools

| Tool | Description |
|---|---|
| `generate_content` | Generate a platform-optimized post using AI |
| `post_to_platform` | Publish a post to a single platform |
| `crosspost` | Publish to multiple platforms at once |
| `delete_post` | Delete a post |
| `get_post` | Retrieve a post and its metrics |
| `list_configured_platforms` | List available platforms |
| `schedule_post` | Schedule a future post |
| `cancel_scheduled_post` | Cancel a scheduled post |
| `list_scheduled_posts` | List all scheduled posts |
| `get_scheduled_post` | Get a scheduled post's status |
| `get_post_metrics` | Get engagement metrics for a post |
| `get_analytics_summary` | Get analytics summary for a time period |
| `search_media` | Search for stock photos |
| `resize_media` | Resize an image for a platform |

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

1. Create a new class implementing the relevant interface (`ContentGenerationProvider`, `PlatformProvider`, `SchedulingProvider`, `AnalyticsProvider`, or `MediaProvider`)
2. Add it to the registry in `src/registry.ts`
3. Add any new config/env vars to `src/config/index.ts`

The MCP tool definitions don't change at all — the agent's interface stays stable regardless of which backends are active.

### Provider Interfaces

| Interface | Methods |
|---|---|
| `ContentGenerationProvider` | `generate()` |
| `PlatformProvider` | `post()`, `deletePost()`, `getPost()` |
| `SchedulingProvider` | `schedule()`, `cancel()`, `list()`, `get()` |
| `AnalyticsProvider` | `getPostMetrics()`, `getSummary()` |
| `MediaProvider` | `search()`, `resize()` |

## Project Structure

```
src/
├── index.ts                          # MCP server + tool definitions
├── types.ts                          # All shared interfaces
├── registry.ts                       # Provider instantiation from config
├── config/
│   └── index.ts                      # Env var loading
└── providers/
    ├── content/
    │   ├── openai.ts                 # OpenAI content generation
    │   └── ollama.ts                 # Ollama (local LLM) content generation
    ├── platforms/
    │   ├── twitter/index.ts          # Twitter/X API v2
    │   ├── bluesky/index.ts          # Bluesky AT Protocol
    │   ├── linkedin/index.ts         # LinkedIn API v2
    │   └── facebook/index.ts         # Facebook Graph API
    ├── scheduling/
    │   └── local.ts                  # In-memory scheduler (setTimeout)
    ├── analytics/
    │   └── platform-native.ts        # Delegates to platform APIs
    └── media/
        └── unsplash.ts               # Unsplash stock photo search
```

## License

MIT
