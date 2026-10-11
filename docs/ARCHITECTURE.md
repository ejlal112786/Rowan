# Rowan — Architecture

This document describes how Rowan is structured, where the server/client boundary sits, how later
phases are expected to extend the foundation, and which trade-offs were accepted in Phase 1.

**Scope note:** Phases 1–2 are implemented. Sections 3 (data) and 4 (authentication) describe
running code: PostgreSQL with committed migrations, row-level security, ownership-scoped access,
and Supabase Auth behind a server-side session interface. Provider adapters (§5) and streaming
(§7) remain design contracts — nothing in this repository calls an AI provider yet, and no hosted
Supabase project has been connected (see the README's Phase 2 verification status).

---

## 1. Application structure

```
src/
  app/                  Routing, layouts, boundaries, and auth route handlers (App Router)
  components/           Reusable UI, shell, auth forms, and settings surfaces
  config/               Static product configuration (no secrets, no I/O)
  lib/
    auth/               Session interface, schemas, redirects, server actions
    data/               Ownership-scoped data access
    db/                 Pool, transactions, migrations, error mapping
  proxy.ts              Request pipeline: session refresh and route protection
supabase/migrations/    Versioned SQL migrations — the schema's source of truth
scripts/db/migrate.ts   Migration CLI
tests/                  Unit, component, and integration tests
docs/                   Architecture, security, roadmap
```

Directory responsibilities:

| Path                  | Responsibility                                              | Rules                                                                                           |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/app`             | Routing, metadata, global styles, error/loading boundaries  | Server components by default; pages stay thin and compose from `components/`                    |
| `src/components`      | Presentation and interaction                                | Only components that need state, effects, or browser APIs are client components                 |
| `src/config`          | Product metadata, navigation, planned provider list         | Static data only — no `process.env`, no network calls, no secrets                               |
| `src/lib`             | Cross-cutting utilities                                     | Pure helpers where possible; privileged modules import `server-only`                            |
| `src/lib/db`          | Connection pool, transaction scoping, migrations            | The only layer that speaks SQL to the pool; user-scoped statements go through `withUserContext` |
| `src/lib/auth`        | Session resolution, auth schemas, redirects, server actions | Server-only; the browser never receives a token                                                 |
| `supabase/migrations` | Schema, policies, and grants                                | Append-only: applied migrations are never edited                                                |
| `tests`               | Unit + component tests                                      | Node environment for logic, jsdom for rendering; no network access                              |

Shared domain types are declared next to the module that owns them (for example `NavItem` in
`src/config/navigation.ts`). A catch-all `src/types/` directory is deliberately avoided until real
cross-cutting types exist, to prevent a folder of unused aliases.

### Route inventory

| Route                | File                                            | Access           | Purpose                                                               |
| -------------------- | ----------------------------------------------- | ---------------- | --------------------------------------------------------------------- |
| `/`                  | `src/app/page.tsx`                              | Public           | Workspace: product framing, inert composer, honest build status       |
| `/conversations`     | `src/app/conversations/page.tsx`                | Public           | Empty state; explains that storage is Phase 4                         |
| `/compare`           | `src/app/compare/page.tsx`                      | Public           | Model Arena overview; no inputs, no results                           |
| `/settings`          | `src/app/settings/page.tsx`                     | Authenticated    | Profile, time zone, bio, read-only account facts                      |
| `/settings/security` | `src/app/settings/security/page.tsx`            | Authenticated    | Password change, live sessions, sign-out everywhere, account deletion |
| `/sign-in`           | `src/app/(auth)/sign-in/page.tsx`               | Signed out       | Email + password sign-in                                              |
| `/sign-up`           | `src/app/(auth)/sign-up/page.tsx`               | Signed out       | Registration                                                          |
| `/forgot-password`   | `src/app/(auth)/forgot-password/page.tsx`       | Signed out       | Requests a recovery email                                             |
| `/reset-password`    | `src/app/(auth)/reset-password/page.tsx`        | Recovery session | Sets a new password after following an emailed link                   |
| `/verify-email`      | `src/app/(auth)/verify-email/page.tsx`          | Public           | Explains the confirmation email and offers a resend                   |
| `/auth/callback`     | `src/app/auth/callback/route.ts`                | Public           | Exchanges a PKCE `code` for a session                                 |
| `/auth/confirm`      | `src/app/auth/confirm/route.ts`                 | Public           | Verifies an emailed `token_hash` (signup, recovery, email change)     |
| `/auth/sign-out`     | `src/app/auth/sign-out/route.ts`                | Public           | Ends the session server-side and clears cookies                       |
| `/auth/error`        | `src/app/auth/error/page.tsx`                   | Public           | Sanitised explanation of a failed auth link                           |
| 404                  | `src/app/not-found.tsx`                         | Public           | Not-found page                                                        |
| errors               | `src/app/error.tsx`, `src/app/global-error.tsx` | Public           | Sanitised error output and recovery                                   |
| loading              | `src/app/loading.tsx`                           | Public           | Route-level loading boundary                                          |

Route protection happens in three places, and none of them is a client-side check:
`src/proxy.ts` (cheap redirects and cookie refresh), the protected layouts and pages
(`requireUser()` before any data access), and the data layer itself, which refuses to run a
user-scoped statement without an authenticated owner.

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

## 3. Data architecture (implemented — Phase 2)

- **Primary database:** PostgreSQL. Supabase is the preferred managed provider, but nothing in the
  data layer is Supabase-specific: the integration suite runs the same code against a plain
  PostgreSQL cluster.
- **Access path:** `src/lib/db/pool.ts` builds the only pool in the application (one per process,
  lazily). No database client is ever imported into a client bundle, and `src/lib/db/query.ts`
  additionally imports `server-only`.
- **Schema source of truth:** `supabase/migrations/*.sql`, applied by `scripts/db/migrate.ts`
  (`pnpm db:migrate`, `pnpm db:status`). Migrations are append-only and checksummed; editing an
  applied migration is reported as drift instead of being silently ignored.
- **Direct SQL over an ORM:** the data layer issues parameterised statements against a
  `Queryable` interface (`src/lib/db/types.ts`). Table shapes are small and the ownership rules
  matter more than object mapping, so an ORM would add indirection without removing the one thing
  that must be explicit.

### Tables

| Table                  | Key                                | Purpose                                                         |
| ---------------------- | ---------------------------------- | --------------------------------------------------------------- |
| `public.users`         | `id uuid` (the provider's user id) | Identity mirror: email, verification timestamp, last seen       |
| `public.profiles`      | `user_id uuid` → `users`           | User-editable profile: display name, time zone, bio             |
| `public.user_sessions` | `session_id text`                  | One row per live session, so sessions can be listed and revoked |

Rules the migrations enforce rather than document:

- `public.users.id` is the provider's user id, never re-generated, and every user-owned table
  carries `user_id uuid not null references public.users(id) on delete cascade`. Deleting an
  account therefore removes everything it owns, with no application code involved.
- A trigger creates the `profiles` row whenever a `users` row appears, so "every account has a
  profile" is an invariant of the database, not a habit of the code.
- Emails are stored lower-cased (constraint-enforced) with a unique index, so identity matching
  cannot fork on casing.
- `updated_at` is maintained by `set_updated_at()` triggers.

### Ownership and row-level security

Two independent controls protect user-owned rows:

1. **Application layer.** Every user-scoped statement runs inside
   `withUserContext(userId, fn)` (`src/lib/db/query.ts`), which opens a transaction and issues
   `SET LOCAL ROLE rowan_app` plus `set_config('app.user_id', $1, true)`. `SET LOCAL` is
   transaction-scoped, so neither the role nor the owner can leak to the next borrower of that
   pooled connection. A missing or malformed owner id is rejected before a statement is sent.
2. **Database layer.** Row-level security is enabled on all three tables, with policies written
   `TO rowan_app` that compare `user_id` to `public.current_user_id()`, which reads the
   transaction-local setting above. If the setting is absent the comparison is `NULL` and the
   statement matches nothing: a forgotten context denies access instead of exposing rows.

`rowan_app` is created by the migration as `NOLOGIN`, without `BYPASSRLS`, and owns nothing. The
runtime role is granted exactly the privileges the application uses; `public.users` deliberately
carries no `DELETE` grant, so account deletion cannot be expressed from a request-scoped
transaction at all. Privileged maintenance (identity provisioning repair, account deletion)
uses `withSystemContext(fn)`, which does not set an owner and is documented, reviewed, and
covered by tests.

Because the policies name only `rowan_app`, the provider's PostgREST roles (`anon`,
`authenticated`) match no policy on these tables — and the migration revokes their privileges
outright when those roles exist. Supabase's auto-generated data API is therefore not a second,
unreviewed door into Rowan's data.

### Configuration

`DATABASE_URL` (server-only) is validated by `src/lib/env/server.ts` and read lazily, so a missing
value fails the operation that needs it rather than the build. Connection pooling, SSL, and
timeouts come from the same validated value; no component of the connection string is logged.

## 4. Authentication and sessions (implemented — Phase 2)

- **Provider:** Supabase Auth, reached only from server code. Rowan stores no password and
  implements no hashing, and the browser never calls Supabase directly.
- **Thin session interface:** `getCurrentUser()` in `src/lib/auth/session.ts` returns a
  `SessionUser` — provider id, email, verification state, and the account summary the UI needs —
  or `null`. Feature code never sees a provider client, so the provider can be replaced without
  touching a page: only `src/lib/auth/server-client.ts` and the session module know it is Supabase.
- **Cookies only:** `@supabase/ssr` writes the session into cookies, and
  `src/lib/auth/cookie-options.ts` forces `httpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in
  production on every value the library tries to write. No token is ever returned to client
  JavaScript, stored in `localStorage`, or embedded in a URL.
- **Server-side revocation:** `public.user_sessions` records the provider's session id at sign-in
  and is checked on every request. A session that is missing, revoked, or whose refresh token has
  been invalidated by the provider is treated as signed out — the check fails closed — and the
  cookie is cleared. Sign-out everywhere and password change revoke the other rows and ask the
  provider to invalidate the corresponding refresh tokens.
- **Route protection:** `src/proxy.ts` refreshes the session and redirects obviously
  unauthenticated requests away from protected paths, but it makes no authorization decision on
  its own. Protected layouts call `requireUser()` before rendering, and the data layer refuses to
  run without an owner. A redirect in a proxy is a convenience; the enforcement is underneath it.
- **Redirects:** every post-authentication destination is validated by
  `src/lib/auth/redirects.ts` — a path is either a known route or rejected — so an emailed link
  cannot be turned into an open redirect.
- **Client components receive identity only:** the shell takes a small `AccountSummary`
  (`displayName`, `email`, `emailVerified`) resolved once in the root layout. No token, no id, and
  no provider object crosses that boundary.

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

| Decision                                                                               | Why                                                                                               | Trade-off accepted                                                                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Next.js App Router with server components by default                                   | Server-side privileged work, small client bundles, direct Vercel fit                              | Requires discipline about the client/server boundary                                                                    |
| TypeScript strict **plus** `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` | Catches real defects at compile time in a multi-tenant product                                    | More explicit call sites; occasional spread/cast workarounds for third-party props                                      |
| Tailwind CSS v4 with CSS-first tokens (no `tailwind.config.js`)                        | One source of truth for design tokens; faster builds                                              | Teams expecting a JS config must read `src/app/globals.css`                                                             |
| shadcn/ui conventions with Radix primitives vendored into `src/components/ui`          | Accessible primitives with no opaque dependency; components are editable                          | Components are owned and maintained in-repo                                                                             |
| ESLint pinned to the v9 major                                                          | The React/import/jsx-a11y plugins that `eslint-config-next` depends on declare support up to `^9` | No ESLint 10 features until those plugins widen their peer ranges                                                       |
| Zod as the single validation library                                                   | One mental model for env, HTTP, and provider data                                                 | No schema-to-OpenAPI generation; acceptable at this scale                                                               |
| `server-only` marker for privileged modules                                            | Makes an accidental client import a build error                                                   | Requires a Vitest alias so those modules stay testable                                                                  |
| next-themes for theming                                                                | No flash of wrong theme; system preference honoured; no server round trip                         | Theme choice is per browser, not per account (a later phase can sync it)                                                |
| Non-functional controls are disabled and phase-labelled                                | The interface must never imply an unimplemented capability                                        | The shell deliberately looks "not finished" in places — that is intended                                                |
| No `vercel.json`                                                                       | Vercel detects the framework; fewer files to drift                                                | Deployment settings live in the dashboard (documented in the README)                                                    |
| Vitest with two projects (Node + jsdom)                                                | Fast, hermetic tests with honest environments                                                     | No browser-level end-to-end coverage yet (deferred by design)                                                           |
| pnpm with an exact lockfile and disabled dependency build scripts                      | Reproducible installs; no unreviewed lifecycle scripts                                            | New dependencies with native build steps require an explicit `onlyBuiltDependencies` entry                              |
| Supabase Auth for identity, direct PostgreSQL for data                                 | No password storage or hashing in Rowan; no second data path to secure                            | Two systems to provision, and a session must be validated against both                                                  |
| Row-level security **in addition to** application-level filtering                      | A forgotten `WHERE` clause fails closed instead of leaking another account's rows                 | Every future table needs policies, grants, and an integration test; `SET LOCAL ROLE` costs a round trip per transaction |
| Session ids tracked in `public.user_sessions` and checked on every request             | Users can see and revoke individual sessions; revocation works even before the JWT expires        | One extra query per authenticated request, and a row per session to expire                                              |
| Provider-neutral identity key (`uuid`) rather than an email-keyed account              | Email changes do not re-key user data; the provider id is the only identity that matters          | Emails are attributes to keep in sync rather than the primary key                                                       |
| Plain SQL migrations with a checksummed runner instead of a migration framework        | Reviewable diffs, no framework lock-in, drift detection for free                                  | No down-migrations; rollbacks are forward fixes, as in most production systems                                          |

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
6. Every new user-owned table ships with: a `user_id uuid not null references public.users(id)
on delete cascade` column, row-level security enabled, policies scoped `TO rowan_app`, the
   minimum grants the application needs, and an integration test proving that a second tenant
   cannot read or mutate its rows.
7. User-scoped statements go through `withUserContext`; `withSystemContext` is reserved for
   operations that legitimately span accounts and must be justified in review.
8. Applied migrations are append-only. A schema change is a new file, never an edit; the runner
   reports a checksum mismatch as drift and refuses to proceed silently.
