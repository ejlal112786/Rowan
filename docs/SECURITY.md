# Rowan — Security Requirements

This document states what each security area requires, what Phase 1 and Phase 2 actually implement,
and what remains outstanding.

> **Rowan is not yet safe for real provider keys.** Phase 2 adds authentication, authorization, and
> a database, but there is still no encrypted key storage, no rate limiting, no audit trail, and no
> hosted environment: authentication has been verified against a local PostgreSQL database and its
> own integration suite, not against a deployed Supabase project. The controls listed as
> _outstanding_ are prerequisites for the phases that add those features. Do not treat the
> existence of a convention in this document as a guarantee that the corresponding control is in
> place.

Legend: **Implemented in Phase 1** · **Implemented in Phase 2** · **Outstanding** (with the phase
that delivers it).

---

## 1. BYOK credentials

| Requirement                                                                                                            | Status                     |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Keys are provided by the user (BYOK); Rowan never ships or shares a global provider key                                | Outstanding (Phase 3)      |
| Keys are encrypted at rest with a server-only key-management secret                                                    | Outstanding (Phase 3)      |
| Decryption happens only in server-only code, immediately before a provider call                                        | Outstanding (Phase 3)      |
| Keys are never stored in client storage, cookies, or the client bundle                                                 | Outstanding (Phase 3)      |
| Keys are never logged; redaction is applied before any log write                                                       | **Implemented in Phase 1** |
| Keys are never returned by an API response (a masked last-four display value is stored separately from the ciphertext) | Outstanding (Phase 3)      |
| Only the owner can read, rotate, or delete a stored key                                                                | Outstanding (Phase 3)      |
| A key is validated against the provider before it is accepted                                                          | Outstanding (Phase 3)      |

Phase 1 contribution: `src/lib/logger.ts` redacts any value whose key looks like a credential
(`apiKey`, `api_key`, `x-api-key`, `authorization`, `token`, `secret`, `cookie`, `session_id`,
`password`, `credential`, …) anywhere in a nested payload, and redacts entire subtrees under
sensitive container keys such as `credentials`. Tests pin this behaviour.

## 2. Authentication and sessions

| Requirement                                                                   | Status                     |
| ----------------------------------------------------------------------------- | -------------------------- |
| Registration, sign-in, sign-out, email verification                           | **Implemented in Phase 2** |
| Password reset and password change                                            | **Implemented in Phase 2** |
| Sessions in httpOnly, `Secure`, `SameSite` cookies — never in `localStorage`  | **Implemented in Phase 2** |
| Session identifiers rotated on privilege change; server-side revocation       | **Implemented in Phase 2** |
| Password handling delegated to the auth provider (no custom password hashing) | **Implemented in Phase 2** |
| Live sessions visible to the user and individually revocable                  | **Implemented in Phase 2** |
| Account deletion removes or anonymises personal data                          | **Implemented in Phase 2** |
| Multi-factor authentication                                                   | Outstanding (Phase 9)      |
| Rate limiting and lockout on authentication endpoints                         | Outstanding (Phase 8)      |
| Session lifetime and idle-timeout policy configured centrally                 | Outstanding (Phase 9)      |

Phase 2 implementation:

- **Provider, not custom cryptography.** Supabase Auth owns passwords and refresh tokens. Rowan
  never sees a password after it has been submitted, never stores one, and implements no hashing,
  salting, or password-comparison logic of its own. Password strength is still enforced before the
  value leaves Rowan (`src/lib/auth/schemas.ts`): minimum length, a maximum the provider accepts, no
  surrounding whitespace, rejection of the account's own email local part, and rejection of
  well-known breached passwords.
- **Cookies only, hardened.** `src/lib/auth/cookie-options.ts` is the single place where cookie
  attributes are decided: `httpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` whenever
  `NODE_ENV === "production"`. `@supabase/ssr` proposes cookie options; this module overrides them,
  so a weaker default from the library (or from a future upgrade) cannot silently weaken the
  policy. No session token is written to `localStorage`, `sessionStorage`, or a URL — a test and a
  lint-level review both hold that line.
