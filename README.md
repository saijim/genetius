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

- **Framework**: Astro 6 beta
- **Styling**: Tailwind CSS
- **Database**: Astro DB (libSQL/SQLite)
- **AI Model**: `xiaomi/mimo-v2-flash` via OpenRouter API
- **Testing**: Vitest
- **Deployment**: Coolify with Node adapter (standalone mode)

## Prerequisites

- Node.js 22+ (via nvm)
- OpenRouter API key (free tier available)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
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
   npm run dev
   ```

## Development

```bash
npm run dev          # Start dev server at localhost:4321
npm run build        # Production build to ./dist/
npm run preview      # Preview production build locally
npm run test         # Run all tests
npm run test:unit    # Run unit tests only
npx astro check      # Type check with Astro
npx tsc --noEmit     # TypeScript type checking
```

## Project Structure

```
src/
├── components/      # Astro components
├── lib/            # Utility functions
│   ├── markdown.ts # Markdown generator
│   └── auth.ts     # Auth validation
├── pages/          # Route pages
│   ├── admin/      # Protected admin routes
│   ├── index.astro # Home page
│   └── trends.astro
├── styles/         # Global styles
└── middleware.ts   # Astro middleware
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

## Security Notes

- Change default admin password before deployment
- Enable CSP in production
- Never commit `.env` file
- Use rate limiting for external API calls

## Deployment

Built for Coolify with Node 22+ adapter (standalone mode).

## License

MIT
