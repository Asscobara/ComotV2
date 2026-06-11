-- Functional smoke test of the Phase 1 schema: signup, building creation,
-- join flow, approval, isolation between buildings, and committee handover.
\set ON_ERROR_STOP on

-- Three users sign up (trigger creates profiles)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'vaad@a.com', '{"full_name": "Dana Vaad"}'),
  ('00000000-0000-0000-0000-000000000002', 'tenant@a.com', '{"full_name": "Yossi Tenant"}'),
  ('00000000-0000-0000-0000-000000000003', 'other@b.com', '{"full_name": "Rina Other"}');

do $$ begin
  assert (select count(*) from public.profiles) = 3, 'profiles auto-created';
end $$;

-- Dana (committee) creates building A; Rina creates building B
set role app_user;
set test.uid = '00000000-0000-0000-0000-000000000001';
select public.create_building('', 'Herzl 12', 'Tel Aviv', 6, 24, 150, 5, 'monthly');
set test.uid = '00000000-0000-0000-0000-000000000003';
select public.create_building('Bldg B', 'Bialik 3', 'Haifa', 4, 8, 100, 1, 'monthly');
reset role;

do $$ begin
  assert (select count(*) from public.apartments) = 32, 'apartments auto-generated';
  assert (select name from public.buildings where address = 'Herzl 12') = 'Herzl 12', 'name defaults to address';
end $$;

-- stash building A invite code in a GUC so do-blocks can read it
select set_config('test.code_a', (select invite_code from public.buildings where address = 'Herzl 12'), false);

set role app_user;

-- Isolation: committee of A sees only building A
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from public.buildings) = 1, 'committee A sees exactly 1 building';
  assert (select count(*) from public.memberships) = 1, 'committee A sees only own memberships';
end $$;

-- Yossi joins building A by invite code
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$
declare
  v_code text := current_setting('test.code_a');
  v_apartment uuid;
  v_membership uuid;
begin
  assert public.get_building_by_invite_code(v_code) is not null, 'invite lookup works for non-member';
  assert public.get_building_by_invite_code('deadbeef') is null, 'bad code returns null';

  v_apartment := (public.get_building_by_invite_code(v_code) -> 'apartments' -> 0 ->> 'id')::uuid;
  v_membership := public.join_building(v_code, v_apartment, 'renter');
  perform set_config('test.membership_yossi', v_membership::text, false);

  assert (select status from public.memberships where id = v_membership) = 'pending', 'join lands pending';
  assert (select count(*) from public.memberships) = 1, 'pending tenant sees only self';
end $$;

-- Rina (committee of B) must NOT be able to approve a membership in building A
set test.uid = '00000000-0000-0000-0000-000000000003';
do $$
begin
  begin
    perform public.approve_member(current_setting('test.membership_yossi')::uuid, true);
    raise exception 'SECURITY HOLE: cross-building approval succeeded';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
  assert (select count(*) from public.memberships where id = current_setting('test.membership_yossi')::uuid) = 0,
    'cross-building membership row is invisible';
end $$;

-- Dana approves Yossi
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$ begin
  perform public.approve_member(current_setting('test.membership_yossi')::uuid, true);
end $$;

set test.uid = '00000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select status from public.memberships where id = current_setting('test.membership_yossi')::uuid) = 'active', 'approved';
  assert (select count(*) from public.memberships) = 2, 'active tenant sees building members';
  assert (select count(*) from public.profiles) = 2, 'tenant sees only own-building profiles';
  assert (select count(*) from public.buildings) = 1, 'tenant sees only own building';
end $$;

-- Handover: Dana nominates Yossi; role transfers only after Yossi confirms
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$
declare
  v_building uuid := (select building_id from public.memberships where id = current_setting('test.membership_yossi')::uuid);
  v_handover uuid;
begin
  v_handover := public.request_handover(v_building, '00000000-0000-0000-0000-000000000002');
  perform set_config('test.handover', v_handover::text, false);
  assert (select role from public.memberships where id = current_setting('test.membership_yossi')::uuid) = 'tenant',
    'no transfer before confirmation';
end $$;

set test.uid = '00000000-0000-0000-0000-000000000002';
do $$ begin
  perform public.respond_handover(current_setting('test.handover')::uuid, true);
  assert (select role from public.memberships where id = current_setting('test.membership_yossi')::uuid) = 'committee', 'successor promoted';
  assert (select role from public.memberships where user_id = '00000000-0000-0000-0000-000000000001') = 'tenant', 'outgoing demoted';
end $$;

reset role;
select 'ALL SMOKE TESTS PASSED' as result;
