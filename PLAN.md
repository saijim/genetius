# Genetius - Plant Biology Paper Summaries

## Project Overview

Genetius is a simple website for displaying AI-summarized research papers from bioRxiv's plant biology collection. The target audience is researchers in plant genetics who want to quickly scan the latest papers without reading full abstracts.

### Key Features

- **Paper Fetching**: Automatically fetches papers from bioRxiv API (plant_biology category only)
- **AI Summaries**: Generates 2-3 sentence summaries using OpenRouter's Qwen model
- **Keyword Extraction**: Extracts 3-5 keywords per paper for topic tracking
- **Trend Analysis**: Tracks trending topics and paper types over time (day/week/month/year)
- **Persistent Storage**: SQLite database via Astro DB with markdown conversion
- **Admin Dashboard**: Protected interface for triggering data refreshes
- **Simple Deployment**: Built with Astro v6 beta for easy Coolify deployment

### Technical Stack

- **Framework**: Astro v6 beta with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Astro DB (libSQL/SQLite) for local storage
- **AI Model**: `xiaomi/mimo-v2-flash` via OpenRouter API
- **Deployment**: Coolify with Node 22+ adapter (standalone mode)

### User Requirements

- Only plant_biology category from bioRxiv (no other collections)
- Text lists for trends (no charts/visualizations)
- Keywords + paper type included in trends with counts
- No trending authors
- Basic Auth for admin routes (username: admin, password: password - to be changed later)
- Admin-only refresh (no auto-refresh)
- Persistent data storage with markdown conversion
- Node 22+ required for Astro 6 beta

### Public Pages

1. **Home (`/`)**: Displays latest 50 papers with AI summaries
2. **Trends (`/trends`)**: Shows topic trends and paper types for day/week/month/year with counts

### Admin Pages

1. **Dashboard (`/admin`)**: Protected dashboard showing stats and refresh button
2. **Refresh Endpoint (`/admin/refresh`)**: POST endpoint for triggering paper fetch

### Database Schema

**Papers Table**:
- id, doi (primary key), title, authors (JSON), date, version, type
- summary (2-3 sentences), keywords (JSON array), markdown (full markdown)
- createdAt, updatedAt

**RefreshLog Table**:
- id, date, intervalStart, intervalEnd, papersFetched, papersProcessed, status

### Refresh Logic

- Calculates interval: minimum of 7 days OR days since last refresh
- Fetches papers from bioRxiv with pagination (100 papers per page)
- For new papers: generates summary and keywords → saves to DB
- Logs refresh attempt to RefreshLog table
- Rate limiting: 1s delay between AI API calls with retry on 429

---

# Implementation Plan

### 1. Implement markdown generator
- Create src/lib/markdown.ts
- Implement toMarkdown function
- Format: title, authors, date, version, DOI, category
- Include abstract, AI summary, keywords sections
- Add unit tests for toMarkdown function

### 2. Implement Basic Auth middleware
- Create src/middleware.ts
- Check for /admin routes
- Parse Authorization: Basic header
- Validate against ADMIN_USER and ADMIN_PASSWORD env vars
- Return 401 with WWW-Authenticate if invalid
- Add tests for Basic Auth middleware

### 3. Configure Astro with Tailwind CSS
- Add Tailwind integration: `npx astro add tailwind`
- Consider enabling CSP (Content Security Policy) in astro.config.mjs for security
- Configure Tailwind for existing Astro setup
- Run `ncu` to ensure latest package versions
- Verify project runs with `npm run dev` (now uses real runtime)

### 4. Update environment variables and documentation
- Update .env.example with OPENROUTER_API_KEY, ADMIN_USER, ADMIN_PASSWORD
- Create README.md with setup instructions
- Test complete flow locally

### 5. Implement OpenRouter client
- Create src/lib/openrouter.ts
- Implement generateSummary function (2-3 sentences)
- Implement extractKeywords function (3-5 keywords)
- Use model: xiaomi/mimo-v2-flash
- Add rate limiting (1s delay, retry on 429)
- Handle errors gracefully
- Add unit tests for generateSummary and extractKeywords with mock API

