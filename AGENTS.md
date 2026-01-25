# AGENTS.md - Guidelines for Agentic Coding in Genetius

## Project Overview

Genetius is an Astro 6 beta project displaying AI-summarized plant biology papers from bioRxiv.

**Tech Stack:** 
- **Framework:** Astro 6 beta (Server-side rendering enabled)
- **Language:** TypeScript (Strict mode)
- **Styling:** Tailwind CSS v4 (Vite plugin)
- **Database:** Astro DB (SQLite/libSQL)
- **Runtime:** Node.js 22+ (via @astrojs/node)
- **API:** OpenRouter (LLM integration)

---

## Build / Lint / Test Commands

### Development & Production
```bash
# Development
bun run dev           # Start dev server at localhost:4321
bun run dev:persist   # Start dev server with persistent local DB file (local.db)
bun run preview       # Preview production build locally

# Production
bun run build         # Build for production (requires ASTRO_DATABASE_FILE or --remote)
bun run start         # Start the built Node.js server (./dist/server/entry.mjs)

# Astro CLI
bunx astro check       # Type check templates and content
bunx astro add <name>  # Add integrations
```

### Testing (Vitest)
```bash
# Run Tests
bun run test          # Run all tests in watch mode
bun run test:watch    # Explicit watch mode command
bun run test:unit     # Run unit tests only (verbose reporter)
bun run test:integration # Run integration tests only

# Run Single Test
bun run test <path>   # Run tests matching path (e.g., src/lib/utils.test.ts)
bunx vitest <path>     # Alternative direct invocation

# CI / One-off
bun run test -- --run # Run all tests once (no watch)
```

### Maintenance
```bash
# Dependencies
bunx npm-check-updates # Check for updates (npm-check-updates)
bunx npm-check-updates -u && bun install # Update all dependencies

# Linting
bunx tsc --noEmit      # Run TypeScript compiler check (strict)
```

**Environment Note:** Node.js is managed via nvm. Ensure `v24.13.0` (or 22+) is active.
Prefix commands if needed: `PATH=/home/jan/.local/share/nvm/v24.13.0/bin:$PATH`

**Package Manager:** Use `bun` for all package management commands (install, add, remove). Do NOT use `npm` or `pnpm` for package management.

---

## Code Style Guidelines

### Imports & Aliases
- **Format:** ES Modules only.
- **Aliases:** Use `~/` for `src/` (e.g., `import { db } from '~/db/config'`).
- **Grouping:** 
  1. External (`astro:content`, `zod`)
  2. Internal (`~/lib`, `~/components`)
  3. Types (`type Paper`, `interface Props`)

### TypeScript & Schema
- **Strict Mode:** No `any`. Use `unknown` with narrowing or strict interfaces.
- **Validation:** Use `zod` (v4) for all runtime data validation.
- **Props:** Define `interface Props` in Astro components.
- **DB:** Use `astro:db` types. Schema is in `db/config.ts`.

### Naming Conventions
- **Files:** `kebab-case.ts`, `Component.astro`
- **Variables:** `camelCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Components:** `PascalCase`
- **DB Tables:** `PascalCase` (defined in schema), queried as `db.select().from(Paper)`

### Astro Components
- **Structure:**
  ```astro
  ---
  import { Layout } from '~/layouts';
  interface Props { title: string; }
  const { title } = Astro.props;
  ---
  <Layout>{title}</Layout>
  ```
- **Directives:** Use `client:*` directives sparingly. 
- **SSR:** `export const prerender = false;` is default for dynamic pages.

### Database (Astro DB)
- **Schema:** Defined in `db/config.ts`.
- **Migrations:** Managed via `npx astro db push`.
- **Queries:** Use the `db` object from `astro:db`. 
  - Example: `await db.select().from(Paper).limit(10)`
- **Seeding:** Use `db/seed.ts` for development data.

### Error Handling
- **Async/Await:** Always wrap db/api calls in `try/catch`.
- **UI:** Render fallback UI for partial failures. 
- **Critical:** Use `Astro.redirect('/500')` for fatal errors.
- **Logging:** Log errors with actionable context.

---

## Testing Strategy

- **Unit Tests:** Colocate with code (e.g., `lib/parser.ts` -> `lib/parser.test.ts`).
  - Focus on logic, utilities, and transformers.
- **Integration Tests:** Locate in `tests/integration/`.
  - Test DB interactions and API flows.
- **Mocking:** Use `vi.mock()` for `astro:db` and external APIs.
  - Reset mocks in `afterEach`.

## Security & Environment

- **Secrets:** Never commit `.env`. Use `.env.example`.
- **Access:** `import.meta.env.SECRET_KEY`.
- **Validation:** Check required env vars at startup/runtime.
- **Sanitization:** Validate all inputs with Zod before DB insertion.

## Git Workflow

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).
- **Scope:** Keep changes atomic.
- **Message:** meaningful description (e.g., `fix: update rate limit logic`).

## Task Checklist
Before marking a task as complete:
1. [ ] Run `bunx astro check` to verify types.
2. [ ] Run `bun run test` to ensure no regressions.
3. [ ] Verify `bun run build` succeeds.
4. [ ] Check strict mode compliance (no implicit any).
