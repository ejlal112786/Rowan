-- ═══════════════════════════════════════════════════════════════════════════════
-- Rowan — Phase 2, migration 3 of 3: Supabase Auth integration
--
-- Supabase Auth owns credentials and sessions. This migration links Rowan's schema
-- to it so the database keeps both sides consistent without application code having
-- to be trusted to do so:
--
--   * `public.users.id` references `auth.users(id)` with ON DELETE CASCADE, so
--     deleting the provider user removes every row the account owns (profile,
--     sessions) in one transaction.
--   * An INSERT trigger provisions the Rowan account row for a new provider user.
--   * An UPDATE trigger keeps the mirrored email and verification timestamp current.
--
-- Everything here is guarded on the presence of the `auth` schema. On a plain
-- PostgreSQL database (local development, integration tests) the migration is a
-- documented no-op, and account provisioning happens through the application path
-- instead (`ensureIdentity` in src/lib/data/users.ts) — the only difference is which
-- component notices a new account first.
--
-- Guarded statements raise a WARNING rather than failing the migration when a
-- managed platform withholds the privilege to modify `auth.users` (trigger creation
-- requires ownership of that table): the application path still provisions accounts,
-- so a deployment must not be blocked by a missing optimisation.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    raise notice 'auth.users not present — skipping Supabase integration (provider-neutral schema in use)';
    return;
  end if;

  -- ── Referential integrity: provider user ⟶ Rowan account ──────────────────────
  if not exists (select 1 from pg_constraint where conname = 'users_id_auth_fkey') then
    begin
      alter table public.users
        add constraint users_id_auth_fkey
        foreign key (id) references auth.users (id)
        on delete cascade;

      raise notice 'linked public.users.id to auth.users.id with ON DELETE CASCADE';
    exception
      when others then
        raise warning 'could not link public.users to auth.users (%): %', sqlstate, sqlerrm;
    end;
  end if;
end $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- Provisioning and synchronisation triggers
-- ───────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER with an empty search_path: the trigger fires as the provider's
-- internal role, which has no privileges on the public schema. The function is
-- narrowly scoped (one row, two tables) and fully schema-qualified.

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    return;
  end if;

  create or replace function public.handle_auth_user_created()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $function$
  begin
    insert into public.users (id, email, email_verified_at)
    values (
      new.id,
      lower(new.email),
      new.email_confirmed_at
    )
    on conflict (id) do update
      set email = excluded.email,
          email_verified_at = coalesce(public.users.email_verified_at, excluded.email_verified_at);

    return new;
  end;
  $function$;

  comment on function public.handle_auth_user_created() is
    'Provisions the Rowan account row (and, by trigger, its profile) for a new auth provider user.';

  create or replace function public.handle_auth_user_updated()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $function$
  begin
    if new.email is distinct from old.email
       or new.email_confirmed_at is distinct from old.email_confirmed_at then
      update public.users
        set email = lower(new.email),
            email_verified_at = new.email_confirmed_at
        where id = new.id;
    end if;

    return new;
  end;
  $function$;

  comment on function public.handle_auth_user_updated() is
    'Keeps the Rowan account mirror current when the provider changes an email address or verification state.';

  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row
      execute function public.handle_auth_user_created();

    raise notice 'installed provisioning trigger on auth.users';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_updated') then
    create trigger on_auth_user_updated
      after update on auth.users
      for each row
      execute function public.handle_auth_user_updated();

    raise notice 'installed synchronisation trigger on auth.users';
  end if;
exception
  when insufficient_privilege then
    raise warning 'could not manage triggers on auth.users (%): % — account provisioning falls back to the application path', sqlstate, sqlerrm;
  when others then
    raise warning 'Supabase integration step skipped (%): %', sqlstate, sqlerrm;
end $$;
