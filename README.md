# Rowan

Rowan is a multi-provider AI assistant. Users connect their own provider API keys (BYOK) and work
with several model providers — OpenRouter, Google Gemini, DeepSeek, and Mistral — through one
consistent interface.

> **Status: Phase 1 of 10 — production foundation.**
> Rowan is under active construction. This release establishes the architecture, the application
> shell, the engineering standards, and the deployment foundation. It does **not** include AI
> responses, authentication, provider connections, or stored conversations. See
> [Current capabilities](#current-capabilities-and-limitations) for the exact scope.

---

## Table of contents

- [Product overview](#product-overview)
- [Current capabilities and limitations](#current-capabilities-and-limitations)
- [Technology stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment configuration](#environment-configuration)
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

| Capability                                     | Notes                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Next.js App Router application                 | Next.js 16, React 19, TypeScript strict mode                                      |
| Responsive application shell                   | Persistent desktop sidebar, mobile navigation drawer with focus trap              |
| Rowan branding and first-use workspace         | Real product surface, not a starter screen                                        |
| Light / dark / system theming                  | Functional, persisted per browser, no flash of wrong theme                        |
| Keyboard and screen-reader baseline            | Skip link, landmarks, `aria-current`, visible focus rings, labelled controls      |
| Route-level loading, error, and 404 boundaries | Sanitised error output; no stack traces leaked to users                           |
| Typed environment configuration                | Zod-validated public and server modules with safe error messages                  |
| Redacting structured logger                    | Server-only; redacts keys, tokens, and prompt/document payloads                   |
| Error and validation conventions               | `AppError`, `toPublicError`, `parseOrThrow`, `safeParse`                          |
| Automated quality gates                        | Formatting, linting, type checking, 74 unit/component tests, production build, CI |

**Not implemented yet — the interface says so explicitly:**

| Not available                                | Planned phase |
| -------------------------------------------- | ------------- |
| Accounts, sign-in, sessions                  | Phase 2       |
| Database, persistence of any kind            | Phase 2       |
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

| Layer              | Choice                                      | Rationale                                                                                                     |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Framework          | Next.js 16 (App Router)                     | Server components by default, server-side privileged work, Vercel-native                                      |
| UI library         | React 19                                    | Required by Next.js 16                                                                                        |
| Language           | TypeScript 5.9, strict                      | `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noUnusedLocals` |
| Styling            | Tailwind CSS v4                             | CSS-first token configuration; no `tailwind.config.js`                                                        |
| Components         | shadcn/ui conventions + Radix UI primitives | Accessible, unstyled primitives owned in-repo                                                                 |
| Icons              | lucide-react                                | Single icon library                                                                                           |
| Validation         | Zod 4                                       | One schema library for env, HTTP input, and provider payloads                                                 |
| Theming            | next-themes                                 | Class-based light/dark/system with no flash                                                                   |
| Testing            | Vitest 5 + Testing Library                  | Fast unit and component tests in Node and jsdom                                                               |
| Tooling            | ESLint 9 (flat config) + Prettier 3         | Linting, formatting, Tailwind class sorting                                                                   |
| Package manager    | pnpm 10                                     | Strict, content-addressed store; exact dependency graph                                                       |
| Planned data layer | PostgreSQL (Supabase preferred)             | Documented integration points only — not connected in Phase 1                                                 |

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
  required to build or start Rowan.

### Variables

| Variable              | Scope                       | Required | Purpose                                                                             |
| --------------------- | --------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL` | Public                      | No       | Absolute origin used for metadata; unset falls back to relative URLs                |
| `LOG_LEVEL`           | Server-only                 | No       | Minimum level for the structured logger: `debug`, `info` (default), `warn`, `error` |
| `VERCEL_ENV`          | Server-only, platform-owned | No       | Supplied by Vercel; read for informational purposes only                            |

### Local development

`.env.local` is loaded automatically by Next.js and is git-ignored. Copy the example file and edit
only what you need:

```bash
cp .env.example .env.local
```

### Vercel (Preview and Production)

Set variables per environment in **Project → Settings → Environment Variables**:

| Environment | Recommended configuration                                                                |
| ----------- | ---------------------------------------------------------------------------------------- |
| Preview     | Leave empty, or set `NEXT_PUBLIC_APP_URL` to the preview URL if absolute URLs are needed |
| Production  | `NEXT_PUBLIC_APP_URL=https://your-production-domain`, optionally `LOG_LEVEL=warn`        |

`VERCEL_ENV` is injected by the platform — do not set it manually. Phase 2 and Phase 3 add the
database and provider variables; those must be scoped to _server_ environments only and never
marked public.

## Local development

```bash
pnpm dev          # http://localhost:3000
```

Useful task commands are listed in the next section. `pnpm verify` runs the full gate chain
(formatting, linting, type checking, tests) exactly as CI does.

## Quality checks

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `pnpm dev`          | Start the development server (Turbopack)              |
| `pnpm build`        | Production build — fails on type errors               |
| `pnpm start`        | Serve the production build locally                    |
| `pnpm lint`         | ESLint 9 flat config (`eslint .`)                     |
| `pnpm lint:fix`     | ESLint with automatic fixes                           |
| `pnpm typecheck`    | `tsc --noEmit` with the strict configuration          |
| `pnpm format`       | Write Prettier formatting                             |
| `pnpm format:check` | Verify formatting without writing                     |
| `pnpm test`         | Vitest: unit tests (Node) and component tests (jsdom) |
| `pnpm test:watch`   | Vitest in watch mode                                  |
| `pnpm verify`       | `format:check` → `lint` → `typecheck` → `test`        |

Test layout: `tests/unit/**` runs in a Node environment, `tests/components/**` runs in jsdom with
Testing Library. The suite covers environment validation, Zod helpers, error sanitisation, logger
redaction, utility behaviour, product-configuration integrity, and the honesty of the inert
composer and navigation controls. No test requires a provider key or a network connection.

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
    settings/              Settings index (planned)
  components/
    app-shell/             Shell, sidebar, mobile drawer, account area
    brand/                 Logomark and wordmark
    layout/                Page container and header primitives
    ui/                    Design-system primitives (button, card, badge, sheet, …)
    welcome/               First-use workspace content
  config/                  Static product metadata and configuration
  lib/                     Utilities, environment validation, errors, logger
tests/
  unit/                    Node-environment tests
  components/              jsdom component tests
  setup/                   Testing Library setup
  support/                 Test stubs
docs/                      Architecture, security, roadmap
```

`src/lib/env/server.ts` and `src/lib/logger.ts` import `server-only`, so an accidental client import
fails the build rather than leaking server configuration.

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm run format:check`
3. `pnpm run lint`
4. `pnpm run typecheck`
5. `pnpm run test`
6. `pnpm run build`

The workflow uses the Node version from `.nvmrc`, the pnpm version from `package.json`, requests
only `contents: read`, and requires no secrets — it passes with an empty environment. Dependency
updates are proposed weekly by Dependabot (`.github/dependabot.yml`).

## Deploying to Vercel

Rowan is a standard Next.js application and needs no custom build configuration; no `vercel.json`
is required. Connect the GitHub repository and Vercel detects the framework automatically.

1. **Import the repository** — Vercel dashboard → _Add New…_ → _Project_ → select
   `ejlal112786/Rowan`.
2. **Confirm build settings** (auto-detected): install `pnpm install --frozen-lockfile`, build
   `pnpm build`. Keep the framework preset as **Next.js**.
3. **Environment variables** — leave Preview empty for now; for Production set
   `NEXT_PUBLIC_APP_URL` (and optionally `LOG_LEVEL`).
4. **Deploy** — every push to `main` produces a production deployment; every pull request produces
   a preview deployment.

Build-time safety: the production build performs type checking and must succeed without any
production credential. Missing optional variables degrade gracefully instead of failing a build.

**Not yet performed:** no Vercel deployment has been executed from this repository as part of
Phase 1. Missing external prerequisites are listed in [docs/ROADMAP.md](docs/ROADMAP.md) (Phase 10)
and in the Phase 1 completion report.

## Documentation

| Document                                     | Contents                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Structure, server/client boundaries, planned data and provider architecture, decisions and trade-offs |
| [docs/SECURITY.md](docs/SECURITY.md)         | Security requirements per area, what Phase 1 implements, what remains outstanding                     |
| [docs/ROADMAP.md](docs/ROADMAP.md)           | All ten phases with objectives, dependencies, deliverables, and acceptance criteria                   |

## Roadmap status

| Phase | Title                                                            | Status       |
| ----- | ---------------------------------------------------------------- | ------------ |
| 1     | Architecture and production foundation                           | **Complete** |
| 2     | Database, authentication, and user accounts                      | Next         |
| 3     | Secure API-key management and AI-provider integrations           | Planned      |
| 4     | Unified chat, streaming, and persistent conversations            | Planned      |
| 5     | Model selection, provider capabilities, and Model Arena          | Planned      |
| 6     | Attachments, document understanding, and tools                   | Planned      |
| 7     | User settings, prompt library, search, and workspace management  | Planned      |
| 8     | Usage tracking, quotas, cost controls, and abuse prevention      | Planned      |
| 9     | Security hardening, comprehensive testing, and observability     | Planned      |
| 10    | Vercel production deployment, verification, and launch readiness | Planned      |