### 6. Create UI components
- Create src/components/PaperCard.astro
- Create src/components/TrendList.astro
- Create src/components/AdminHeader.astro
- Style with Tailwind CSS
- Add component tests for PaperCard, TrendList, and AdminHeader

### 7. Define database schema
- Create db/config.ts with Papers and RefreshLog tables
- Define all columns for Papers table (doi, title, authors, etc.)
- Define all columns for RefreshLog table
- Create db/seed.ts with initial refresh log entry
- Add tests for database schema validation and seed script

### 8. Add Astro DB and Node adapter integrations
- Run `npx astro add db` for Astro DB
- Run `npx astro add node` for Node adapter
- Run `ncu` to check for package updates, then `ncu -u && npm install`
- Configure Node adapter in standalone mode
- Set output to 'server'

### 9. Build admin pages
- Create src/pages/admin/index.astro (dashboard)
- Create src/pages/admin/refresh.astro (POST endpoint)
- Display total papers, last refresh, status
- Add refresh button with loading state
- Add integration tests for admin endpoints

### 10. Implement BioRxiv API client
- Create src/lib/biorxiv.ts
- Implement fetchPapers function with interval and cursor
- Handle pagination (100 papers per page)
- Return normalized paper objects
- Filter by category=plant_biology
- Add tests for BioRxiv API client with mock responses

### 11. Implement paper fetch orchestration
- Create src/lib/paper-fetch.ts
- Get last refresh date from RefreshLog
- Calculate interval: min(7 days, days since last refresh)
- Fetch papers from BioRxiv with pagination
- For new papers: generate summary + keywords → save to DB
- Log refresh attempt to RefreshLog
- Return operation summary
- Add end-to-end tests for paper fetch orchestration

### 12. Implement trend analysis
- Create src/lib/trends.ts
- Query Papers table for day/week/month/year periods
- Count keyword frequency from keywords JSON
- Count paper type frequency
- Return top 10 keywords + types per period with counts
- Use SQLite aggregation
- Add unit tests for trend analysis logic

### 13. Build public pages
- Create src/pages/index.astro (latest 50 papers)
- Create src/pages/trends.astro (trends with counts)
- Set prerender = false for both
- Fetch from database and display
- Add integration tests for public pages with test database

### 14. Maintain dependencies
- Run `ncu` regularly to check for package updates
- Run `ncu -u` to update package.json, then `npm install`
- Always run `ncu` after adding new packages to ensure latest versions
- Check for updates before major releases
- Test application after updates to ensure compatibility

---

## General Development Practices

### GitHub CLI (gh) for task tracking
- List projects: `gh project list` to find "implementation" project
- View project: `gh project view <id>` to see current status
- Create draft issue in project: `gh project item-create <id> --title "Implement markdown generator"`
- Add existing issue to project: `gh project item-add <id> --issue <issue-number>`
- List project items: `gh project item-list <id>` to see all tasks
- Edit item status: `gh project item-edit <project-id> --id <item-id> --field-id <status-field-id> --field-value "Done"`
- Add labels: feature, bug, enhancement, test
- Use milestones to track progress: setup, core features, ui, deployment
- Reference issues in commit messages: `git commit -m "feat: add markdown generator (#1)"`
- Use `gh issue create`, `gh issue close`, `gh issue list` to manage issues
- Use `gh pr create` for pull requests with linked issues

### Node.js path configuration
- Node.js is installed via nvm at `/home/jan/.local/share/nvm/v24.13.0/bin/`
- Always prefix npm/npx commands with: `PATH=/home/jan/.local/share/nvm/v24.13.0/bin:$PATH`
- Example: `PATH=/home/jan/.local/share/nvm/v24.13.0/bin:$PATH npm install ...`
- This applies to all npm, npx, and Node-based commands

### Dependency management with ncu
- Run `ncu` before and after adding packages: check latest versions
- Run `ncu -u && npm install` to update all dependencies
- Ensure all packages are at latest compatible versions
