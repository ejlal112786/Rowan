-- ═══════════════════════════════════════════════════════════════════════════════
-- Rowan — Phase 2, migration 1 of 3: identity schema
--
-- Creates the tables that own user identity:
--   public.users         mirror of the auth provider's user record (one row per account)
--   public.profiles      1:1 user-editable profile
--   public.user_sessions one row per authenticated session, revocable server-side
--
-- Conventions established here and reused by every later phase:
--   * Identity keys are `uuid` and never re-generated.
--   * Every user-owned table carries `user_id uuid not null references public.users(id)
--     on delete cascade`, so deleting an account removes every row it owns.
--   * `created_at` / `updated_at` are `timestamptz not null default now()`; `updated_at`
--     is maintained by the shared `public.set_updated_at()` trigger.
--   * Table and column comments are the schema documentation: they show up in
--     `\d+` and in the Supabase dashboard.
--
-- This migration is deliberately provider-neutral: it applies to any PostgreSQL 13+
-- database with no extensions and no reference to the `auth` schema. The Supabase
-- integration (foreign key to `auth.users`, provisioning triggers) is added,
-- guarded, by migration 3.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────
-- Shared trigger helper
-- ───────────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Maintains updated_at on every UPDATE. Attached to each mutable table in Rowan.';

-- ───────────────────────────────────────────────────────────────────────────────
-- public.users — identity mirror
-- ───────────────────────────────────────────────────────────────────────────────
-- The auth provider (Supabase Auth) remains the source of truth for credentials and
-- sessions. Rowan keeps a mirror row per account so that:
--   * application data can reference the account with a real foreign key,
--   * ownership can be enforced by the database (see migration 2),
--   * the account row survives independently of provider-specific tables.
-- The row is created either by the provider trigger (migration 3, hosted Supabase) or
-- by the server-side provisioning path (`ensureIdentity`), whichever runs first.

create table public.users (
  id uuid primary key,
  email text not null,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  constraint users_email_lowercase check (email = lower(email)),
  constraint users_email_length check (char_length(email) between 3 and 254),
  constraint users_email_has_at check (position('@' in email) > 1)
);

comment on table public.users is
  'One row per Rowan account. Mirrors the auth provider user; credentials are never stored here.';
comment on column public.users.id is
  'Account identifier. Equal to the auth provider user id, so ownership checks compare one value.';
comment on column public.users.email is
  'Lower-cased email address. Display and delivery use the auth provider value; this copy supports ownership and audit queries.';
comment on column public.users.email_verified_at is
  'When the address was verified by the provider. Null means unverified; unverified accounts are restricted by application policy.';
comment on column public.users.last_seen_at is
  'Last authenticated request observed by the application. Updated at most once per session touch interval.';

create unique index users_email_key on public.users (email);

create trigger users_set_updated_at
  before update on public.users
  for each row
  execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────────
-- public.profiles — user-editable profile
-- ───────────────────────────────────────────────────────────────────────────────
-- Kept separate from `users` so that account/security columns and user-editable
-- content have different write paths: the provisioning path never overwrites a
-- display name, and a profile update can never touch verification state.

create table public.profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  display_name text,
  timezone text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 80
  ),
  constraint profiles_timezone_length check (
    timezone is null or char_length(timezone) between 1 and 64
  ),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 500)
);

comment on table public.profiles is
  'User-editable profile content (1:1 with public.users). No secrets, credentials, or usage data.';
comment on column public.profiles.display_name is
  'Optional display name. Falls back to the local part of the email address in the interface.';
comment on column public.profiles.timezone is
  'Optional IANA time zone name, used by later phases for date formatting.';
comment on column public.profiles.bio is
  'Optional free-text description, at most 500 characters.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Every account has exactly one profile row. Creating it in the database (rather than
-- in application code) means no code path can produce an account without a profile.
create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.create_profile_for_user() is
  'Creates the 1:1 profile row when an account row is inserted.';

create trigger users_create_profile
  after insert on public.users
  for each row
  execute function public.create_profile_for_user();

-- ───────────────────────────────────────────────────────────────────────────────
-- public.user_sessions — server-side revocation state
-- ───────────────────────────────────────────────────────────────────────────────
-- The auth provider owns refresh-token storage and rotation. It cannot, however,
-- answer "has this specific session been signed out?" from Rowan's side. This table
-- records the sessions Rowan has seen and lets a user revoke one or all of them
-- immediately, without waiting for the provider token to expire.
--
-- `session_id` is the provider session identifier carried in the access token. It is
-- treated as an opaque string; Rowan never stores a token, only this identifier.

create table public.user_sessions (
  session_id text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  user_agent text,
  constraint user_sessions_session_id_length check (char_length(session_id) between 8 and 128),
  constraint user_sessions_revoked_reason_length check (
    revoked_reason is null or char_length(revoked_reason) <= 64
  ),
  constraint user_sessions_user_agent_length check (
    user_agent is null or char_length(user_agent) <= 300
  )
);

comment on table public.user_sessions is
  'Sessions known to Rowan, with server-side revocation state. No tokens are stored — only the opaque provider session id.';
comment on column public.user_sessions.session_id is
  'Opaque provider session identifier taken from the verified access-token claims.';
comment on column public.user_sessions.revoked_at is
  'When the session was revoked. A set value means the session is refused even if the provider token is still valid.';
comment on column public.user_sessions.last_seen_at is
  'Last request observed for this session. Updated at most once per touch interval.';

create index user_sessions_user_id_idx on public.user_sessions (user_id);
create index user_sessions_active_idx
  on public.user_sessions (user_id)
  where revoked_at is null;

-- Revoking a session is terminal: a revoked timestamp is never cleared, so an
-- administrative mistake cannot silently resurrect access.
create or replace function public.enforce_session_revocation_is_terminal()
returns trigger
language plpgsql
as $$
begin
  if old.revoked_at is not null and new.revoked_at is null then
    raise exception 'a revoked session cannot be un-revoked'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.enforce_session_revocation_is_terminal() is
  'Rejects attempts to clear revoked_at on public.user_sessions.';

create trigger user_sessions_revocation_is_terminal
  before update on public.user_sessions
  for each row
  execute function public.enforce_session_revocation_is_terminal();
