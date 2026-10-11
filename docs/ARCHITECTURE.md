# Rowan — Architecture

This document describes how Rowan is structured, where the server/client boundary sits, how later
phases are expected to extend the foundation, and which trade-offs were accepted in Phase 1.

**Scope note:** Phase 1 delivers the foundation. Where this document describes the database,
authentication, provider adapters, or streaming, it marks those parts as _planned_ — they are
design contracts, not running code. Nothing in this repository connects to a provider or a
database today.

---

## 1. Application structure

```
src/
  app/                  Routing, layouts, and boundaries (App Router)
  components/           Reusable UI, shell, and first-use surfaces
  config/               Static product configuration (no secrets, no I/O)
  lib/                  Utilities, environment validation, error handling, logging
tests/                  Unit and component tests
docs/                   Architecture, security, roadmap
```

Directory responsibilities:

| Path             | Responsibility                                             | Rules                                                                           |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/app`        | Routing, metadata, global styles, error/loading boundaries | Server components by default; pages stay thin and compose from `components/`    |
| `src/components` | Presentation and interaction                               | Only components that need state, effects, or browser APIs are client components |
| `src/config`     | Product metadata, navigation, planned provider list        | Static data only — no `process.env`, no network calls, no secrets               |
| `src/lib`        | Cross-cutting utilities                                    | Pure helpers where possible; privileged modules import `server-only`            |
| `tests`          | Unit + component tests                                     | Node environment for logic, jsdom for rendering; no network access              |

Shared domain types are declared next to the module that owns them (for example `NavItem` in
`src/config/navigation.ts`). A catch-all `src/types/` directory is deliberately avoided until real
cross-cutting types exist, to prevent a folder of unused aliases.

### Route inventory (Phase 1)

| Route            | File                                            | Purpose                                                                   |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| `/`              | `src/app/page.tsx`                              | First-use workspace: product framing, inert composer, honest build status |
| `/conversations` | `src/app/conversations/page.tsx`                | Empty state; explains that storage is Phase 4                             |
| `/compare`       | `src/app/compare/page.tsx`                      | Model Arena overview; no inputs, no results                               |
| `/settings`      | `src/app/settings/page.tsx`                     | Index of planned configuration groups; nothing editable                   |
| 404              | `src/app/not-found.tsx`                         | Not-found page                                                            |
| errors           | `src/app/error.tsx`, `src/app/global-error.tsx` | Sanitised error output and recovery                                       |
| loading          | `src/app/loading.tsx`                           | Route-level loading boundary                                              |

## 2. Server and client boundaries

Rowan defaults to React Server Components.

**Server by default**

- `src/app/layout.tsx`, all pages, and the shell's sidebar (`src/components/app-shell/sidebar.tsx`)
  render on the server.
- Static configuration and all data access (planned) happen on the server.
- `src/lib/env/server.ts` and `src/lib/logger.ts` import the `server-only` marker package. Importing
  either from a client component is a build error, which is the enforcement mechanism for the
  "secrets never reach the browser" rule.

**Client where interaction requires it**

| Component                                                                                   | Why it is a client component                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `components/app-shell/app-shell.tsx`                                                        | Reads the current pathname to key the mobile drawer          |
| `components/app-shell/mobile-navigation.tsx`                                                | Owns drawer open/close state                                 |
| `components/app-shell/sidebar-nav.tsx`                                                      | `usePathname()` for active-route state                       |
| `components/app-shell/account-menu.tsx`                                                     | Radix dropdown interaction                                   |
| `components/ui/theme-toggle.tsx`                                                            | `next-themes` preference state                               |
| `components/ui/sheet.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/separator.tsx` | Radix primitives (`use client` is inside the Radix packages) |
| `components/theme-provider.tsx`                                                             | `next-themes` provider                                       |
| `components/ui/button.tsx`                                                                  | Radix `Slot` composition (`asChild`)                         |

**Composition pattern:** `src/app/layout.tsx` (server) renders
`<AppShell sidebar={<Sidebar />}>{children}</AppShell>`. The interactive shell is a client
component, but the sidebar markup and page content are authored and rendered on the server. This
keeps client JavaScript limited to interaction while avoiding duplicated navigation markup.

### The `server-only` boundary in tests

`server-only` throws outside a React Server Component environment. `vitest.config.mts` aliases the
package to `tests/support/server-only-stub.ts` so server modules remain unit-testable. This is the
only place the boundary is relaxed, and it does not weaken the production guarantee.

## 3. Intended data architecture (planned — Phase 2)

- **Primary database:** PostgreSQL; **Supabase** is the preferred managed provider.
- **Access path:** server-only modules. No database client is ever imported into a client bundle.
- **Schema ownership (planned):** `users`, `accounts`/`sessions`, `provider_credentials` (encrypted
  BYOK), `conversations`, `messages`, `attachments`, `assistant_prompts`, `usage_records`. Exact
  shapes are defined with migrations in Phases 2–8.
- **Migrations:** versioned SQL migrations committed to the repository and applied through an
  explicit, reviewable process before deployment (Phase 10).
- **Ownership rule (mandatory):** every query that touches user-owned rows must filter by the
  authenticated owner — enforced in the data-access layer, not in UI code, and covered by tests
  that attempt cross-tenant reads.
- **No local filesystem persistence:** application data lives in PostgreSQL. The deployment target
  (Vercel) has an ephemeral filesystem, so uploaded documents will be stored in object storage
  behind authenticated, short-lived URLs (Phase 6).
- **Configuration:** introduced in `src/lib/env/server.ts` when Phase 2 lands — Phase 1 ships no
  database variables, and the shell must not require them.

## 4. Planned authentication integration (Phase 2)

- Supabase Auth is the intended primary mechanism, kept behind a thin server-side session interface
  (`getCurrentUser()`) so the provider can change without touching feature code.
- Sessions are httpOnly cookies; tokens never reach client JavaScript or `localStorage`.
- Route protection happens in server components and route handlers — never only in the UI.
- Client components receive only the minimum identity data they need to render.
- Authorization decisions are made server-side per request, using the authenticated user id; a
  client-supplied id is never trusted.

## 5. Planned provider-adapter architecture (Phase 3)

All provider communication is server-side and sits behind one internal interface:

```
src/lib/providers/
  types.ts          ProviderAdapter, ProviderCapabilities, ChatRequest, ChatChunk, UsageReport
  registry.ts       id → adapter lookup; server-only
  openrouter.ts     one module per provider; the only place a provider SDK/HTTP call exists
  gemini.ts
  deepseek.ts
  mistral.ts
