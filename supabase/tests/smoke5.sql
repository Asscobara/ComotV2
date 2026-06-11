-- Phase 4 smoke tests: trigger-driven notifications, fee reminders, meeting rooms.
-- Runs after smoke4.sql. State: building A (Dana=tenant(1), Yossi=committee(2)),
-- building B (Rina=3), vendor Moshe(4) with an accepted booking on the 'Burst pipe' fault.
\set ON_ERROR_STOP on

-- a sixth user joins building A (tests pending/approved notifications)
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000006', 'newbie@a.com', '{"full_name": "Noa New"}');
set role app_user;

-- Noa requests to join apartment 1 of building A
set test.uid = '00000000-0000-0000-0000-000000000006';
do $$
declare
  v_preview jsonb := public.get_building_by_invite_code(current_setting('test.code_a'));
  v_apartment uuid;
begin
  select (a ->> 'id')::uuid into v_apartment
  from jsonb_array_elements(v_preview -> 'apartments') a
  where a ->> 'number' = '1';
  perform public.join_building(current_setting('test.code_a'), v_apartment, 'renter');
end $$;

-- committee (Yossi) got a member_pending notification; Dana (tenant) did not
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$
declare v_membership uuid;
begin
  assert (select count(*) from public.notifications where kind = 'member_pending'
          and payload ->> 'full_name' = 'Noa New') = 1, 'committee notified about pending member';

  select id into v_membership from public.memberships
  where user_id = '00000000-0000-0000-0000-000000000006' and status = 'pending';
  perform public.approve_member(v_membership, true);
end $$;

set test.uid = '00000000-0000-0000-0000-000000000001';
do $$ begin
  -- Dana was committee back when Yossi joined (earlier suite), but was a plain
  -- tenant when Noa applied — so she must have no notification about Noa.
  assert (select count(*) from public.notifications where kind = 'member_pending'
          and payload ->> 'full_name' = 'Noa New') = 0,
    'tenant not notified about pending member';
end $$;

-- Noa got the approval notification; notifications are strictly personal
set test.uid = '00000000-0000-0000-0000-000000000006';
do $$
declare v_notification uuid;
begin
  assert (select count(*) from public.notifications where kind = 'member_approved') = 1,
    'applicant notified about approval';

  -- mark as read works on own rows
  select id into v_notification from public.notifications where kind = 'member_approved';
  update public.notifications set read_at = now() where id = v_notification;
  assert (select read_at from public.notifications where id = v_notification) is not null, 'mark read works';
end $$;

-- ---------- Fault + poll + booking notifications ----------

-- Dana reports a fault -> committee (Yossi) notified; Dana not
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$
declare
  v_building uuid := current_setting('test.building_a')::uuid;
  v_fault uuid;
begin
  insert into public.faults (building_id, reporter_id, category, title)
  values (v_building, auth.uid(), 'electricity', 'Stairwell light broken')
  returning id into v_fault;
  perform set_config('test.fault2', v_fault::text, false);
  assert (select count(*) from public.notifications where kind = 'fault_reported') = 0,
    'reporter not self-notified';
end $$;

set test.uid = '00000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from public.notifications where kind = 'fault_reported'
          and payload ->> 'title' = 'Stairwell light broken') = 1, 'committee notified about new fault';

  -- status change -> reporter notified
  perform public.update_fault_status(current_setting('test.fault2')::uuid, 'in_progress', null);
end $$;

set test.uid = '00000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from public.notifications where kind = 'fault_status'
          and payload ->> 'title' = 'Stairwell light broken'
          and payload ->> 'status' = 'in_progress') = 1, 'reporter notified about status change';
end $$;

-- a poll notifies members but not its creator, and never building B
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$ begin
  perform public.create_poll(current_setting('test.building_a')::uuid, 'Renovate the lobby?', array['Yes', 'No']);
  assert (select count(*) from public.notifications where kind = 'poll_opened') = 0, 'creator not self-notified';
end $$;
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from public.notifications where kind = 'poll_opened'
          and payload ->> 'question' = 'Renovate the lobby?') = 1, 'member notified about poll';
end $$;
set test.uid = '00000000-0000-0000-0000-000000000003';
do $$ begin
  assert (select count(*) from public.notifications) = 0, 'building B got nothing';
end $$;

-- booking: vendor notified on new booking; committee notified on response
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$
declare v_booking uuid;
begin
  v_booking := public.book_vendor(
    current_setting('test.fault2')::uuid,
    (select id from public.vendors where business_name = 'Sara Spark Electrics')
  );
  perform set_config('test.booking2', v_booking::text, false);
end $$;

set test.uid = '00000000-0000-0000-0000-000000000005';
do $$ begin
  assert (select count(*) from public.notifications where kind = 'booking_new'
          and payload ->> 'title' = 'Stairwell light broken') = 1, 'vendor notified about new job';
  perform public.respond_booking(current_setting('test.booking2')::uuid, false);
end $$;

set test.uid = '00000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from public.notifications where kind = 'booking_response'
          and payload ->> 'status' = 'declined') = 1, 'committee notified about vendor decline';
end $$;

-- ---------- Fee reminders ----------

reset role;
-- make today building A's due day and nothing paid for the current period
update public.buildings set fee_due_day = least(extract(day from now())::int, 28)
where id = (select current_setting('test.building_a'))::uuid;
delete from public.fee_payments where period = to_char(now(), 'YYYY-MM');
set role app_user;

set test.uid = '00000000-0000-0000-0000-000000000002';
do $$
declare v_first int; v_second int;
begin
  v_first := public.run_fee_reminders();
  v_second := public.run_fee_reminders();
  -- members with an apartment in building A: Yossi (apt 3) and Noa (apt 1)
  assert v_first = 2, format('expected 2 reminders, got %s', v_first);
  assert v_second = 0, 'reminders are deduplicated per period';
end $$;

set test.uid = '00000000-0000-0000-0000-000000000006';
do $$ begin
  assert (select count(*) from public.notifications where kind = 'fee_due') = 1, 'unpaid member reminded';
end $$;

-- ---------- Virtual meeting room ----------

set test.uid = '00000000-0000-0000-0000-000000000001';
do $$
declare
  v_event uuid := (select id from public.events where title = 'Annual tenants meeting');
  v_room uuid;
  v_room2 uuid;
begin
  v_room := public.get_or_create_event_channel(v_event);
  v_room2 := public.get_or_create_event_channel(v_event);
  assert v_room = v_room2, 'meeting room is deduplicated';
  assert (select count(*) from public.conversations where id = v_room) = 1, 'member can access the room';

  insert into public.messages (conversation_id, building_id, sender_id, body)
  values (v_room, current_setting('test.building_a')::uuid, auth.uid(), 'See you at the meeting!');
end $$;

set test.uid = '00000000-0000-0000-0000-000000000003';
do $$
declare v_event uuid;
begin
  reset role; -- peek at the event id as superuser, then act as Rina
  set role app_user;
  begin
    perform public.get_or_create_event_channel(
      (select id from public.events where title = 'Annual tenants meeting' limit 1)
    );
    raise exception 'SECURITY HOLE: foreign member opened a meeting room';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

reset role;
select 'ALL PHASE 4 SMOKE TESTS PASSED' as result;
