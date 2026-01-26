# Genetius - Plant Biology Paper Summaries

AI-summarized plant biology research papers from bioRxiv.

## Overview

Genetius displays AI-summarized plant biology research papers from bioRxiv's plant biology collection. Target audience: plant genetics researchers who want to quickly scan the latest papers.

### Key Features

- **Paper Fetching**: Automatically fetches papers from bioRxiv API (plant_biology category only)
- **AI Summaries**: Generates 2-3 sentence summaries using OpenRouter's Qwen model
- **Keyword Extraction**: Extracts 3-5 keywords per paper for topic tracking
- **Trend Analysis**: Tracks trending topics and paper types over time (day/week/month/year)
- **Persistent Storage**: SQLite database via Astro DB with markdown conversion
- **Admin Dashboard**: Protected interface for triggering data refreshes

## Tech Stack

- **Framework**: Astro 6 beta (beta.3) with TypeScript strict mode
- **Styling**: Tailwind CSS v4
- **Database**: Astro DB (libSQL/SQLite) - local `.astro/content.db`
- **AI Model**: `openai/gpt-oss-120b:exacto` via OpenRouter API
- **Testing**: Vitest 4.0.18 (89/91 tests passing)
- **Deployment**: Coolify with Node adapter (standalone mode)
- **Node Version**: 22+ (via nvm)

## Prerequisites

- Node.js 22+ (via nvm)
- OpenRouter API key (free tier available)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your credentials:
   ```env
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ADMIN_USER=admin
   ADMIN_PASSWORD=change_me_to_secure_password
   ```

5. Run development server:
   ```bash
   bun run dev
   ```

## Development

```bash
# Development
bun run dev          # Start dev server at localhost:4321
bun run build        # Production build (needs ASTRO_DATABASE_FILE env var or --remote)
bun run preview      # Preview production build locally

# Testing
bun run test         # Run all tests (watch mode)
bun run test:unit    # Run unit tests only
bun run test:integration # Run integration tests only
bun run test <path>  # Run single test: bun run test src/lib/markdown.test.ts
bun run test -- --run # Run once without watch
bunx vitest <path> --run # Alternative for single test

# Type checking
bunx astro check      # Type check with Astro
bunx tsc --noEmit     # TypeScript type checking (strict mode)

# Dependency updates
bunx npm-check-updates                  # Check for package updates
bunx npm-check-updates -u && bun install # Update all dependencies
```

**Note:** Node.js installed via nvm at `/home/jan/.local/share/nvm/v24.13.0/bin/`. Prefix all bun/bunx commands with `PATH=/home/jan/.local/share/nvm/v24.13.0/bin:$PATH`

## Project Structure

```
src/
├── components/          # Astro components
│   ├── PaperCard.astro
│   ├── TrendList.astro
│   └── AdminHeader.astro
├── lib/                # Utility functions
│   ├── markdown.ts     # Markdown generator
│   ├── auth.ts         # Auth validation
│   ├── openrouter.ts   # OpenRouter API client
│   ├── biorxiv.ts      # BioRxiv API client
│   ├── paper-fetch.ts  # Paper fetch orchestration
│   ├── trends.ts       # Trend analysis
│   └── trends-types.ts # Trend type definitions
├── pages/              # Route pages
│   ├── admin/          # Protected admin routes
│   │   ├── index.astro    # Dashboard
│   │   ├── refresh.ts     # POST endpoint
│   │   └── refresh-status.ts # GET endpoint
│   ├── index.astro      # Home page (latest 50 papers)
│   └── trends.astro     # Trends page
├── styles/             # Global styles
├── layouts/            # Astro layouts
│   └── MainLayout.astro
└── middleware.ts       # Astro middleware

db/
├── config.ts           # Database schema
└── seed.ts             # Seed script
```

## Admin Routes

- `/admin` - Dashboard with stats and refresh button (Basic Auth protected)
- `/admin/refresh` - POST endpoint for triggering paper fetch (Basic Auth protected)

## Public Pages

- `/` - Latest 50 papers with AI summaries
- `/trends` - Topic trends and paper types for day/week/month/year

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key | Yes |
| `ADMIN_USER` | Admin username | Yes |
| `ADMIN_PASSWORD` | Admin password | Yes |

## Database

- **Local**: `.astro/content.db` (auto-created on dev server start)
- **Production**: libSQL (configured via Coolify)
- **Tables**: `papers` (paper data), `refreshLogs` (refresh history)
- Run `bunx astro db push` to apply schema changes

## Testing

```bash
bun run test:unit     # Run all unit tests (89/91 passing)
```

- **Unit tests**: Colocated with source files (e.g., `lib/markdown.test.ts`)
- **Integration tests**: In `tests/integration/` or colocated for pages
- **Test framework**: Vitest 4.0.18
- **Mocking**: External APIs (OpenRouter, bioRxiv) mocked with Vitest

## Security Notes

- Change default admin password before deployment
- Enable CSP in production
- Never commit `.env` file
- Use rate limiting for external API calls
- Validate all inputs before database queries
- Use prepared statements for all DB queries

## Deployment

Built for Coolify with Node 22+ adapter (standalone mode).

**Build command** (requires environment variable):
```bash
ASTRO_DATABASE_FILE=/path/to/content.db bun run build
```

**Environment variables on Coolify:**
- `OPENROUTER_API_KEY`
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `ASTRO_DATABASE_FILE` (for local SQLite) or use `--remote` for libSQL

## License

MIT