```

Contract expectations:

- `ProviderAdapter.streamChat(request, signal): AsyncIterable<ChatChunk>` — a uniform streaming
  contract; the unified chat UI knows nothing about provider-specific payload shapes.
- `ProviderCapabilities` describes model list source, context limits, tool/vision support, and
  streaming support, so the UI can adapt per provider instead of hardcoding behaviour.
- Adapters validate every response with Zod. Provider output is untrusted input.
- Errors are normalised to `AppError` with `code: "PROVIDER_ERROR"` and a _safe_ message; provider
  error bodies are logged through the redacting logger, never returned verbatim.
- Provider credentials are decrypted in server-only code immediately before use, are never logged,
  and never travel to the client (not even masked, except a last-four display value that is stored
  separately from the ciphertext).
- Request-scoped timeouts and cancellation (`AbortSignal`) are mandatory; no unbounded retries.

## 6. Error handling and validation conventions

- **Zod at every trust boundary** — request bodies, query parameters, environment variables,
  database rows, and provider payloads are parsed with a schema before use
  (`parseOrThrow`/`safeParse` in `src/lib/validation.ts`).
- **Typed errors** — `AppError` (`src/lib/errors.ts`) carries a stable `ErrorCode` and an HTTP
  status. Its message is safe to show to a user; the optional `cause` is for server logs only.
- **Sanitised boundaries** — `toPublicError()` reduces anything to `{ code, status, message }`.
  Unexpected errors become a generic message plus a log correlation id, so no stack trace, SQL
  fragment, or provider payload is ever rendered.
- **Never fail silently** — expected failures produce an `AppError`; unexpected ones are logged and
  surfaced through an error boundary (client) or a 5xx JSON envelope (planned route handlers).
- **Validation messages never echo rejected values** — schemas in this repository describe the
  expected shape only; a test asserts this property for a secret-looking input.

## 7. Streaming response architecture (planned — Phase 4)

1. The client posts a message to a Route Handler (`src/app/api/chat/route.ts`) or a server action.
2. The handler authenticates the session, validates the request with Zod, checks quota/limits
   (Phase 8), and resolves the conversation with an ownership check.
3. The handler selects the provider adapter, decrypts the user's key server-side, and calls
   `streamChat`.
4. Streamed chunks are forwarded to the browser as a `ReadableStream` (SSE/`text/event-stream`),
   while the handler accumulates usage metadata.
5. On completion the assistant message and usage record are persisted; failures mid-stream are
   recorded as partial or failed runs rather than silently discarded.
6. Client-side streaming state lives in a dedicated hook; UI components stay declarative.

Cancellation must propagate from the browser through the handler to the provider request, and
streaming must continue to work when the deployment runs on multiple instances (stateless
handlers, no in-memory session affinity).

## 8. Secret management principles

- Secrets live only in `.env.local` (development) or the Vercel environment-variable store
  (deployment). Only `.env.example` — with placeholder values and comments — is committed.
- Public configuration uses the `NEXT_PUBLIC_` prefix and is limited to non-sensitive values;
  server configuration is read through `src/lib/env/server.ts`, which imports `server-only`.
- Environment validation reports the offending variable name and never its value.
- The structured logger redacts sensitive keys (keys, tokens, cookies, sessions, credentials,
  prompts, documents) and bounds payload size.
- Provider keys are encrypted at rest (Phase 3) with a server-only key-management secret; the
  plaintext exists only in memory for the duration of a provider call.

## 9. Key decisions and trade-offs

| Decision                                                                               | Why                                                                                               | Trade-off accepted                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Next.js App Router with server components by default                                   | Server-side privileged work, small client bundles, direct Vercel fit                              | Requires discipline about the client/server boundary                                       |
| TypeScript strict **plus** `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` | Catches real defects at compile time in a multi-tenant product                                    | More explicit call sites; occasional spread/cast workarounds for third-party props         |
| Tailwind CSS v4 with CSS-first tokens (no `tailwind.config.js`)                        | One source of truth for design tokens; faster builds                                              | Teams expecting a JS config must read `src/app/globals.css`                                |
| shadcn/ui conventions with Radix primitives vendored into `src/components/ui`          | Accessible primitives with no opaque dependency; components are editable                          | Components are owned and maintained in-repo                                                |
| ESLint pinned to the v9 major                                                          | The React/import/jsx-a11y plugins that `eslint-config-next` depends on declare support up to `^9` | No ESLint 10 features until those plugins widen their peer ranges                          |
| Zod as the single validation library                                                   | One mental model for env, HTTP, and provider data                                                 | No schema-to-OpenAPI generation; acceptable at this scale                                  |
| `server-only` marker for privileged modules                                            | Makes an accidental client import a build error                                                   | Requires a Vitest alias so those modules stay testable                                     |
| next-themes for theming                                                                | No flash of wrong theme; system preference honoured; no server round trip                         | Theme choice is per browser, not per account (a later phase can sync it)                   |
| Non-functional controls are disabled and phase-labelled                                | The interface must never imply an unimplemented capability                                        | The shell deliberately looks "not finished" in places — that is intended                   |
| No `vercel.json`                                                                       | Vercel detects the framework; fewer files to drift                                                | Deployment settings live in the dashboard (documented in the README)                       |
| Vitest with two projects (Node + jsdom)                                                | Fast, hermetic tests with honest environments                                                     | No browser-level end-to-end coverage yet (deferred by design)                              |
| pnpm with an exact lockfile and disabled dependency build scripts                      | Reproducible installs; no unreviewed lifecycle scripts                                            | New dependencies with native build steps require an explicit `onlyBuiltDependencies` entry |

## 10. Extension rules for later phases

1. Extend this architecture; do not rebuild it. New routes go under `src/app`, new cross-cutting
   server logic under `src/lib`, new UI under `src/components`.
2. Every new capability updates the phase table in the README and the roadmap document.
3. Every privileged operation stays server-side and is authorized per request against the
   authenticated user.
4. Every new environment variable is added to the Zod schema, to `.env.example`, and to the
   README table before the feature ships.
5. No feature may present a capability as working before it is implemented and tested; the
   "disabled control + phase label" pattern remains the default for unfinished surfaces.