- **Server-side revocation on every request.** The provider's session id is recorded in
  `public.user_sessions`; `getCurrentUser()` rejects a session that is missing, revoked, or whose
  refresh token the provider has invalidated, and clears the cookie. Sign-out, "sign out
  everywhere", password change, and account deletion all terminate server-side session state, so a
  stolen cookie stops working before its JWT expires. Failures here are fail-closed: an
  indeterminate answer from the database is treated as signed out.
- **No open redirects.** Every post-authentication destination is validated against known paths by
  `src/lib/auth/redirects.ts`; an untrusted `next` value is discarded rather than sanitised.
- **Identical error messages, identical timing class.** Sign-in, password-reset request, and resend
  handlers answer the same way whether or not the account exists, so they cannot be used to
  enumerate accounts.
- **Account deletion.** Requires the user's own email typed into a confirmation field, revokes every
  session first, deletes the provider account, and removes every owned row through the schema's
  `on delete cascade`. The administrative provider key that makes this possible is read only by the
  deletion path, is never used for reads, and never reaches the browser.

## 3. Authorization and tenant isolation

| Requirement                                                                 | Status                                                                                 |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Every query touching user-owned rows is filtered by the authenticated owner | **Implemented in Phase 2**                                                             |
| Ownership checks occur in the data-access layer, not in UI conditionals     | **Implemented in Phase 2**                                                             |
| Cross-tenant read/write attempts are covered by tests that must fail closed | **Implemented in Phase 2**                                                             |
| Row-level security is enabled where the database supports it                | **Implemented in Phase 2**                                                             |
| Route handlers reject unauthenticated requests before any data access       | **Implemented in Phase 2** for auth and settings routes; extended per route in Phase 4 |
| Every route handler authenticated and rate limited before work begins       | Outstanding (Phases 4–8)                                                               |

Phase 2 implementation:

- **One entry point for user-scoped SQL.** `withUserContext()` (`src/lib/db/query.ts`) opens a
  transaction, switches to the `rowan_app` role with `SET LOCAL`, and sets the owner id
  transaction-locally. Both settings are scoped to the transaction, so they cannot leak to the next
  borrower of a pooled connection. An invalid owner id is refused before any statement is sent.
- **Row-level security as the second control.** Policies scoped `TO rowan_app` compare `user_id`
  against `public.current_user_id()`. With no owner set the comparison is `NULL`, so a query that
  forgot its context returns nothing rather than everything. The runtime role cannot bypass or
  disable this: it is `NOLOGIN`, owns no table, is not granted `BYPASSRLS`, and its grants are the
  minimum the application uses. `public.users` carries no `DELETE` grant at all, so account deletion
  cannot be expressed from a request-scoped transaction even by mistake.
- **Fail closed, not open.** Authorization lookups treat "no row" and "database unreachable" as
  denial. `AppError` with `UNAUTHENTICATED` or `FORBIDDEN` is the only outcome a caller can
  observe.
- **Verified against a real database.** `tests/integration/row-level-security.test.ts` seeds two
  accounts, then attempts cross-tenant reads, inserts, updates, and deletes through the production
  path, and asserts that none of them succeed; it also asserts that a statement running as the
  runtime role _without_ an owner context returns zero rows. Mocked databases prove nothing here,
  so these tests use the real policies.
- **Privileged operations are named.** `withSystemContext()` is the only path that skips the owner
  scope. Phase 2 uses it for identity provisioning repair and account deletion; each call site is
  commented with its justification, and the deletion path is covered by a unit test that asserts the
  exact order of operations.

## 4. Input validation

