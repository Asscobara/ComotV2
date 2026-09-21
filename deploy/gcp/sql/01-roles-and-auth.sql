-- Environment glue for running ComOt's schema on Cloud SQL instead of Supabase.
--
-- Deliberately NOT a migration. supabase/migrations/ is portable as it stands:
-- its only platform dependencies are auth.uid(), auth.users, and two blocks that
-- already guard themselves with `if exists`. What Supabase provides for free —
-- the auth schema's helper functions and the anon/authenticated roles — has to be
-- created explicitly here. Keeping it separate means the migrations stay testable
-- against the stub in supabase/tests/setup.sql, which defines auth.uid()
-- differently so tests can impersonate users without minting JWTs.
--
-- Run order: this file, then GoTrue (which creates and owns auth.users), then the
-- migrations, then 02-grants.sql.

-- ============================================================
-- Roles PostgREST switches into, named after the JWT `role` claim
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  -- The role PostgREST itself logs in as; it only ever switches to the two above.
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login;
  end if;
end $$;

grant anon, authenticated to authenticator;

-- GoTrue needs its own owner for the auth schema it manages.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin noinherit login createrole;
  end if;
end $$;

create schema if not exists auth authorization supabase_auth_admin;

-- ============================================================
-- auth.uid() / auth.role()
--
-- The 56 call sites across the RLS policies and RPCs depend only on this
-- signature, which is why the policies need no changes at all. PostgREST sets
-- request.jwt.claims per request from the verified token; the singular
-- request.jwt.claim.* form is read first because older PostgREST versions set
-- that instead.
-- ============================================================

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    current_setting('request.jwt.claim.role', true),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )
$$;

create or replace function auth.email() returns text
language sql stable as $$
  select coalesce(
    current_setting('request.jwt.claim.email', true),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'
  )
$$;

comment on function auth.uid() is
  'Current user id from the verified JWT. Backs every RLS policy in this database.';
