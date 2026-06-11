-- Phase 2 smoke tests: chat (channels + DMs) and fault reporting.
-- Runs after smoke.sql. State: building A (Dana=tenant, Yossi=committee), building B (Rina=committee).
\set ON_ERROR_STOP on

set role app_user;

-- ---------- Channels ----------

-- Each member sees only their own building's #general
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$
declare v_channel uuid;
begin
  assert (select count(*) from public.conversations) = 1, 'Dana sees exactly one conversation';
  select id into v_channel from public.conversations where kind = 'channel' and name = 'general';
  perform set_config('test.channel_a', v_channel::text, false);

  insert into public.messages (conversation_id, building_id, sender_id, body)
  values (v_channel, (select building_id from public.conversations where id = v_channel),
          '00000000-0000-0000-0000-000000000001', 'Hello building A!');
end $$;

-- Yossi (same building) reads the message
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from public.messages) = 1, 'Yossi sees the channel message';
end $$;

-- Rina (building B) sees neither the conversation nor the message, and cannot post into it
set test.uid = '00000000-0000-0000-0000-000000000003';
do $$
begin
  assert (select count(*) from public.conversations where id = current_setting('test.channel_a')::uuid) = 0,
    'foreign channel invisible';
  assert (select count(*) from public.messages) = 0, 'foreign messages invisible';
  begin
    insert into public.messages (conversation_id, building_id, sender_id, body)
    values (current_setting('test.channel_a')::uuid,
            (select id from public.buildings where address = 'Bialik 3'),
            '00000000-0000-0000-0000-000000000003', 'intruder');
    raise exception 'SECURITY HOLE: cross-building message insert succeeded';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

-- ---------- DMs ----------

set test.uid = '00000000-0000-0000-0000-000000000001';
do $$
declare
  v_building uuid := (select building_id from public.conversations where id = current_setting('test.channel_a')::uuid);
  v_dm uuid;
  v_dm2 uuid;
begin
  v_dm := public.get_or_create_dm(v_building, '00000000-0000-0000-0000-000000000002');
  v_dm2 := public.get_or_create_dm(v_building, '00000000-0000-0000-0000-000000000002');
  assert v_dm = v_dm2, 'DM is deduplicated';
  perform set_config('test.dm', v_dm::text, false);

  insert into public.messages (conversation_id, building_id, sender_id, body)
  values (v_dm, v_building, '00000000-0000-0000-0000-000000000001', 'private hello');

  -- DM with a non-member of the building must fail
  begin
    perform public.get_or_create_dm(v_building, '00000000-0000-0000-0000-000000000003');
    raise exception 'SECURITY HOLE: DM with non-member succeeded';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

-- Rina cannot read the DM
set test.uid = '00000000-0000-0000-0000-000000000003';
do $$ begin
  assert (select count(*) from public.messages where conversation_id = current_setting('test.dm')::uuid) = 0,
    'foreign DM invisible';
end $$;

-- ---------- Faults ----------

-- Dana (tenant) reports a fault
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$
declare
  v_building uuid := (select building_id from public.conversations where id = current_setting('test.channel_a')::uuid);
  v_fault uuid;
begin
  insert into public.faults (building_id, reporter_id, category, title, description, location)
  values (v_building, '00000000-0000-0000-0000-000000000001', 'plumbing', 'Burst pipe', 'Water in the lobby', 'Floor 1')
  returning id into v_fault;
  perform set_config('test.fault', v_fault::text, false);

  -- reporter is not committee: direct status change via RPC must fail
  begin
    perform public.update_fault_status(v_fault, 'in_progress', null);
    raise exception 'SECURITY HOLE: non-committee status change succeeded';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;

  -- reporter can add a plain note (status must be null)
  insert into public.fault_updates (fault_id, building_id, author_id, note)
  values (v_fault, v_building, '00000000-0000-0000-0000-000000000001', 'It is getting worse');

  begin
    insert into public.fault_updates (fault_id, building_id, author_id, status, note)
    values (v_fault, v_building, '00000000-0000-0000-0000-000000000001', 'resolved', 'sneaky resolve');
    raise exception 'SECURITY HOLE: tenant wrote a status row directly';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

-- Rina (building B committee) sees nothing and cannot touch the fault
set test.uid = '00000000-0000-0000-0000-000000000003';
do $$
begin
  assert (select count(*) from public.faults) = 0, 'foreign faults invisible';
  begin
    perform public.update_fault_status(current_setting('test.fault')::uuid, 'closed', null);
    raise exception 'SECURITY HOLE: cross-building fault status change succeeded';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

-- Yossi (committee of A) moves the fault through its lifecycle
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$ begin
  perform public.update_fault_status(current_setting('test.fault')::uuid, 'in_progress', 'Plumber booked');
  perform public.update_fault_status(current_setting('test.fault')::uuid, 'resolved', 'Pipe replaced');
  assert (select status from public.faults where id = current_setting('test.fault')::uuid) = 'resolved', 'status updated';
  assert (select resolved_at from public.faults where id = current_setting('test.fault')::uuid) is not null, 'resolved_at set';
  assert (select count(*) from public.fault_updates where fault_id = current_setting('test.fault')::uuid) = 3,
    'timeline has note + 2 status rows';
end $$;

reset role;
select 'ALL PHASE 2 SMOKE TESTS PASSED' as result;
