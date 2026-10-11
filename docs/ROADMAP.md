# Rowan — Ten-Phase Implementation Roadmap

Rowan is delivered in ten strictly sequenced phases. Each phase ends in a working, verified state;
later phases extend the architecture established in Phase 1 rather than rebuilding it.

**Global rules for every phase**

1. Implement real behaviour — never a simulated provider response, a fake signed-in user, or
   placeholder persistence.
2. Anything not yet working is either absent or visibly marked as unavailable, with the phase that
   delivers it.
3. Every phase ships with formatting, linting, type checking, tests, and a production build passing
   in CI, plus updated documentation.
4. Privileged work stays server-side; authorization is enforced per request; input and provider
   output are validated.
5. No secret is committed, logged, or exposed to the browser.

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

---

## Phase 1 — Architecture and production foundation ✅

**Objective:** Establish a stable, secure-by-design foundation that later phases extend without
architectural rewrites.

**Dependencies:** None (greenfield repository).

**Deliverables**

- Next.js 16 App Router application with React 19, Tailwind CSS v4, and TypeScript strict mode.
- Rowan application shell: branded, responsive sidebar and navigation, first-use workspace, inert
  composer placeholder, planned-feature notices, account area prepared for authentication.
- Light/dark/system theming and an accessibility baseline (skip link, landmarks, visible focus,
  labelled controls, no state-sync effects).
- Typed, Zod-validated environment modules split into public and `server-only` boundaries
  (`src/lib/env/public.ts`, `src/lib/env/server.ts`).
- Error conventions (`AppError`, `toPublicError`) and validation helpers (`parseOrThrow`,
  `safeParse`), plus a redacting server-only structured logger.
- Quality gates: ESLint 9 flat config, Prettier 3, `tsc --noEmit`, Vitest (Node + jsdom projects),
  production build, and a GitHub Actions workflow that needs no secrets.
- Documentation: README, architecture, security, roadmap, environment example, contribution-facing
  configuration.

**Acceptance criteria**

