-- Phase 3b smoke tests: vendor marketplace, matching, bookings.
-- Runs after smoke3.sql. State: building A (Dana=tenant, Yossi=committee), building B (Rina=committee),
-- and an open 'plumbing' fault in building A from smoke2.
\set ON_ERROR_STOP on

-- a fourth user registers as a vendor
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000004', 'pipes@vendor.dev', '{"full_name": "Moshe Pipes"}');

set role app_user;

-- vendor self-registration
set test.uid = '00000000-0000-0000-0000-000000000004';
do $$
declare v_vendor uuid;
begin
  insert into public.vendors (user_id, business_name, categories, city, phone)
  values (auth.uid(), 'Moshe Pipes Ltd', array['plumbing', 'roofing'], 'Tel Aviv', '050-1234567')
  returning id into v_vendor;
  perform set_config('test.vendor', v_vendor::text, false);

  -- cannot register a vendor profile for someone else
  begin
    insert into public.vendors (user_id, business_name, categories, city)
    values ('00000000-0000-0000-0000-000000000001', 'Fake', array['plumbing'], 'Haifa');
    raise exception 'SECURITY HOLE: vendor profile created for another user';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

-- a second vendor in another city, non-matching category
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000005', 'spark@vendor.dev', '{"full_name": "Sara Spark"}');
set role app_user;
set test.uid = '00000000-0000-0000-0000-000000000005';
do $$ begin
  insert into public.vendors (user_id, business_name, categories, city)
  values (auth.uid(), 'Sara Spark Electrics', array['electricity'], 'Haifa');
end $$;

-- ---------- Matching ----------

-- committee of A matches vendors for the plumbing fault: only the plumber qualifies
set test.uid = '00000000-0000-0000-0000-000000000002';
do $$
declare
  v_fault uuid := current_setting('test.fault')::uuid;
  v_matches jsonb;
begin
  v_matches := public.match_vendors(v_fault);
  assert jsonb_array_length(v_matches) = 1, 'only category-matching vendors returned';
  assert v_matches -> 0 ->> 'business_name' = 'Moshe Pipes Ltd', 'right vendor matched';
  assert (v_matches -> 0 ->> 'same_city')::boolean = true, 'same-city flag set';
end $$;

-- foreign committee cannot match against building A's fault
set test.uid = '00000000-0000-0000-0000-000000000003';
do $$
begin
  begin
    perform public.match_vendors(current_setting('test.fault')::uuid);
    raise exception 'SECURITY HOLE: cross-building matching allowed';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

-- ---------- Booking ----------

-- tenant cannot book; committee books; fault moves to in_progress with timeline entry
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$
begin
  begin
    perform public.book_vendor(current_setting('test.fault')::uuid, current_setting('test.vendor')::uuid);
    raise exception 'SECURITY HOLE: tenant booked a vendor';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

set test.uid = '00000000-0000-0000-0000-000000000002';
do $$
declare v_booking uuid;
begin
  v_booking := public.book_vendor(current_setting('test.fault')::uuid, current_setting('test.vendor')::uuid);
  perform set_config('test.booking', v_booking::text, false);
  assert (select status from public.faults where id = current_setting('test.fault')::uuid) = 'in_progress',
    'fault back in progress after booking';
  assert (select count(*) from public.fault_updates
          where fault_id = current_setting('test.fault')::uuid and note like 'Booked:%') = 1,
    'booking recorded on timeline';

  -- no second live booking for the same fault
  begin
    perform public.book_vendor(current_setting('test.fault')::uuid, current_setting('test.vendor')::uuid);
    raise exception 'SECURITY HOLE: duplicate live booking allowed';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

-- the vendor sees the booking (with snapshot data) but NOT the building's faults
set test.uid = '00000000-0000-0000-0000-000000000004';
do $$
begin
  assert (select count(*) from public.fault_bookings) = 1, 'vendor sees own booking';
  assert (select fault_title from public.fault_bookings limit 1) = 'Burst pipe', 'snapshot title present';
  assert (select count(*) from public.faults) = 0, 'vendor cannot read building faults';
  assert (select count(*) from public.buildings) = 0, 'vendor cannot read buildings';

  perform public.respond_booking(current_setting('test.booking')::uuid, true);
  assert (select status from public.fault_bookings limit 1) = 'accepted', 'vendor accepted';
end $$;

-- the other vendor cannot see or respond to this booking
set test.uid = '00000000-0000-0000-0000-000000000005';
do $$
begin
  assert (select count(*) from public.fault_bookings) = 0, 'foreign vendor sees no bookings';
  begin
    perform public.respond_booking(current_setting('test.booking')::uuid, false);
    raise exception 'SECURITY HOLE: foreign vendor responded to booking';
  exception when others then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
  end;
end $$;

-- building members see the acceptance on the timeline
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from public.fault_updates
          where fault_id = current_setting('test.fault')::uuid and note like '%accepted the job%') = 1,
    'acceptance visible to building members';
end $$;

reset role;
select 'ALL PHASE 3B SMOKE TESTS PASSED' as result;