| Requirement                                                                       | Status                                                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| All external input parsed with Zod before use                                     | **Implemented in Phase 1** (conventions + helpers)                  |
| Validation happens server-side, at the boundary where the value enters the system | **Implemented in Phase 1** (pattern); applied per route in Phase 4+ |
| Validation messages never echo the rejected value                                 | **Implemented in Phase 1** (test-enforced)                          |
| Provider responses and database rows are treated as untrusted                     | Outstanding (Phases 3–4)                                            |
| Uploaded files are type-, size-, and content-checked before processing            | Outstanding (Phase 6)                                               |
| Output rendering escapes user and model content by default                        | Outstanding (Phase 4)                                               |

Phase 1 implements `parseOrThrow`, `safeParse`, and `formatZodIssues`
(`src/lib/validation.ts`) with the conventions above, plus 7 tests covering success, failure,
custom error codes, and non-disclosure of rejected values.

## 5. Provider requests

| Requirement                                                             | Status                                                |
| ----------------------------------------------------------------------- | ----------------------------------------------------- |
| All provider calls execute server-side                                  | Outstanding (Phase 3) — documented as a hard rule now |
| Provider credentials never leave the server                             | Outstanding (Phase 3)                                 |
| Requests are bounded by timeouts and cancellation; no unbounded retries | Outstanding (Phase 3)                                 |
| Provider error bodies are not returned to the client verbatim           | Outstanding (Phase 3)                                 |
| Every provider response is validated before use                         | Outstanding (Phase 3)                                 |
| Usage returned by the provider is recorded for quota enforcement        | Outstanding (Phase 8)                                 |

Phase 1 contribution: the architectural rule is recorded in `docs/ARCHITECTURE.md`; the
`PROVIDER_ERROR` code and the redacting logger exist so the Phase 3 implementation has a defined
shape (`code: "PROVIDER_ERROR"`, generic client message, redacted server log).

## 6. Logging and monitoring

| Requirement                                                                              | Status                                                                                        |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Never log API keys, tokens, cookies, sessions, credentials, or secrets                   | **Implemented in Phase 1**                                                                    |
| Never log prompt text, message arrays, or document contents                              | **Implemented in Phase 1** (API-key and prompt/document keys are redacted by default)         |
| Log payloads are bounded in depth, key count, array length, and string length            | **Implemented in Phase 1**                                                                    |
| Structured (JSON) log lines with a stable level field                                    | **Implemented in Phase 1**                                                                    |
| Errors logged with a correlation id (`digest`) and without stack traces exposed to users | **Implemented in Phase 1** (boundary behaviour); request-id propagation Outstanding (Phase 4) |
| Central log aggregation, alerting, and anomaly detection                                 | Outstanding (Phase 9)                                                                         |
| Audit trail for account, key, and quota events                                           | Outstanding (Phases 2–3)                                                                      |

Phase 1 implements the server-only structured logger (`src/lib/logger.ts`) with an explicit
sensitive-key marker list, subtree redaction, size bounds, level filtering, and 20 tests pinning
the behaviour. It is the only module allowed to write to stdout (`no-console` is disabled for that
file alone).

## 7. Rate limits and abuse prevention

| Requirement                                                       | Status                   |
| ----------------------------------------------------------------- | ------------------------ |
| Per-user and per-IP request limits on auth and provider endpoints | Outstanding (Phase 8)    |
| Token- and cost-based quotas per user and per provider            | Outstanding (Phase 8)    |
| Hard spend ceilings with a "stop, do not overspend" default       | Outstanding (Phase 8)    |
| Protection against prompt-flooding and runaway retry loops        | Outstanding (Phase 8)    |
| Abuse signals monitored and reviewed                              | Outstanding (Phases 8–9) |

Phase 1 contribution: the `RATE_LIMITED` error code (HTTP 429) exists so limit responses have a
stable contract, and the provider-adapter contract in `docs/ARCHITECTURE.md` forbids unbounded
retries.

Phase 2 contribution: the public authentication endpoints (sign-in, sign-up, password-reset
request, resend) are the first surfaces an unauthenticated stranger can reach, and they are
deliberately **not** protected by a limiter yet. They depend on Supabase's own abuse controls
(CAPTCHA is not enabled) and on the provider's email throttling. That is acceptable only because
Rowan is not publicly deployed; enabling CAPTCHA or an edge limiter is a Phase 8 prerequisite, and
the phase plan records it. Rowan must not be exposed to untrusted traffic before Phase 8.

