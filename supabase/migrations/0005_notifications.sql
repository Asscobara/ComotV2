-- ComOt — Phase 4 schema: in-app notifications (trigger-driven), fee reminders,
-- and virtual meeting rooms (event-linked chat channels).

-- ============================================================
-- Notifications
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  building_id uuid references public.buildings (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

-- strictly personal: each user sees and updates only their own
create policy notifications_select on public.notifications for select
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- rows are written exclusively by the trigger/RPC functions below

-- ============================================================
-- Helpers
-- ============================================================

create function public.notify_users(
  p_user_ids uuid[],
  p_building uuid,
  p_kind text,
  p_payload jsonb
) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, building_id, kind, payload)
  select distinct unnest_id, p_building, p_kind, p_payload
  from unnest(p_user_ids) as unnest_id
  where unnest_id is not null;
$$;

create function public.committee_ids(b uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(user_id), '{}'::uuid[]) from memberships
  where building_id = b and role = 'committee' and status = 'active';
$$;

create function public.active_member_ids(b uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(user_id), '{}'::uuid[]) from memberships
  where building_id = b and status = 'active';
$$;

-- ============================================================
-- Trigger-driven notifications
-- ============================================================

-- new join request -> committee
create function public.tg_notify_member_pending() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    perform public.notify_users(
      public.committee_ids(new.building_id),
      new.building_id,
      'member_pending',
      jsonb_build_object(
        'full_name', (select full_name from profiles where id = new.user_id)
      )
    );
  end if;
  return new;
end;
$$;
create trigger notify_member_pending after insert on public.memberships
  for each row execute function public.tg_notify_member_pending();

-- approval / rejection -> the applicant
create function public.tg_notify_member_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status in ('active', 'rejected') then
    perform public.notify_users(
      array[new.user_id],
      new.building_id,
      case when new.status = 'active' then 'member_approved' else 'member_rejected' end,
      jsonb_build_object('building_name', (select name from buildings where id = new.building_id))
    );
  end if;
  return new;
end;
$$;
create trigger notify_member_decision after update on public.memberships
  for each row execute function public.tg_notify_member_decision();

-- new fault -> committee (except the reporter)
create function public.tg_notify_fault_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_users(
    array_remove(public.committee_ids(new.building_id), new.reporter_id),
    new.building_id,
    'fault_reported',
    jsonb_build_object('fault_id', new.id, 'title', new.title, 'category', new.category)
  );
  return new;
end;
$$;
create trigger notify_fault_reported after insert on public.faults
  for each row execute function public.tg_notify_fault_reported();

-- fault status change -> the reporter (unless they made the change)
create function public.tg_notify_fault_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_fault faults%rowtype;
begin
  if new.status is not null then
    select * into v_fault from faults where id = new.fault_id;
    if v_fault.reporter_id <> new.author_id then
      perform public.notify_users(
        array[v_fault.reporter_id],
        new.building_id,
        'fault_status',
        jsonb_build_object('fault_id', new.fault_id, 'title', v_fault.title, 'status', new.status)
      );
    end if;
  end if;
  return new;
end;
$$;
create trigger notify_fault_status after insert on public.fault_updates
  for each row execute function public.tg_notify_fault_status();

-- handover nomination -> the successor
create function public.tg_notify_handover() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    perform public.notify_users(
      array[new.to_user_id],
      new.building_id,
      'handover_request',
      jsonb_build_object(
        'building_name', (select name from buildings where id = new.building_id),
        'from_name', (select full_name from profiles where id = new.from_user_id)
      )
    );
  end if;
  return new;
end;
$$;
create trigger notify_handover after insert on public.committee_handovers
  for each row execute function public.tg_notify_handover();

-- new poll -> all active members (except the creator)
create function public.tg_notify_poll() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_users(
    array_remove(public.active_member_ids(new.building_id), new.created_by),
    new.building_id,
    'poll_opened',
    jsonb_build_object('poll_id', new.id, 'question', new.question)
  );
  return new;
end;
$$;
create trigger notify_poll after insert on public.polls
  for each row execute function public.tg_notify_poll();

-- new booking -> the vendor; vendor's answer -> committee
create function public.tg_notify_booking_new() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_users(
    array[(select user_id from vendors where id = new.vendor_id)],
    null,
    'booking_new',
    jsonb_build_object('booking_id', new.id, 'title', new.fault_title, 'category', new.fault_category, 'city', new.city)
  );
  return new;
end;
$$;
create trigger notify_booking_new after insert on public.fault_bookings
  for each row execute function public.tg_notify_booking_new();

create function public.tg_notify_booking_response() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'booked' and new.status in ('accepted', 'declined') then
    perform public.notify_users(
      public.committee_ids(new.building_id),
      new.building_id,
      'booking_response',
      jsonb_build_object(
        'fault_id', new.fault_id,
        'title', new.fault_title,
        'status', new.status,
        'vendor_name', (select business_name from vendors where id = new.vendor_id)
      )
    );
  end if;
  return new;
end;
$$;
create trigger notify_booking_response after update on public.fault_bookings
  for each row execute function public.tg_notify_booking_response();

-- ============================================================
-- Fee due reminders (run daily; scheduled automatically when pg_cron exists)
-- ============================================================

create function public.run_fee_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  v_period text := to_char(now(), 'YYYY-MM');
  r record;
begin
  for r in
    select m.user_id, b.id as building_id, b.fee_amount, b.name as building_name
    from buildings b
    join memberships m on m.building_id = b.id and m.status = 'active' and m.apartment_id is not null
    where extract(day from now()) = b.fee_due_day
      and b.fee_amount > 0
      and not exists (
        select 1 from fee_payments fp
        where fp.building_id = b.id and fp.apartment_id = m.apartment_id and fp.period = v_period
      )
      and not exists (
        select 1 from notifications n
        where n.user_id = m.user_id and n.kind = 'fee_due'
          and n.building_id = b.id and n.payload ->> 'period' = v_period
      )
  loop
    perform public.notify_users(
      array[r.user_id],
      r.building_id,
      'fee_due',
      jsonb_build_object('period', v_period, 'amount', r.fee_amount, 'building_name', r.building_name)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('comot-fee-reminders', '0 8 * * *', 'select public.run_fee_reminders()');
  end if;
end $$;

-- ============================================================
-- Virtual meeting rooms: a chat channel linked to an event
-- ============================================================

alter table public.conversations add column event_id uuid references public.events (id) on delete cascade;
create unique index conversations_event_idx on public.conversations (event_id) where event_id is not null;

create function public.get_or_create_event_channel(p_event_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_event events%rowtype;
  v_conversation uuid;
begin
  select * into v_event from events where id = p_event_id;
  if not found or not public.is_active_member(v_event.building_id) then
    raise exception 'not authorized';
  end if;

  select id into v_conversation from conversations where event_id = p_event_id;
  if found then
    return v_conversation;
  end if;

  insert into conversations (building_id, kind, name, event_id, created_by)
  values (
    v_event.building_id,
    'channel',
    left(v_event.title, 40) || ' · ' || to_char(v_event.starts_at, 'DD.MM'),
    p_event_id,
    auth.uid()
  )
  on conflict (event_id) where event_id is not null do nothing
  returning id into v_conversation;

  if v_conversation is null then
    select id into v_conversation from conversations where event_id = p_event_id;
  end if;
  return v_conversation;
end;
$$;

-- ============================================================
-- Realtime (no-op on plain Postgres)
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
