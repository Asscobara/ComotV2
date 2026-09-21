-- Stub of the Supabase auth environment, for validating the migration locally.
-- The column set mirrors the parts of real auth.users that our migrations and
-- seed.sql touch, so both can be exercised without running the Auth container.
-- Everything beyond id/email/raw_user_meta_data is defaulted, which keeps the
-- older smoke tests' three-column inserts working unchanged.
create schema auth;
create table auth.users (
  instance_id uuid default '00000000-0000-0000-0000-000000000000',
  id uuid primary key default gen_random_uuid(),
  aud text default 'authenticated',
  role text default 'authenticated',
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id text not null,
  identity_data jsonb not null default '{}'::jsonb,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (provider, provider_id)
);
create function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

-- Simulate the 'authenticated' role used by Supabase (subject to RLS).
-- Roles are cluster-wide, so this is created only when absent rather than
-- dropped and recreated: Postgres refuses to drop a role while objects in any
-- other database still depend on it, which would otherwise break both a second
-- run and any use of two test databases in one cluster. The grants below are
-- per-database and so still apply fresh each time.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end $$;
grant usage on schema public to app_user;
alter default privileges in schema public grant select, insert, update, delete on tables to app_user;
alter default privileges in schema public grant execute on functions to app_user;
-- Supabase grants authenticated users access to auth.uid()
grant usage on schema auth to app_user;
grant execute on function auth.uid() to app_user;
