# AGENTS.md - Guidelines for Agentic Coding in Genetius

## Project Overview

Genetius is an Astro 6 beta project displaying AI-summarized plant biology papers from bioRxiv.

**Tech Stack:** Astro 6 beta, TypeScript strict mode, Tailwind CSS, Astro DB (SQLite/libSQL), Node adapter, OpenRouter API

---

## Build / Lint / Test Commands

```bash
# Development
npm run dev          # Start dev server at localhost:4321
npm run build        # Production build (needs ASTRO_DATABASE_FILE env var or --remote)
npm run preview      # Preview production build locally

# Astro CLI
npx astro check      # Type check with Astro
npx astro add <name> # Add integration (e.g., tailwind, db, node)

# Testing
npm run test         # Run all tests (watch mode)
npm run test:unit    # Run unit tests only
npm run test:integration # Run integration tests only
npm run test <path>  # Run single test: npm run test src/lib/markdown.test.ts
npm run test -- --run # Run once without watch
npx vitest <path> --run # Alternative for single test

# Dependency Updates
ncu                  # Check for package updates
ncu -u && npm install # Update all dependencies

# Linting/Type Checking
npx tsc --noEmit     # TypeScript type checking (strict mode)
```

**Note:** Node.js installed via nvm at `/home/jan/.local/share/nvm/v24.13.0/bin/`. Prefix all npm/npx commands with `PATH=/home/jan/.local/share/nvm/v24.13.0/bin:$PATH`

---

## Code Style Guidelines

### Imports
- Use ES module imports (no CommonJS)
- Absolute imports for project files: `import { toMarkdown } from '~/lib/markdown'`
- External dependencies: `import { z } from 'astro:content'`
- Keep imports at top of file, grouped: 1) external, 2) internal, 3) types

### Formatting & Spacing
- Use **2 spaces** for indentation (no tabs)
- Max line length: 100 characters
- Use semicolons at end of statements
- Use single quotes for strings, double quotes only when needed

### TypeScript & Types
- Strict mode enabled (astro/tsconfigs/strict)
- Explicitly type function parameters and return values
- Use interfaces for object shapes, type aliases for unions/primitives
- Avoid `any` - use `unknown` or specific types
- Use Zod for runtime validation when needed (Astro 6 uses Zod 4)

### Naming Conventions
- **Files:** kebab-case: `paper-fetch.ts`, `admin-header.astro`
- **Variables/functions:** camelCase: `generateSummary`, `paperData`
- **Constants/exports:** UPPER_SNAKE_CASE: `OPENROUTER_API_KEY`, `DEFAULT_MODEL`
- **Interfaces/Types:** PascalCase: `Paper`, `RefreshLog`, `FetchOptions`
- **Components:** PascalCase: `PaperCard.astro`, `TrendList.astro`

### Error Handling
- Always handle async errors with try/catch
- Return structured error objects: `{ error: string, details?: unknown }`
- Use type guards for external API errors: `isBiorxivError()`, `isOpenRouterError()`
- Log errors with context, don't expose sensitive data
- Use Astro's `Astro.redirect('/500')` for unrecoverable errors
- Database errors: return null or empty array, log internally

### Astro Components
- Use `.astro` for components and pages
- **CRITICAL:** All `.astro` files MUST start with `---` frontmatter fence
- Frontmatter format: `---` (line 1) → code/imports/props → `---` → HTML
- Use typed props interfaces: `interface Props { title: string }`
- Set `export const prerender = false;` for SSR pages (default for `/admin/`)
- Keep template HTML clean, embed logic in frontmatter
- Use `<slot />` for composition in reusable components

### Database (Astro DB)
- Place schema in `db/config.ts`
- Use TypeScript for type-safe queries
- migrations in `db/migrations/` directory
- seed scripts in `db/seed.ts`
- Run `npx astro db push` to apply schema changes
- Use `db/` namespace for all database-related imports

### Environment Variables
- Define in `.env.example`, never commit `.env`
- Access via `import.meta.env.VAR_NAME`
- Required: `OPENROUTER_API_KEY`, `ADMIN_USER`, `ADMIN_PASSWORD`
- Validate at runtime, fail fast if missing

### Testing
- Unit tests: colocated with source: `lib/toMarkdown.ts` → `lib/toMarkdown.test.ts`
- Integration tests: separate dir: `tests/integration/` or colocated for pages
- Mock external APIs (OpenRouter, bioRxiv) with Vitest mocks (`vi.mock()`, `vi.fn()`)
- Test happy path + error cases + edge cases
- Write descriptive test names: `should generate summary with valid input`
- Use `describe` blocks to group tests, `it` or `test` for individual tests
- Clean up mocks in `afterEach` to prevent cross-test contamination
- File content analysis for component tests (Astro limitation)

### Security
- No comments with secrets or API keys
- Sanitize all user inputs before database queries
- Enable CSP in astro.config.mjs for production
- Never expose raw error messages to client
- Validate environment variables on startup
- Use prepared statements for all DB queries
- Rate-limit external API calls

### Git Commit Messages
- Format: `type: description (#issue)` if applicable
- Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`
- Examples: `feat: add markdown generator`, `fix: rate limit retry logic`
- Conventional commits format preferred
- Reference related issues when available
- Keep messages under 72 characters for title

---

## Special Notes

- **Astro 6 Beta:** Run `npx @astrojs/upgrade beta` before major changes
- **Node Version:** Requires Node 22+
- **Runtime:** `astro dev` now uses real runtime (Node) - test platform APIs locally
- **Admin Routes:** Protected via Basic Auth in `src/middleware.ts`
- **Data Freshness:** No auto-refresh - admin-triggered only via `/admin/refresh` POST endpoint

---

## Before You Start

Always read the existing code before making changes. Check:
1. Existing patterns in similar files (components, lib functions)
2. Database schema in `db/config.ts` before adding queries
3. Environment variables in `.env.example` before adding new ones
4. PLAN.md for project context and implementation steps
