-- ═══════════════════════════════════════════════════════════════════════════════
-- Rowan — Phase 2, migration 2 of 3: ownership enforcement and row-level security
--
-- Two independent controls protect user-owned rows:
--
--   1. Application layer — every user-scoped query runs through
--      `withUserContext()` (src/lib/db/query.ts), which filters by the
--      authenticated owner. See src/lib/data/*.
--   2. Database layer — row-level security, defined here. It is the control that
--      still holds when application code forgets a filter.
--
-- How the database control works:
--   * A dedicated, password-less runtime role `rowan_app` owns no objects and has
--     no BYPASSRLS. The application switches into it for the duration of every
--     user-scoped transaction with `SET LOCAL ROLE rowan_app`.
--   * The authenticated user id is passed as the transaction-local setting
--     `app.user_id`, read by `public.current_user_id()`. With no setting, the
--     function returns NULL and every policy comparison is NULL → no rows. That is
--     the fail-closed behaviour: a missing context denies access rather than
--     granting it.
--   * Policies are declared `TO rowan_app` only. Roles that Rowan does not use for
--     data access (for example Supabase's `anon` and `authenticated`, which serve
--     PostgREST) therefore see no rows at all, because no policy applies to them.
--
-- Privileged operations that intentionally span owners (account deletion,
-- maintenance) run as the connection's own role, never as `rowan_app`, and are
-- confined to src/lib/data/users.ts and the migration runner. The integration
-- tests assert that the runtime role is not the table owner and cannot bypass RLS.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────
-- Runtime role
-- ───────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rowan_app') then
    create role rowan_app;
  end if;
end $$;

-- Re-assert the security properties on every run so a manually altered role is
-- corrected rather than trusted.
alter role rowan_app
  with nologin
       nosuperuser
       nocreatedb
       nocreaterole
       nobypassrls;

comment on role rowan_app is
  'Runtime role for Rowan data access. No login, no table ownership, no BYPASSRLS: every query it runs is subject to the policies below.';

-- The role that applies migrations must be able to switch into the runtime role.
-- On Supabase this is `postgres` (the role that also owns the schema), so the
-- grant is to the current role, plus well-known platform roles when present.
grant rowan_app to current_user;

do $$
declare
  platform_role text;
begin
  foreach platform_role in array array['postgres', 'authenticator', 'service_role']
  loop
    if exists (select 1 from pg_roles where rolname = platform_role) then
      execute format('grant rowan_app to %I', platform_role);
    end if;
  end loop;
exception
  when insufficient_privilege then
    raise warning 'could not grant rowan_app to a platform role: %', sqlerrm;
end $$;

grant usage on schema public to rowan_app;

-- ───────────────────────────────────────────────────────────────────────────────
-- Ownership helpers
-- ───────────────────────────────────────────────────────────────────────────────
-- `current_user_id()` never raises: an absent or malformed setting yields NULL, so a
-- misconfigured transaction reads nothing instead of failing open. The UUID shape is
-- checked with a regular expression to avoid a cast error inside a policy evaluation.

create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select case
    when current_setting('app.user_id', true) is null then null
    when current_setting('app.user_id', true) = '' then null
    when current_setting('app.user_id', true)
      ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then current_setting('app.user_id', true)::uuid
    else null
  end;
$$;

comment on function public.current_user_id() is
  'Authenticated owner id for the current transaction, taken from the app.user_id setting. NULL (deny) when absent or malformed.';

create or replace function public.is_authenticated()
returns boolean
language sql
stable
as $$
  select public.current_user_id() is not null;
$$;

comment on function public.is_authenticated() is
  'True when the current transaction carries an authenticated owner id.';

grant execute on function public.current_user_id() to rowan_app;
grant execute on function public.is_authenticated() to rowan_app;

-- ───────────────────────────────────────────────────────────────────────────────
-- Table privileges
-- ───────────────────────────────────────────────────────────────────────────────
-- Least privilege, table by table. Note that privileges alone are not enough: a
-- policy must also allow the row (RLS is checked in addition to GRANT).

grant select, insert, update on public.users to rowan_app;
grant select, insert, update, delete on public.profiles to rowan_app;
grant select, insert, update, delete on public.user_sessions to rowan_app;

-- ───────────────────────────────────────────────────────────────────────────────
-- Row-level security
-- ───────────────────────────────────────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.user_sessions enable row level security;

-- public.users -----------------------------------------------------------------
-- An account row may be read, created, and updated only by that same account.
-- Deletion is intentionally not granted to the runtime role: account deletion is a
-- privileged operation (src/lib/data/users.ts) so that it is always accompanied by
-- provider-side deletion and an audit log entry.

create policy users_select_own on public.users
  for select to rowan_app
  using (id = public.current_user_id());

create policy users_insert_self on public.users
  for insert to rowan_app
  with check (id = public.current_user_id());

create policy users_update_self on public.users
  for update to rowan_app
  using (id = public.current_user_id())
  with check (id = public.current_user_id());

-- public.profiles --------------------------------------------------------------

create policy profiles_select_own on public.profiles
  for select to rowan_app
  using (user_id = public.current_user_id());

create policy profiles_insert_own on public.profiles
  for insert to rowan_app
  with check (user_id = public.current_user_id());

create policy profiles_update_own on public.profiles
  for update to rowan_app
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy profiles_delete_own on public.profiles
  for delete to rowan_app
  using (user_id = public.current_user_id());

-- public.user_sessions ---------------------------------------------------------
-- A user sees and revokes only their own sessions. The revocation update is still
-- subject to `using`/`with check`, so a session row can never be re-assigned to
-- another account.

create policy user_sessions_select_own on public.user_sessions
  for select to rowan_app
  using (user_id = public.current_user_id());

create policy user_sessions_insert_own on public.user_sessions
  for insert to rowan_app
  with check (user_id = public.current_user_id());

create policy user_sessions_update_own on public.user_sessions
  for update to rowan_app
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy user_sessions_delete_own on public.user_sessions
  for delete to rowan_app
  using (user_id = public.current_user_id());

-- ───────────────────────────────────────────────────────────────────────────────
-- Deny the roles Rowan does not use
-- ───────────────────────────────────────────────────────────────────────────────
-- Supabase exposes the `public` schema through PostgREST using the `anon` and
-- `authenticated` roles. Rowan never uses that access path — the server talks to
-- PostgreSQL directly — so table privileges are revoked from those roles when they
-- exist. RLS already returns no rows to them (no policy targets them); this removes
-- the surface entirely.

do $$
declare
  exposed_role text;
begin
  foreach exposed_role in array array['anon', 'authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = exposed_role) then
      execute format('revoke all on public.users, public.profiles, public.user_sessions from %I', exposed_role);
      execute format('revoke all on function public.current_user_id() from %I', exposed_role);
      execute format('revoke all on function public.is_authenticated() from %I', exposed_role);
    end if;
  end loop;
end $$;
