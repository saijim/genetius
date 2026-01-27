# AGENTS.md - Guidelines for Agentic Coding in Genetius

## Project Overview

Genetius is an Astro 6 beta project displaying AI-summarized plant biology papers from bioRxiv.

**Tech Stack:**
- **Framework:** Astro 6 beta (SSR enabled)
- **Language:** TypeScript (Strict mode)
- **Styling:** Tailwind CSS v4 (Vite plugin)
- **Database:** Astro DB (local SQLite - local.db)
- **Runtime:** Node.js 22+ (via @astrojs/node)
- **API:** OpenRouter (LLM integration)

---

## Build / Lint / Test Commands

```bash
# Development
bun run dev           # Start dev server at localhost:4321
bun run dev:persist   # Start dev server with persistent local DB file
bun run preview       # Preview production build locally

# Production
bun run build         # Build for production
bun run start         # Start the built Node.js server

# Astro CLI
bunx astro check      # Type check templates and content

# Testing (Vitest)
bun run test          # Run all tests in watch mode
bun run test:unit     # Run unit tests only (verbose reporter)
bun run test:integration # Run integration tests only
bun run test <path>   # Run tests matching path (e.g., src/lib/utils.test.ts)
bunx vitest <path>    # Alternative direct invocation
bun run test -- --run # Run all tests once (no watch)

# Maintenance
bunx tsc --noEmit     # TypeScript compiler check (strict)
bunx npm-check-updates -u && bun install # Update all dependencies
```

**Environment:** Node.js v24.13.0+ via nvm. Prefix with `PATH=/home/jan/.local/share/nvm/v24.13.0/bin:$PATH` if needed.
**Package Manager:** Use `bun` only (enforced via preinstall hook).

---

## Code Style Guidelines

**Imports & Aliases:**
- ES Modules only. Use `~/` for `src/` (e.g., `import { db } from '~/db/config'`).
- Group: External → Internal (`~/lib`, `~/components`) → Types

**TypeScript & Schema:**
- No `any`. Use `unknown` with narrowing or strict interfaces.
- Use `zod` (v4) for runtime validation. Define `interface Props` in components.
- Use `astro:db` types. Schema in `db/config.ts`.

**Naming Conventions:**
- Files: `kebab-case.ts`, `Component.astro`
- Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Components: `PascalCase`
- DB Tables: `PascalCase` (schema), queried as `db.select().from(Paper)`

**Astro Components:**
- ```astro
  ---
  import { Layout } from '~/layouts';
  interface Props { title: string; }
  const { title } = Astro.props;
  ---
  <Layout>{title}</Layout>
  ```
- Use `client:*` directives sparingly. `export const prerender = false;` is default.

**Database (Astro DB):**
- Schema in `db/config.ts`. File: `local.db`. Production: `/app/data/local.db`
- Migrations via `npx astro db push`. Queries: `await db.select().from(Paper).limit(10)`
- Use `db/seed.ts` for dev data. `bun run dev:persist` for persistent DB.

**Error Handling:**
- Wrap db/api calls in `try/catch`. Render fallback UI for partial failures.
- Use `Astro.redirect('/500')` for fatal errors. Log with actionable context.

**Testing Strategy:**
- Unit tests: Colocate (e.g., `lib/parser.ts` → `lib/parser.test.ts`)
- Integration tests: `tests/integration/`. Mock `astro:db` with `vi.mock()`. Reset in `afterEach`.

**Security & Environment:**
- Never commit `.env`. Use `.env.example`. Access via `import.meta.env.SECRET_KEY`.
- Check required env vars at startup. Validate inputs with Zod before DB insertion.

**Git Workflow:**
- Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`). Keep changes atomic.

---

## Task Checklist
Before marking complete:
1. [ ] Run `bunx astro check` to verify types
2. [ ] Run `bun run test` to ensure no regressions
3. [ ] Verify `bun run build` succeeds
4. [ ] Check strict mode compliance (no implicit any)

---

## IMPORTANT: Use `bd` for task planning

## Landing the Plane (Session Completion)

**Work is NOT complete until `git push` succeeds.**

**MANDATORY WORKFLOW:**
1. File issues for remaining work
2. Run quality gates (tests, linters, builds) if code changed
3. Update issue status (close finished work, update in-progress)
4. **PUSH TO REMOTE:**
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. Clean up stashes, prune remote branches
6. Verify all changes committed AND pushed
7. Provide context for next session

**CRITICAL RULES:**
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
