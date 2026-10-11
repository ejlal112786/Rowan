# Rowan

Rowan is a multi-provider AI assistant. Users connect their own provider API keys (BYOK) and work
with several model providers — OpenRouter, Google Gemini, DeepSeek, and Mistral — through one
consistent interface.

> **Status: Phase 2 of 10 — database, authentication, and user accounts.**
> Rowan is under active construction. This release adds real PostgreSQL persistence, real
> multi-user authentication (Supabase Auth behind a server-side session interface), ownership-scoped
> data access, and an account settings surface. It does **not** include AI responses, provider
> connections, or stored conversations. See
> [Current capabilities](#current-capabilities-and-limitations) for the exact scope, and
> [Phase 2 verification status](#phase-2-verification-status) for what has and has not been
> verified outside local development.

---

## Table of contents

- [Product overview](#product-overview)
- [Current capabilities and limitations](#current-capabilities-and-limitations)
- [Technology stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment configuration](#environment-configuration)
- [Phase 2 verification status](#phase-2-verification-status)
- [Local development](#local-development)
- [Quality checks](#quality-checks)
- [Project structure](#project-structure)
- [Continuous integration](#continuous-integration)
- [Deploying to Vercel](#deploying-to-vercel)
- [Documentation](#documentation)
- [Roadmap status](#roadmap-status)

---

## Product overview

Rowan is a multi-user assistant with a single consistent interface in front of many model
providers. The complete product (delivered across ten phases) will include:

- Secure registration, authentication, and account management.
- Encrypted BYOK provider-key management.
- A unified chat interface with streaming responses.
- Persistent, searchable conversations.
- Provider and model selection.
- Multi-model comparison, including a Model Arena.
- File attachments and document understanding.
- Configurable assistant instructions and a reusable prompt library.
- Usage tracking, cost estimation, quotas, and abuse prevention.
- Administration, monitoring, and operational tooling.

Phase 1 delivers the foundation those capabilities extend: the framework configuration, the
security and validation conventions, the application shell, and the quality gates.

## Current capabilities and limitations

**Available now (verified):**

| Capability                                          | Notes                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Next.js App Router application                      | Next.js 16, React 19, TypeScript strict mode                                                             |
| Responsive application shell                        | Persistent desktop sidebar, mobile navigation drawer with focus trap                                     |
| Rowan branding and first-use workspace              | Real product surface, not a starter screen                                                               |
| Light / dark / system theming                       | Functional, persisted per browser, no flash of wrong theme                                               |
| Keyboard and screen-reader baseline                 | Skip link, landmarks, `aria-current`, visible focus rings, labelled controls                             |
| Route-level loading, error, and 404 boundaries      | Sanitised error output; no stack traces leaked to users                                                  |
| Typed environment configuration                     | Zod-validated public and server modules with safe error messages                                         |
| Redacting structured logger                         | Server-only; redacts keys, tokens, and prompt/document payloads                                          |
| Error and validation conventions                    | `AppError`, `toPublicError`, `parseOrThrow`, `safeParse`                                                 |
| Automated quality gates                             | Formatting, linting, type checking, 199 unit/component tests, 20 integration tests, production build, CI |
| Registration, sign-in, sign-out, email verification | Real Supabase Auth; httpOnly cookies only; no password ever touches Rowan's database                     |
| Password reset and password change                  | Emailed recovery links; changing a password signs out every other device                                 |
| Account settings                                    | Display name, time zone, bio, live session list with per-session revocation                              |
| Account deletion                                    | Typed confirmation; provider account and every owned row removed                                         |
| PostgreSQL storage with row-level security          | Versioned migrations; every user-owned table protected by policies on a least-privilege role             |
| Ownership-scoped data access                        | Every user-scoped statement runs inside a transaction narrowed to the authenticated owner                |

**Not implemented yet — the interface says so explicitly:**

| Not available                                | Planned phase |
| -------------------------------------------- | ------------- |
| Provider keys and provider API calls         | Phase 3       |
| Chat, streaming, saved conversations         | Phase 4       |
| Model selection and Model Arena              | Phase 5       |
| Attachments and document understanding       | Phase 6       |
| Prompt library, search, workspace management | Phase 7       |
| Usage, cost, quotas, abuse prevention        | Phase 8       |

Disabled controls in the interface are genuinely disabled and are labelled with the phase that
delivers them. Rowan never simulates an AI response, a signed-in user, a saved conversation, or a
usage statistic.

## Technology stack

| Layer           | Choice                                      | Rationale                                                                                                     |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router)                     | Server components by default, server-side privileged work, Vercel-native                                      |
| UI library      | React 19                                    | Required by Next.js 16                                                                                        |
| Language        | TypeScript 5.9, strict                      | `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noUnusedLocals` |
| Styling         | Tailwind CSS v4                             | CSS-first token configuration; no `tailwind.config.js`                                                        |
| Components      | shadcn/ui conventions + Radix UI primitives | Accessible, unstyled primitives owned in-repo                                                                 |
| Icons           | lucide-react                                | Single icon library                                                                                           |
| Validation      | Zod 4                                       | One schema library for env, HTTP input, and provider payloads                                                 |
| Theming         | next-themes                                 | Class-based light/dark/system with no flash                                                                   |
| Authentication  | Supabase Auth (`@supabase/ssr`)             | Managed identity, no custom password storage; reached only from the server                                    |
| Database        | PostgreSQL (`pg`)                           | Direct SQL, no ORM; row-level security as a second line of defence                                            |
| Testing         | Vitest 5 + Testing Library                  | Fast unit and component tests in Node and jsdom                                                               |
| Tooling         | ESLint 9 (flat config) + Prettier 3         | Linting, formatting, Tailwind class sorting                                                                   |
| Package manager | pnpm 10                                     | Strict, content-addressed store; exact dependency graph                                                       |
| Migrations      | Plain SQL files + a small TypeScript runner | Reviewable diffs, no migration framework to learn; applied by `pnpm db:migrate`                               |

## Prerequisites

- **Node.js ≥ 20.9** (development and CI use Node 22; see `.nvmrc`)
- **pnpm 10** — either installed globally (`npm i -g pnpm@10`) or via Corepack:
  ```bash
  corepack enable pnpm
  ```
  The exact version is pinned in `package.json#packageManager`; Corepack honours it automatically.

## Installation

```bash
git clone https://github.com/ejlal112786/Rowan.git
cd Rowan
corepack enable pnpm   # if pnpm is not already available
pnpm install           # installs from the committed pnpm-lock.yaml
cp .env.example .env.local   # optional: Phase 1 runs with an empty environment
```

## Environment configuration

Configuration is validated at runtime by Zod. Two modules define the contract:

- `src/lib/env/public.ts` — `NEXT_PUBLIC_*` values, inlined into the browser bundle at build time.
- `src/lib/env/server.ts` — server-only values; importing it from a client component is a build error.

Rules enforced by the codebase (see [docs/SECURITY.md](docs/SECURITY.md)):

- No secret is ever prefixed with `NEXT_PUBLIC_`.
- No credential is hardcoded, committed, or logged; `.env*` files other than `.env.example` are
  git-ignored.
- Validation errors name the offending variable and never echo its value.
- The application shell renders with an empty environment — no database or provider credential is
  required to build or start Rowan. The signed-out state is a real state, not a fallback.

### Variables

| Variable                    | Scope                       | Required                        | Purpose                                                                                       |
| --------------------------- | --------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`       | Public                      | No                              | Absolute origin used for metadata and auth redirects; unset falls back to relative URLs       |
| `LOG_LEVEL`                 | Server-only                 | No                              | Minimum level for the structured logger: `debug`, `info` (default), `warn`, `error`           |
| `DATABASE_URL`              | Server-only                 | For any database-backed surface | PostgreSQL connection string (`postgres://` or `postgresql://`); never exposed to the browser |
| `SUPABASE_URL`              | Server-only                 | For authentication              | Supabase project URL, `https://<project-ref>.supabase.co`                                     |
| `SUPABASE_ANON_KEY`         | Server-only                 | For authentication              | Supabase publishable key; server-side only because the browser never calls Supabase directly  |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only                 | For account deletion            | Administrative key, used only by account deletion; store it in the platform's secret store    |
| `TEST_DATABASE_URL`         | Server-only, tests only     | No                              | Overrides the throwaway PostgreSQL the integration suite starts by itself                     |
| `VERCEL_ENV`                | Server-only, platform-owned | No                              | Supplied by Vercel; read for informational purposes only                                      |

`DATABASE_URL` must reach the **runtime** environment. `SUPABASE_SERVICE_ROLE_KEY` bypasses
row-level security and can administer accounts: scope it to production only, and rotate it in the
Supabase dashboard if it is ever exposed.

### Local development

`.env.local` is loaded automatically by Next.js and is git-ignored. Copy the example file and edit
only what you need:

```bash
cp .env.example .env.local
```

### Vercel (Preview and Production)

Set variables per environment in **Project → Settings → Environment Variables**:

| Environment | Configuration                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| Preview     | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (preview project or branch database), optionally `LOG_LEVEL` |
| Production  | The same four, plus `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_APP_URL=https://your-production-domain`         |

`VERCEL_ENV` is injected by the platform — do not set it manually. Phase 3 adds the provider-key
encryption secret; every credential must stay scoped to server environments and never be marked
public.

### Phase 2 verification status

| Scope                                                                                  | Verified here                                                  |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Migrations apply to an empty PostgreSQL and are idempotent                             | Yes                                                            |
| Cross-tenant reads and writes fail closed (real policies, real role, real database)    | Yes                                                            |
| Row-level security cannot be bypassed by the runtime role                              | Yes                                                            |
| Sessions live in httpOnly cookies; no token in `localStorage`                          | Yes (code + tests)                                             |
| Sign-out, revocation, and account deletion remove server-side session state            | Yes                                                            |
| Hosted Supabase project: real email delivery, confirmation, recovery, account deletion | **Not yet** — requires a Supabase project and SMTP credentials |
| Vercel deployment of this branch                                                       | **Not yet** — see [Deploying to Vercel](#deploying-to-vercel)  |

## Local development

```bash
pnpm dev          # http://localhost:3000
```

Useful task commands are listed in the next section. `pnpm verify` runs the full gate chain
(formatting, linting, type checking, tests) exactly as CI does.

## Quality checks

| Command                 | What it does                                                         |
| ----------------------- | -------------------------------------------------------------------- |
| `pnpm dev`              | Start the development server (Turbopack)                             |
| `pnpm build`            | Production build — fails on type errors                              |
| `pnpm start`            | Serve the production build locally                                   |
| `pnpm lint`             | ESLint 9 flat config (`eslint .`)                                    |
| `pnpm lint:fix`         | ESLint with automatic fixes                                          |
| `pnpm typecheck`        | `tsc --noEmit` with the strict configuration                         |
| `pnpm format`           | Write Prettier formatting                                            |
| `pnpm format:check`     | Verify formatting without writing                                    |
| `pnpm test`             | Vitest: unit (Node), component (jsdom), and integration (PostgreSQL) |
| `pnpm test:watch`       | Vitest in watch mode                                                 |
| `pnpm test:integration` | Only the integration project, against a throwaway PostgreSQL         |
| `pnpm db:migrate`       | Apply committed migrations to `DATABASE_URL`                         |
| `pnpm db:status`        | Report which migrations are applied, without changing anything       |
| `pnpm verify`           | `format:check` → `lint` → `typecheck` → `test`                       |

Test layout:

| Path                   | Environment             | Covers                                                                                                                                              |
| ---------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/**`        | Node                    | Environment validation, Zod helpers, auth schemas and redirects, error sanitisation, logger redaction, route inventory, session and account helpers |
| `tests/components/**`  | jsdom + Testing Library | Rendering, accessibility, and the honesty of inert controls                                                                                         |
| `tests/integration/**` | Node + real PostgreSQL  | Migration application from an empty database, row-level security, cross-tenant isolation                                                            |

The integration project starts its own PostgreSQL from the bundled `embedded-postgres` binaries
(no Docker, no local server, no network) and applies every migration to it, so
`pnpm test:integration` works on a clean machine. Point `TEST_DATABASE_URL` at an existing database
to use that instead — the suite drops and recreates the `public` schema in it. In CI the database is
the workflow's `postgres:17` service container.

No test requires an AI provider key or an internet connection.

## Project structure

```
src/
  app/                     App Router: layouts, pages, boundaries, global styles
    layout.tsx             Root layout (theme provider + application shell)
    page.tsx               First-use workspace
    error.tsx              Route error boundary (sanitised output)
    global-error.tsx       Last-resort boundary for root-layout failures
    loading.tsx            Route loading boundary
    not-found.tsx          404 page
    conversations/         Conversations index (empty state, planned)
    compare/               Model Arena overview (planned)
    settings/              Account settings: profile and security
    (auth)/                Sign-in, sign-up, password reset, verification, callback
    auth/                  Route handlers: callback, confirmation, sign-out, errors
  components/
    app-shell/             Shell, sidebar, mobile drawer, account menu
    auth/                  Auth forms and their shared field primitives
    brand/                 Logomark and wordmark
    layout/                Page container and header primitives
    settings/              Profile form, password form, session list, danger zone
    ui/                    Design-system primitives (button, card, badge, sheet, …)
    welcome/               First-use workspace content
  config/                  Static product metadata and configuration
  lib/
    auth/                  Session interface, schemas, redirects, form state, server actions
    data/                  Ownership-scoped data access (users, profiles, sessions)
    db/                    Connection pool, transaction scoping, migrations, error mapping
    env/                   Zod-validated environment modules
  proxy.ts                 Request pipeline: session refresh and route protection
scripts/db/migrate.ts      Migration CLI (`pnpm db:migrate`, `pnpm db:status`)
supabase/migrations/       Committed, versioned SQL migrations — the source of truth for schema
tests/
  unit/                    Node-environment tests
  components/              jsdom component tests
  integration/             Tests against a real, throwaway PostgreSQL
  setup/                   Testing Library setup
  support/                 Test stubs and database helpers
docs/                      Architecture, security, roadmap
```

`src/lib/env/server.ts`, `src/lib/logger.ts`, `src/lib/auth/server-client.ts`, and
`src/lib/db/query.ts` import `server-only`, so an accidental client import fails the build rather
than leaking server configuration or database access. The one exception is `src/lib/db/pool.ts`,
which holds the pool constructor and is deliberately free of `server-only` so the migration CLI and
the integration tests can open a connection without booting a React environment.

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm run format:check`
3. `pnpm run lint`
4. `pnpm run typecheck`
5. Unit and component tests (`vitest run --project unit --project components`)
6. Integration tests against the workflow's `postgres:17` service container
7. `pnpm run build`

The workflow uses the Node version from `.nvmrc`, the pnpm version from `package.json`, requests
only `contents: read`, and requires no repository secrets — the only credential in play is the
throwaway database the job starts for itself, whose password is a literal in the workflow file.
Dependency updates are proposed weekly by Dependabot (`.github/dependabot.yml`).

## Deploying to Vercel

Rowan is a standard Next.js application and needs no custom build configuration; no `vercel.json`
is required. Connect the GitHub repository and Vercel detects the framework automatically.

1. **Import the repository** — Vercel dashboard → _Add New…_ → _Project_ → select
   `ejlal112786/Rowan`.
2. **Confirm build settings** (auto-detected): install `pnpm install --frozen-lockfile`, build
   `pnpm build`. Keep the framework preset as **Next.js**.
3. **Environment variables** — set `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` for
   every environment, plus `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_APP_URL` for Production.
   See [Environment configuration](#environment-configuration).
4. **Apply migrations before the first deploy** — `DATABASE_URL=… pnpm db:migrate`, and
   `pnpm db:status` to confirm. Migrations are additive and reviewed like code; Phase 10 wires them
   into the deployment pipeline.
5. **Deploy** — every push to `main` produces a production deployment; every pull request produces
   a preview deployment.

Build-time safety: the production build performs type checking and must succeed without any
production credential. Missing optional variables degrade gracefully instead of failing a build.

**Not yet performed:** no Vercel deployment has been executed from this repository, and no hosted
Supabase project has been connected. Both are external prerequisites listed in
[docs/ROADMAP.md](docs/ROADMAP.md) (Phase 10); until they are met, authentication is verified
against a local PostgreSQL database and its own integration suite only.

## Documentation

| Document                                     | Contents                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Structure, server/client boundaries, planned data and provider architecture, decisions and trade-offs |
| [docs/SECURITY.md](docs/SECURITY.md)         | Security requirements per area, what Phase 1 implements, what remains outstanding                     |
| [docs/ROADMAP.md](docs/ROADMAP.md)           | All ten phases with objectives, dependencies, deliverables, and acceptance criteria                   |

## Roadmap status

| Phase | Title                                                            | Status                                        |
| ----- | ---------------------------------------------------------------- | --------------------------------------------- |
| 1     | Architecture and production foundation                           | **Complete**                                  |
| 2     | Database, authentication, and user accounts                      | **Implemented** — hosted verification pending |
| 3     | Secure API-key management and AI-provider integrations           | Planned                                       |
| 4     | Unified chat, streaming, and persistent conversations            | Planned                                       |
| 5     | Model selection, provider capabilities, and Model Arena          | Planned                                       |
| 6     | Attachments, document understanding, and tools                   | Planned                                       |
| 7     | User settings, prompt library, search, and workspace management  | Planned                                       |
| 8     | Usage tracking, quotas, cost controls, and abuse prevention      | Planned                                       |
| 9     | Security hardening, comprehensive testing, and observability     | Planned                                       |
| 10    | Vercel production deployment, verification, and launch readiness | Planned                                       |
