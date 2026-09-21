-- Post-deployment verification. Run against Cloud SQL after the migrations and
-- grants, before pointing the app at it.
--
-- The dangerous failure mode of this migration is not "nothing works" — that is
-- obvious immediately. It is a table reachable through PostgREST with its RLS
-- policies missing, which looks fine to a signed-in user and exposes every
-- building's data to every other. These assertions exist to catch exactly that.
\set ON_ERROR_STOP on

do $$
declare
  v_missing text;
begin
  -- Every table must have RLS enabled, or PostgREST serves it unfiltered.
  select string_agg(c.relname, ', ') into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  assert v_missing is null, 'RLS disabled on: ' || coalesce(v_missing, '');

  -- And at least one policy, since RLS with no policies denies everything and
  -- would look like a broken app rather than a security hole.
  select string_agg(c.relname, ', ') into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname);
  assert v_missing is null, 'no policies on: ' || coalesce(v_missing, '');
end $$;

do $$ begin
  assert (select count(*) from pg_tables where schemaname = 'public') = 20,
    'expected 20 tables, found ' || (select count(*) from pg_tables where schemaname = 'public');
  assert (select count(*) from pg_policies where schemaname = 'public') = 46,
    'expected 46 policies, found ' || (select count(*) from pg_policies where schemaname = 'public');
  assert (select count(distinct t.typname) from pg_type t join pg_enum e on e.enumtypid = t.oid
          where t.typnamespace = 'public'::regnamespace) = 8, 'expected 8 enum types';
end $$;

-- auth.uid() has to resolve from a JWT claim here, not from the test GUC.
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}', true);
  assert auth.uid() = '00000000-0000-0000-0000-0000000000aa',
    'auth.uid() does not read the JWT claim';
  assert auth.role() = 'authenticated', 'auth.role() does not read the JWT claim';
  perform set_config('request.jwt.claims', '', true);
  assert auth.uid() is null, 'auth.uid() must be null without a token';
end $$;

-- GoTrue owns auth.users; the signup trigger depends on it existing.
do $$ begin
  assert exists (select 1 from pg_tables where schemaname = 'auth' and tablename = 'users'),
    'auth.users is missing — has GoTrue run its migrations yet?';
  assert exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users'
      and t.tgname = 'on_auth_user_created' and not t.tgisinternal
  ), 'the profile-creating trigger on auth.users is missing';
end $$;

-- The API roles must exist and PostgREST must be able to switch into them.
do $$ begin
  assert exists (select 1 from pg_roles where rolname = 'anon'), 'anon role missing';
  assert exists (select 1 from pg_roles where rolname = 'authenticated'), 'authenticated role missing';
  assert exists (select 1 from pg_roles where rolname = 'authenticator'), 'authenticator role missing';
  assert pg_has_role('authenticator', 'authenticated', 'member'),
    'authenticator cannot switch to authenticated';
end $$;

-- A signed-in role must not be able to read auth.users directly; only the
-- security definer functions may touch it.
do $$
declare
  v_leaked boolean;
begin
  select has_table_privilege('authenticated', 'auth.users', 'select') into v_leaked;
  assert not v_leaked, 'authenticated can read auth.users directly';
end $$;

select 'GCP DEPLOYMENT VERIFIED' as result;
