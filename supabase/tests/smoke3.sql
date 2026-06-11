-- Phase 3a smoke tests: events, polls, budget.
-- Runs after smoke2.sql. State: building A (Dana=tenant, Yossi=committee), building B (Rina=committee).
\set ON_ERROR_STOP on

set role app_user;

-- ---------- Events ----------

-- Yossi (committee A) creates a meeting; Dana sees it; Dana can't create; Rina sees nothing
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$
declare v_building uuid := (select building_id from public.memberships where user_id = '00000000-0000-0000-0000-000000000002');
begin
  insert into public.events (building_id, kind, title, starts_at, recurrence, created_by)
  values (v_building, 'meeting', 'Annual tenants meeting', now() + interval '7 days', 'none', auth.uid());
  perform set_config('test.building_a', v_building::text, false);
end $$;

set test.uid = '00000000-0000-0000-0000-000000000001';
do $$
begin
  assert (select count(*) from public.events) = 1, 'tenant sees building events';
  begin
    insert into public.events (building_id, kind, title, starts_at)
    values (current_setting('test.building_a')::uuid, 'other', 'Rogue event', now());
    raise exception 'SECURITY HOLE: tenant created an event';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

set test.uid = '00000000-0000-0000-0000-000000000003';
do $$ begin
  assert (select count(*) from public.events) = 0, 'foreign events invisible';
end $$;

-- ---------- Polls ----------

-- committee creates a poll; tenant votes; vote can be changed; results aggregate correctly
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$
declare v_poll uuid;
begin
  -- needs at least 2 options
  begin
    perform public.create_poll(current_setting('test.building_a')::uuid, 'Bad poll', array['only one']);
    raise exception 'SECURITY HOLE: single-option poll accepted';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;

  v_poll := public.create_poll(
    current_setting('test.building_a')::uuid,
    'Special collection of 200 ILS per apartment for the pipe repair?',
    array['Approve', 'Reject', 'Abstain']
  );
  perform set_config('test.poll', v_poll::text, false);
  assert (select count(*) from public.poll_options where poll_id = v_poll) = 3, 'options created';
end $$;

-- tenant cannot create polls
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$
begin
  begin
    perform public.create_poll(current_setting('test.building_a')::uuid, 'Tenant poll', array['a', 'b']);
    raise exception 'SECURITY HOLE: tenant created a poll';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

-- Dana votes Approve, then changes to Reject (upsert)
do $$
declare
  v_poll uuid := current_setting('test.poll')::uuid;
  v_approve uuid := (select id from public.poll_options where poll_id = current_setting('test.poll')::uuid and label = 'Approve');
  v_reject uuid := (select id from public.poll_options where poll_id = current_setting('test.poll')::uuid and label = 'Reject');
  v_results jsonb;
begin
  perform public.vote(v_poll, v_approve);
  perform public.vote(v_poll, v_reject); -- change of mind
  v_results := public.poll_results(v_poll);
  assert (v_results ->> 'total_votes')::int = 1, 'one voter, one vote';
  assert (v_results ->> 'my_vote')::uuid = v_reject, 'my_vote reflects the change';
end $$;

-- anonymity: committee cannot read raw vote rows of an anonymous poll
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from public.poll_votes where poll_id = current_setting('test.poll')::uuid) = 0,
    'anonymous raw votes hidden from committee';
  assert ((public.poll_results(current_setting('test.poll')::uuid)) ->> 'total_votes')::int = 1,
    'aggregated results still available';
end $$;

-- Rina (building B) can neither see nor vote
set test.uid = '00000000-0000-0000-0000-000000000003';
do $$
begin
  assert (select count(*) from public.polls) = 0, 'foreign polls invisible';
  begin
    perform public.vote(current_setting('test.poll')::uuid,
      (select id from public.poll_options limit 1));
    raise exception 'SECURITY HOLE: cross-building vote accepted';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

-- closing stops voting
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$ begin perform public.close_poll(current_setting('test.poll')::uuid); end $$;
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$
begin
  begin
    perform public.vote(current_setting('test.poll')::uuid,
      (select id from public.poll_options where poll_id = current_setting('test.poll')::uuid limit 1));
    raise exception 'SECURITY HOLE: vote accepted on closed poll';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

-- ---------- Budget ----------

-- committee records an expense; tenant reads but cannot write; foreign building sees nothing
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$ begin
  insert into public.budget_entries (building_id, kind, category, title, amount, created_by)
  values (current_setting('test.building_a')::uuid, 'expense', 'repair', 'Pipe repair', 850, auth.uid());
end $$;

set test.uid = '00000000-0000-0000-0000-000000000001';
do $$
begin
  assert (select count(*) from public.budget_entries) = 1, 'tenant sees budget (transparency)';
  begin
    insert into public.budget_entries (building_id, kind, category, title, amount, created_by)
    values (current_setting('test.building_a')::uuid, 'expense', 'other_expense', 'Rogue', 1, auth.uid());
    raise exception 'SECURITY HOLE: tenant wrote a budget entry';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
  begin
    perform public.mark_fee_paid(current_setting('test.building_a')::uuid,
      (select id from public.apartments limit 1), '2026-06', null);
    raise exception 'SECURITY HOLE: tenant marked a fee as paid';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

set test.uid = '00000000-0000-0000-0000-000000000003';
do $$ begin
  assert (select count(*) from public.budget_entries) = 0, 'foreign budget invisible';
end $$;

-- mark_fee_paid: creates payment + income entry exactly once (idempotent)
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$
declare
  v_building uuid := current_setting('test.building_a')::uuid;
  v_apartment uuid := (select id from public.apartments where building_id = current_setting('test.building_a')::uuid and number = '3');
begin
  perform public.mark_fee_paid(v_building, v_apartment, '2026-06', null);
  perform public.mark_fee_paid(v_building, v_apartment, '2026-06', null); -- double call
  assert (select count(*) from public.fee_payments where apartment_id = v_apartment and period = '2026-06') = 1,
    'one payment row';
  assert (select count(*) from public.budget_entries where category = 'fee') = 1,
    'exactly one income entry despite double call';
  assert (select amount from public.fee_payments where apartment_id = v_apartment and period = '2026-06') = 150,
    'amount defaults to building fee_amount';
end $$;

reset role;
select 'ALL PHASE 3 SMOKE TESTS PASSED' as result;