- [x] Repository inspected; existing work preserved (only the original `README.md` existed).
- [x] App Router application configured; `pnpm build` succeeds.
- [x] TypeScript strict mode enabled (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- [x] Application shell renders; `/`, `/conversations`, `/compare`, `/settings` return 200 and 404
      handling works.
- [x] Responsive layout and accessible baseline verified (skip link, landmarks, `aria-current`,
      disabled controls labelled).
- [x] No fabricated AI, authentication, or persistence claims anywhere in the UI.
- [x] Environment configuration documented; secrets excluded; `.env.example` contains only
      variables the application actually reads.
- [x] Formatting, linting, type checking, tests, and build commands available and passing.
- [x] 74 meaningful tests pass; no assertion-free tests.
- [x] CI workflow configured and documented.
- [x] README, architecture, security, and roadmap documents match the implementation.
- [x] Vercel prerequisites documented.
- [x] Diff reviewed for accidental secrets and unrelated changes.

**Known constraints carried forward:** no Vercel deployment has been executed from this repository;
the environment provides no Vercel credentials. Phase 10 covers deployment verification.

---

## Phase 2 — Database, authentication, and user accounts

**Objective:** Introduce PostgreSQL persistence and real multi-user authentication, and enforce
ownership on every data path.

**Dependencies:** Phase 1 (foundation, environment conventions, error handling).

**Deliverables**

- PostgreSQL provisioned (Supabase preferred) with a committed, versioned migration set.
- Core schema: users, profiles, sessions/refresh state, and the ownership columns every later table
  depends on.
- Supabase Auth integration behind a thin server-side session interface (`getCurrentUser()`).
- Registration, sign-in, sign-out, email verification, password reset, and account deletion.
- Route protection in server components/handlers; unauthenticated users never reach protected data.
- Data-access layer where every user-owned query filters by the authenticated owner.
- Server env variables for database and auth added to the Zod schema, `.env.example`, and README.
- Account settings surface replacing the phase-labelled placeholders.
- Tests: session helpers, ownership enforcement (including cross-tenant attempts), migration
  application, and auth-flow integration tests against an ephemeral database.

**Acceptance criteria**

- Two users cannot read or mutate each other's rows, proven by tests that must fail closed.
- Sessions live only in httpOnly cookies; no token in `localStorage`.
- Sign-out and account deletion revoke server-side session state.
- `pnpm verify` passes with the new tests; migrations apply cleanly from an empty database.
- README and `docs/ARCHITECTURE.md` updated; the shell no longer says "no accounts".

---

## Phase 3 — Secure API-key management and AI-provider integrations

**Objective:** Let users bring their own provider keys and give Rowan one internal interface for all
providers.

**Dependencies:** Phase 2 (accounts, ownership, persistence, encryption secret handling).

**Deliverables**

- `provider_credentials` table with envelope/application-level encryption; plaintext exists only in
  memory during a provider call.
- Provider adapter interface (`streamChat`, `listModels`, `ProviderCapabilities`) plus adapters for
  OpenRouter, Google Gemini, DeepSeek, and Mistral.
- Key validation on save; key rotation and deletion by the owner only.
- Server-only route handlers/actions for key operations, all Zod-validated and ownership-checked.
- Redaction verified end-to-end: no key material in logs, error payloads, or client bundles.
- Settings surface for provider connections replacing the Phase 3 placeholders.
- Tests: adapter contract conformance with mocked HTTP transport, key lifecycle, encryption
  round-trip, and negative cases (invalid key, provider error, ownership violation).

**Acceptance criteria**

- A user can add a valid key, see it validated, rotate it, and delete it.
- No test or log artifact contains key material.
- Provider adapters normalise responses and errors; nothing provider-specific leaks into the UI.
- Model catalogue per provider is retrievable server-side.

---

## Phase 4 — Unified chat, streaming, and persistent conversations

**Objective:** Deliver the core product: conversations with streamed responses and durable history.

**Dependencies:** Phase 3 (adapters, credentials) and Phase 2 (ownership, persistence).

**Deliverables**

- Conversation and message schema with ownership columns and cascade rules.
- A streaming Route Handler (SSE) that authenticates, validates, checks limits, resolves ownership,
  streams provider output, and persists the exchange.
- Client streaming hook plus chat UI: message list, streaming states, retry, stop/cancel,
  failure recovery, and accessible live regions.
- Conversation creation from the first message; the New chat action becomes real.
- Output rendering escapes model content; no `dangerouslySetInnerHTML`.
- Tests: handler authentication/ownership rejection, streaming assembly, cancellation propagation,
  persistence of success and partial failure, and UI states.

**Acceptance criteria**

- A signed-in user can hold a streaming conversation with a connected provider and reload it later.
- Cancellation stops upstream generation; no orphaned or duplicated messages.
- Anonymous or cross-tenant requests are rejected before any provider call.
- The interface no longer contains a disabled composer.

---

## Phase 5 — Model selection, provider capabilities, and Model Arena

**Objective:** Let users choose models deliberately and compare providers side by side.

**Dependencies:** Phase 4 (chat, streaming, persistence).

**Deliverables**

- Model catalogue service (cached per provider) with capability metadata: context window, streaming,
  tools, vision, pricing inputs.
- Model selection in the composer and per conversation, with capability-aware UI.
- Model Arena: one prompt to N models, concurrent streaming, side-by-side comparison, latency and
  token/cost metadata, and promotion of a chosen result into a conversation.
- Tests: catalogue caching and failure modes, capability gating, concurrent streaming, and partial
  failure handling in a comparison run.

**Acceptance criteria**

- Users can compare at least two providers in one run and keep the better answer.
- Arena runs respect provider capability differences and surface per-provider failures without
  breaking the other results.
- Cost/latency figures shown to users come from recorded provider usage, not estimates from nowhere.

---

## Phase 6 — Attachments, document understanding, and tools

**Objective:** Support files and tool use inside conversations.

**Dependencies:** Phases 4–5 (chat, streaming, provider capabilities).

**Deliverables**

- Upload pipeline: type/size validation, content sniffing, virus/abuse checks, object storage with
  authenticated short-lived URLs, ownership-bound attachment records.
- Extraction and chunking for supported document types; retrieval into the provider request within
  context limits.
- Attachment UI: drag and drop, progress, removal, per-conversation attachment list.
- Provider tool/function-call plumbing where the provider supports it, with strict input schemas.
- Tests: upload validation and rejection matrix, ownership checks on attachment access, extraction
  correctness, and context-budget enforcement.

**Acceptance criteria**

- A user can attach a supported document and ask questions about it; oversized or unsupported input
  is rejected with a clear message.
- Attachments are reachable only by their owner; no public object URLs.

---

## Phase 7 — User settings, prompt library, search, and workspace management

**Objective:** Make Rowan configurable and organised for daily use.

**Dependencies:** Phases 2–6.

**Deliverables**

- Profile and preferences (default provider/model, response preferences, theme sync, data export).
- Assistant instructions: system-level instructions per user and per conversation.
- Reusable prompt library: create, edit, tag, insert into conversations, share-safely nowhere
  (single-tenant by design).
- Conversation management: rename, archive, delete, folders/tags where useful.
- Full-text search across conversations with ownership-scoped indexes and pagination.
- Tests: preference persistence, instruction precedence, library CRUD, and search isolation between
  users.

**Acceptance criteria**

- Users can find an old conversation by content and reuse prompts without copy-paste.
- Search never returns another user's content, including under tricky query shapes.
- Every settings surface described in Phase 1 becomes functional and documented.

---

## Phase 8 — Usage tracking, quotas, cost controls, and abuse prevention

**Objective:** Make provider spend visible, bounded, and enforceable.

**Dependencies:** Phases 3–7 (provider usage data, conversations, accounts).

**Deliverables**

- `usage_records` capturing provider, model, prompt/completion tokens, latency, and derived cost per
  request, per user, per conversation.
- Cost estimation from a maintained price table with an explicit "unknown price" state.
- Quotas and budgets: per-user and per-provider limits, spend ceilings with a stop-by-default
  policy, and warnings before a limit is hit.
- Rate limiting for auth, chat, upload, and key-management endpoints (per user and per IP).
- Usage dashboard: current period, per-provider breakdown, remaining budget.
- Abuse mitigation: retry-loop detection, anomalous traffic alerts, and a documented review path.
- Tests: limit enforcement at the boundary, cost computation, rejection paths (429), and dashboard
  aggregation.

**Acceptance criteria**

- A user cannot exceed a configured budget; enforcement happens server-side before provider calls.
- Usage and cost figures reconcile with provider-reported token counts.
- Rate limits are applied and observable; failures return the documented `RATE_LIMITED` shape.

---

## Phase 9 — Security hardening, comprehensive testing, and observability

**Objective:** Prove the security posture and make production behaviour observable.

**Dependencies:** Phases 1–8 (all features present).

**Deliverables**

- Full security review against `docs/SECURITY.md`: every "Outstanding" item either implemented or
  reduced to a documented, accepted risk.
- Content Security Policy with nonces; Strict-Transport-Security on the production domain;
  dependency and secret scanning in CI.
- End-to-end test suite (browser-based) covering sign-up, key setup, chat, comparison, attachments,
  search, and quota limits, run in CI with documented browser installation.
- Accessibility audit (automated plus manual keyboard/screen-reader pass) with fixes.
- Observability: request ids, structured error reporting, aggregated logs, uptime and error-rate
  alerting, and an incident/runbook doc.
- Load and failure testing of streaming paths and provider timeouts.
- Backup/restore and disaster-recovery rehearsal for the database.

**Acceptance criteria**

- Security checklist complete with no unaddressed high-severity finding.
- End-to-end suite passes in CI on pull requests.
- Alerts fire on a deliberately injected failure in a staging environment.
- Restoration from backup is demonstrated within the documented recovery objective.

---

## Phase 10 — Vercel production deployment, configuration verification, and launch readiness

**Objective:** Ship Rowan to production, verified end to end.

**Dependencies:** Phases 1–9.

**Deliverables**

- Vercel project wired to the GitHub repository: production branch, preview deployments per pull
  request, build settings and caching confirmed.
- Environment variables configured per environment (Production/Preview/Development), all server
  scopes correct, no secret exposed to the browser.
- Database migrations applied to production with a reviewed, reversible process; connection limits
  and pooling tuned for serverless.
- Post-deploy verification checklist executed against the real deployment: sign-up, key
  configuration, streaming chat, comparison, attachments, search, quotas, error boundaries,
  headers, and observability hooks.
- Rollback procedure and on-call/ownership notes.
- Final documentation pass: README status, roadmap closure, operational runbook, and a
  launch-readiness report with measured evidence.

**Acceptance criteria**

- Production deployment verified end to end with recorded evidence; no step is claimed without
  execution.
- A rollback has been rehearsed and documented.
- Monitoring confirms healthy error and latency baselines after launch.
- Documentation matches the deployed system exactly.

---

## Extension rules

- Later phases extend the structure in `docs/ARCHITECTURE.md`; they do not rewrite it.
- Each phase updates this document's status column, the README capability table, and any affected
  security rows.
- Phase boundaries are not permission to ship half-working features: a capability is either
  functional and verified, or visibly marked as unavailable with its delivery phase.
