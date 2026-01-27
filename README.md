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
- **Database**: Astro DB (local SQLite - `local.db`)
- **AI Model**: `openai/gpt-oss-120b:exacto` via OpenRouter API
- **Testing**: Vitest 4.0.18 (89/91 tests passing)
- **Deployment**: Coolify with Node adapter (standalone mode) + persistent volume
- **Node Version**: 22+ (via nvm)

## Prerequisites

- Node.js 22+ (via nvm)
- OpenRouter API key (free tier available)
- SQLite CLI (for database operations)

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
bun run dev:persist  # Start dev server with persistent local.db file
bun run build        # Production build (needs ASTRO_DATABASE_FILE env var)
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
- `/admin/api/refresh` - POST endpoint for triggering paper fetch (Basic Auth protected)

## Public Pages

- `/` - Latest 50 papers with AI summaries
- `/trends` - Topic trends and paper types for day/week/month/year

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key | Yes |
| `ADMIN_USER` | Admin username | Yes |
| `ADMIN_PASSWORD` | Admin password | Yes |
| `ASTRO_DB_REMOTE_URL` | Database URL (local: `file:local.db`) | No |
| `ASTRO_DB_APP_TOKEN` | Database auth token (local: `unused`) | No |
| `ASTRO_DATABASE_FILE` | Database file path for production | No |
| `NIXPACKS_NODE_VERSION` | Node.js version for Nixpacks | No |

## Database

- **Local**: `local.db` (SQLite database file)
- **Production**: `/app/data/local.db` (Coolify persistent volume)
- **Tables**: `papers`, `refreshLogs`, `keywordFilters`, `organismFilters`
- Run `bunx astro db push` to apply schema changes

### Database Migration (Turso → SQLite)

To migrate from Turso to local SQLite:

```bash
# 1. Export from Turso
turso db shell genetius --location aws-eu-west-1 ".dump" > turso_dump.sql

# 2. Import to local SQLite
sqlite3 local.db < turso_dump.sql

# 3. Update .env
ASTRO_DB_REMOTE_URL=file:local.db
ASTRO_DB_APP_TOKEN=unused
```

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

### Coolify Setup

**1. Persistent Volume:**
- Mount volume to: `/app/data`
- Database file will be: `/app/data/local.db`

**2. Build Command:**
```bash
ASTRO_DATABASE_FILE=/app/data/local.db bun run build
```

**3. Environment Variables on Coolify:**
- `OPENROUTER_API_KEY`
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `ASTRO_DATABASE_FILE=/app/data/local.db`
- `ASTRO_DB_REMOTE_URL=file:local.db`
- `ASTRO_DB_APP_TOKEN=unused`
- `NIXPACKS_NODE_VERSION=24`

## License

MIT
