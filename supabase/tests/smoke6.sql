-- Phase 5 smoke tests: self-service account deletion.
--
-- The interesting cases are not "does the row disappear" but the ones that would
-- either lose other people's data or leave a building unmanageable.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000601', 'vaad6@a.com',   '{"full_name": "Committee Six"}'),
  ('00000000-0000-0000-0000-000000000602', 'tenant6@a.com', '{"full_name": "Tenant Six"}'),
  ('00000000-0000-0000-0000-000000000603', 'solo6@b.com',   '{"full_name": "Solo Six"}'),
  ('00000000-0000-0000-0000-000000000604', 'vendor6@c.com', '{"full_name": "Vendor Six"}');

set role app_user;

-- Committee Six runs a building with one tenant. Solo Six runs one alone.
set test.uid = '00000000-0000-0000-0000-000000000601';
select public.create_building('Bldg Six', 'Six St 6', 'Tel Aviv', 2, 4, 100, 1, 'monthly');
select set_config('test.b6', (select id::text from public.buildings where address = 'Six St 6'), false);
select set_config('test.code6', (select invite_code from public.buildings where address = 'Six St 6'), false);

set test.uid = '00000000-0000-0000-0000-000000000603';
select public.create_building('Solo Bldg', 'Solo St 1', 'Haifa', 1, 2, 80, 1, 'monthly');
select set_config('test.bsolo', (select id::text from public.buildings where address = 'Solo St 1'), false);

-- Tenant Six joins and is approved.
set test.uid = '00000000-0000-0000-0000-000000000602';
do $$ begin
  perform public.join_building(current_setting('test.code6'), null, 'owner');
end $$;
set test.uid = '00000000-0000-0000-0000-000000000601';
do $$ begin
  perform public.approve_member(
    (select id from public.memberships where user_id = '00000000-0000-0000-0000-000000000602'), true);
end $$;

-- The sole committee member of a populated building cannot delete their account.
do $$
declare
  v_preview jsonb;
begin
  v_preview := public.account_deletion_preview();
  assert jsonb_array_length(v_preview -> 'blocking_buildings') = 1,
    'preview warns that the building would be left without a committee';
  assert v_preview -> 'blocking_buildings' -> 0 ->> 'name' = 'Bldg Six', 'names the building';
end $$;

do $$
declare
  v_failed boolean := false;
begin
  begin
    perform public.delete_own_account();
  exception when others then
    v_failed := true;
    assert sqlerrm like 'committee_handover_required%', 'refused for the right reason: ' || sqlerrm;
  end;
  assert v_failed, 'sole committee member of a populated building is refused';
end $$;

-- auth.users is not readable by the authenticated role on Supabase, so this
-- check runs with the role reset rather than granting the stub extra privileges.
reset role;
do $$ begin
  assert (select count(*) from auth.users where id = '00000000-0000-0000-0000-000000000601') = 1,
    'the refused account still exists';
  assert (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000601') = 1,
    'and so does its profile';
end $$;
set role app_user;

-- A tenant can always leave. Their own content goes; the building stays.
set test.uid = '00000000-0000-0000-0000-000000000602';
do $$ begin
  assert jsonb_array_length(public.account_deletion_preview() -> 'blocking_buildings') = 0,
    'a tenant is never blocked';
  assert jsonb_array_length(public.account_deletion_preview() -> 'buildings_removed') = 0,
    'a tenant does not take the building with them';
end $$;

-- Reported faults cascade with their reporter, so check one is really gone.
do $$ begin
  perform public.report_fault(current_setting('test.b6')::uuid, 'plumbing', 'Tenant leak', null, null);
exception when undefined_function then
  insert into public.faults (building_id, reporter_id, category, title)
  values (current_setting('test.b6')::uuid, '00000000-0000-0000-0000-000000000602', 'plumbing', 'Tenant leak');
end $$;

do $$ begin
  perform public.delete_own_account();
end $$;
reset role;

do $$ begin
  assert (select count(*) from auth.users where id = '00000000-0000-0000-0000-000000000602') = 0,
    'the tenant account is gone';
  assert (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000602') = 0,
    'the profile cascaded';
  assert (select count(*) from public.memberships where user_id = '00000000-0000-0000-0000-000000000602') = 0,
    'the membership cascaded';
  assert (select count(*) from public.faults where title = 'Tenant leak') = 0,
    'their reported fault cascaded';
  assert (select count(*) from public.buildings where address = 'Six St 6') = 1,
    'the building itself survives';
end $$;

-- With the tenant gone, the committee member is the last member and may leave;
-- the building goes with them rather than becoming an orphan.
set role app_user;
set test.uid = '00000000-0000-0000-0000-000000000601';
do $$
declare
  v_preview jsonb;
begin
  v_preview := public.account_deletion_preview();
  assert jsonb_array_length(v_preview -> 'blocking_buildings') = 0, 'no longer blocked';
  assert jsonb_array_length(v_preview -> 'buildings_removed') = 1,
    'warned that the building will be removed';
  perform public.delete_own_account();
end $$;
reset role;

do $$ begin
  assert (select count(*) from auth.users where id = '00000000-0000-0000-0000-000000000601') = 0,
    'the last committee member is deleted';
  assert (select count(*) from public.buildings where address = 'Six St 6') = 0,
    'the emptied building is removed with them';
  assert (select count(*) from public.apartments
          where building_id = current_setting('test.b6')::uuid) = 0,
    'its apartments cascaded';
end $$;

-- Deleting one account must not touch anyone else's building.
do $$ begin
  assert (select count(*) from public.buildings where address = 'Solo St 1') = 1,
    'an unrelated building is untouched';
end $$;

-- A vendor with no building membership can delete their account too.
set role app_user;
set test.uid = '00000000-0000-0000-0000-000000000604';
do $$ begin
  perform public.upsert_vendor('Six Plumbing', array['plumbing'], 'Tel Aviv', '050-0000000', null);
exception when undefined_function then
  insert into public.vendors (user_id, business_name, categories, city)
  values ('00000000-0000-0000-0000-000000000604', 'Six Plumbing', array['plumbing'], 'Tel Aviv');
end $$;

do $$ begin
  assert (public.account_deletion_preview() ->> 'is_vendor')::boolean, 'preview reports vendor status';
  perform public.delete_own_account();
end $$;
reset role;

do $$ begin
  assert (select count(*) from public.vendors where business_name = 'Six Plumbing') = 0,
    'the vendor profile cascaded';
end $$;

-- Deletion is scoped to the caller: an anonymous call must fail outright rather
-- than deleting anything.
set role app_user;
set test.uid = '';
do $$
declare
  v_failed boolean := false;
begin
  begin
    perform public.delete_own_account();
  exception when others then
    v_failed := true;
  end;
  assert v_failed, 'an unauthenticated call is refused';
end $$;
reset role;

do $$ begin
  assert (select count(*) from public.buildings where address = 'Solo St 1') = 1,
    'nothing was deleted by the unauthenticated call';
  assert (select count(*) from auth.users where id = '00000000-0000-0000-0000-000000000603') = 1,
    'Solo Six is still there';
end $$;

select 'ALL PHASE 5 SMOKE TESTS PASSED' as result;
