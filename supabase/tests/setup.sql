-- Stub of the Supabase auth environment, for validating the migration locally.
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

-- Simulate the 'authenticated' role used by Supabase (subject to RLS).
drop role if exists app_user;
create role app_user nologin;
grant usage on schema public to app_user;
alter default privileges in schema public grant select, insert, update, delete on tables to app_user;
alter default privileges in schema public grant execute on functions to app_user;
-- Supabase grants authenticated users access to auth.uid()
grant usage on schema auth to app_user;
grant execute on function auth.uid() to app_user;
