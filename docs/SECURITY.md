# Rowan — Security Requirements

This document states what each security area requires, what Phase 1 actually implements, and what
remains outstanding.

> **Rowan is not yet safe for real provider keys or real user data.** Phase 1 contains no
> authentication, no authorization, no database, no encrypted key storage, no rate limiting, and no
> audit trail. The controls listed below as _outstanding_ are prerequisites for the phases that add
> those features. Do not treat the existence of a convention in this document as a guarantee that
> the corresponding control is in place.

Legend: **Implemented in Phase 1** · **Outstanding** (with the phase that delivers it).

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

| Requirement                                                                   | Status                |
| ----------------------------------------------------------------------------- | --------------------- |
| Registration, sign-in, sign-out, email verification                           | Outstanding (Phase 2) |
| Sessions in httpOnly, `Secure`, `SameSite` cookies — never in `localStorage`  | Outstanding (Phase 2) |
| Session identifiers rotated on privilege change; server-side revocation       | Outstanding (Phase 2) |
| Password handling delegated to the auth provider (no custom password hashing) | Outstanding (Phase 2) |
| Live sessions visible to the user and individually revocable                  | Outstanding (Phase 2) |
| Account deletion removes or anonymises personal data                          | Outstanding (Phase 2) |

Phase 1 contribution: none functionally. The UI states plainly that no account exists, and the
account area is prepared visually without impersonating an authenticated user.

## 3. Authorization and tenant isolation

| Requirement                                                                 | Status                |
| --------------------------------------------------------------------------- | --------------------- |
| Every query touching user-owned rows is filtered by the authenticated owner | Outstanding (Phase 2) |
| Ownership checks occur in the data-access layer, not in UI conditionals     | Outstanding (Phase 2) |
| Cross-tenant read/write attempts are covered by tests that must fail closed | Outstanding (Phase 2) |
| Route handlers reject unauthenticated requests before any data access       | Outstanding (Phase 4) |
| Row-level security is enabled where the database supports it                | Outstanding (Phase 2) |

Phase 1 contribution: the rule is documented here and in `docs/ARCHITECTURE.md`, and the
`FORBIDDEN` / `NOT_FOUND` error codes exist so authorization failures have a stable shape. No data
path exists yet to enforce it against.

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
retries. No limiter runs yet, and Rowan must not be exposed to untrusted traffic before Phase 8.

## 8. Deployment secrets

| Requirement                                                                            | Status                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `.env`, `.env.*` (except `.env.example`) are git-ignored                               | **Implemented in Phase 1**                                                     |
| No credential, token, or private key is committed                                      | **Implemented in Phase 1** (verified in the final diff review)                 |
| Private values are never prefixed with `NEXT_PUBLIC_`                                  | **Implemented in Phase 1** (public schema is limited to `NEXT_PUBLIC_APP_URL`) |
| Public and server configuration are separate modules with a build-time boundary        | **Implemented in Phase 1** (`server-only` marker)                              |
| Environment validation errors never print values                                       | **Implemented in Phase 1** (test-enforced)                                     |
| Vercel variables scoped per environment; production secrets restricted to server scope | Documented; to be applied when the first secret exists (Phase 2)               |
| Secret rotation runbook                                                                | Outstanding (Phase 9)                                                          |

## 9. Baseline application hardening (Phase 1)

Implemented now:

- Security headers applied to every route in `next.config.ts`: `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` denying camera, microphone, geolocation, and payment.
- `poweredByHeader: false` (no framework disclosure).
- React strict mode enabled; production builds fail on type errors.
- No `dangerouslySetInnerHTML`, no `eval`, no dynamic code generation anywhere in the codebase.
- No third-party scripts, no analytics, and no external network calls from the application shell.
- Dependency install scripts are not executed by the package manager
  (`pnpm.ignoredBuiltDependencies`); only explicitly approved packages may run lifecycle scripts.
- Lockfile committed; CI installs with `--frozen-lockfile`; Dependabot proposes weekly updates.

Still outstanding at the framework level:

- Content Security Policy (needs a nonce strategy once dynamic content exists) — Phase 4/9.
- Subresource integrity for any future external asset — Phase 9.
- `Strict-Transport-Security` (meaningful only on the production domain) — Phase 10.

## 10. Rules that apply to every later phase

1. Privileged AI-provider requests execute server-side only.
2. Every database query involving user-owned data enforces authorization and ownership.
3. All client input and all provider responses are untrusted until validated.
4. Never log API keys, authentication tokens, sensitive prompts, or document contents.
5. New environment variables are validated, documented, and scoped as public or server-only before
   the feature that needs them ships.
6. A capability is not described as available until it is implemented, tested, and verified — in
   the UI, the README, and the roadmap.