## 8. Deployment secrets

| Requirement                                                                            | Status                                                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `.env`, `.env.*` (except `.env.example`) are git-ignored                               | **Implemented in Phase 1**                                                                  |
| No credential, token, or private key is committed                                      | **Implemented in Phase 1** (verified in the final diff review)                              |
| Private values are never prefixed with `NEXT_PUBLIC_`                                  | **Implemented in Phase 1** (public schema is limited to `NEXT_PUBLIC_APP_URL`)              |
| Public and server configuration are separate modules with a build-time boundary        | **Implemented in Phase 1** (`server-only` marker)                                           |
| Environment validation errors never print values                                       | **Implemented in Phase 1** (test-enforced)                                                  |
| Vercel variables scoped per environment; production secrets restricted to server scope | Documented; applied when the Supabase project is connected (README)                         |
| No secret value is ever included in a log line or an error message                     | **Implemented in Phase 2** (the service-role key and `DATABASE_URL` are read, never echoed) |
| Secret rotation runbook                                                                | Outstanding (Phase 9)                                                                       |

## 9. Baseline application hardening (Phases 1–2)

Implemented now:

- Security headers applied to every route in `next.config.ts`: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying camera,
  microphone, geolocation, and payment. Production builds additionally send
  `X-Frame-Options: DENY`; development builds omit that header because local review tooling embeds
  the dev server in a cross-origin frame. A Content-Security-Policy with `frame-ancestors` replaces
  this arrangement in Phase 9.
- `poweredByHeader: false` (no framework disclosure).
- React strict mode enabled; production builds fail on type errors.
- No `dangerouslySetInnerHTML`, no `eval`, no dynamic code generation anywhere in the codebase.
- No third-party scripts, no analytics, and no external network calls from the application shell.
- Dependency install scripts are not executed by the package manager
  (`pnpm.ignoredBuiltDependencies`); only explicitly approved packages may run lifecycle scripts.
- Lockfile committed; CI installs with `--frozen-lockfile`; Dependabot proposes weekly updates.

Added in Phase 2:

- Row-level security on every user-owned table, with a least-privilege runtime role; the provider's
  `anon` and `authenticated` roles are revoked from those tables where they exist, so Supabase's
  auto-generated data API is not a second, unreviewed path to Rowan's data.
- Session cookies forced to `httpOnly` + `SameSite=Lax` + `Secure` in production at the point where
  they are written.
- Account-enumeration resistance: sign-in, reset, and resend answer identically for unknown
  accounts, and validation messages never echo a submitted value.
- The service-role key is read lazily by the account-deletion path only; it is never logged, never
  included in an error, and never sent to the browser.
- Migration runner verifies checksums, so a modified applied migration is reported as drift rather
  than executed.

Still outstanding at the framework level:

- Content Security Policy (needs a nonce strategy once dynamic content exists) — Phase 4/9.
- Subresource integrity for any future external asset — Phase 9.
- `Strict-Transport-Security` (meaningful only on the production domain) — Phase 10.

## 10. Rules that apply to every later phase

1. Privileged AI-provider requests execute server-side only.
2. Every database query involving user-owned data enforces authorization and ownership; new
   user-owned tables also ship row-level security policies and a cross-tenant test.
3. All client input and all provider responses are untrusted until validated.
4. Never log API keys, authentication tokens, sensitive prompts, or document contents.
5. New environment variables are validated, documented, and scoped as public or server-only before
   the feature that needs them ships.
6. A capability is not described as available until it is implemented, tested, and verified — in
   the UI, the README, and the roadmap.
7. Authentication state is resolved server-side per request from the session cookie; a
   client-supplied identifier is never trusted, and no token is exposed to client JavaScript.
8. A new session-scoped surface must prove two properties in tests: unauthenticated requests are
   refused before data access, and one account can never observe another account's rows.
