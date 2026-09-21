-- Privileges for the PostgREST-facing roles. Run after the migrations, because it
-- grants on objects the migrations create.
--
-- RLS does the real authorisation work; these grants only decide which tables the
-- API is willing to talk about at all. Without them PostgREST reports the schema
-- as empty. With them but without RLS, everything would be exposed — which is why
-- 03-verify.sql asserts that RLS is enabled on every table.

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;

grant execute on function auth.uid() to anon, authenticated;
grant execute on function auth.role() to anon, authenticated;
grant execute on function auth.email() to anon, authenticated;

-- Signed-in users: table access, constrained per row by the 46 RLS policies.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Anonymous callers get nothing beyond schema usage. Every screen in this app is
-- behind sign-in, and every RPC guards on auth.uid(), so an unauthenticated
-- request has nothing legitimate to reach: it gets a 401 rather than an empty
-- result that could be mistaken for "no data".
--
-- Worth stating because it is tempting to grant the invite-code lookup to anon on
-- the assumption that joining a building happens before sign-in. It does not —
-- get_building_by_invite_code raises 'not authenticated' by design, and the
-- onboarding screen that calls it is already behind a session.

-- Anything added later inherits the same shape.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

notify pgrst, 'reload schema';
