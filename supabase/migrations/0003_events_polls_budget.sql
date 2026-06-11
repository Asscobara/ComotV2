-- ComOt — Phase 3a schema: events, live polls, and budget management.

-- ============================================================
-- Events
-- ============================================================

create type public.event_kind as enum ('meeting', 'maintenance', 'payment', 'other');
create type public.event_recurrence as enum ('none', 'weekly', 'monthly', 'yearly');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  kind public.event_kind not null default 'other',
  title text not null check (length(trim(title)) between 2 and 120),
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  recurrence public.event_recurrence not null default 'none',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_building_idx on public.events (building_id, starts_at);

create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- ============================================================
-- Polls (committee launches; tenants vote; results live)
-- ============================================================

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  question text not null check (length(trim(question)) between 2 and 300),
  is_anonymous boolean not null default true,
  status text not null default 'open' check (status in ('open', 'closed')),
  closes_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  building_id uuid not null references public.buildings (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 120),
  position int not null default 0
);

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  building_id uuid not null references public.buildings (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index polls_building_idx on public.polls (building_id, created_at desc);
create index poll_options_poll_idx on public.poll_options (poll_id, position);
create index poll_votes_poll_idx on public.poll_votes (poll_id);

-- ============================================================
-- Budget
-- ============================================================

create type public.budget_kind as enum ('income', 'expense');

create table public.budget_entries (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  kind public.budget_kind not null,
  category text not null check (category in (
    'fee', 'special_collection', 'other_income',
    'gardening', 'electricity', 'cleaning', 'elevator', 'maintenance', 'repair', 'other_expense'
  )),
  title text not null check (length(trim(title)) between 1 and 120),
  amount numeric(12, 2) not null check (amount > 0),
  entry_date date not null default current_date,
  fault_id uuid references public.faults (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- one row per apartment per billing period (period format: 'YYYY-MM')
create table public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  apartment_id uuid not null references public.apartments (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  amount numeric(12, 2) not null check (amount >= 0),
  paid_at timestamptz not null default now(),
  marked_by uuid references public.profiles (id) on delete set null,
  unique (building_id, apartment_id, period)
);

create index budget_entries_building_idx on public.budget_entries (building_id, entry_date desc);
create index fee_payments_building_period_idx on public.fee_payments (building_id, period);

-- ============================================================
-- RLS
-- ============================================================

alter table public.events enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.budget_entries enable row level security;
alter table public.fee_payments enable row level security;

-- events: full transparency for members; committee manages
create policy events_select on public.events for select
  using (public.is_active_member(building_id));
create policy events_insert on public.events for insert
  with check (public.is_committee(building_id));
create policy events_update on public.events for update
  using (public.is_committee(building_id)) with check (public.is_committee(building_id));
create policy events_delete on public.events for delete
  using (public.is_committee(building_id));

-- polls & options: members read; committee creates (votes go through the vote() RPC)
create policy polls_select on public.polls for select
  using (public.is_active_member(building_id));
create policy polls_insert on public.polls for insert
  with check (public.is_committee(building_id));
create policy polls_update on public.polls for update
  using (public.is_committee(building_id)) with check (public.is_committee(building_id));

create policy poll_options_select on public.poll_options for select
  using (public.is_active_member(building_id));
create policy poll_options_insert on public.poll_options for insert
  with check (public.is_committee(building_id));

-- raw votes: voters see their own; committee sees rows only for non-anonymous polls.
-- aggregated results come from the poll_results() RPC, which never exposes voter identity
-- for anonymous polls.
create policy poll_votes_select on public.poll_votes for select
  using (
    user_id = auth.uid()
    or (
      public.is_committee(building_id)
      and not exists (select 1 from public.polls p where p.id = poll_id and p.is_anonymous)
    )
  );

-- budget: full transparency for members; committee writes
create policy budget_entries_select on public.budget_entries for select
  using (public.is_active_member(building_id));
create policy budget_entries_insert on public.budget_entries for insert
  with check (public.is_committee(building_id) and created_by = auth.uid());
create policy budget_entries_delete on public.budget_entries for delete
  using (public.is_committee(building_id));

create policy fee_payments_select on public.fee_payments for select
  using (public.is_active_member(building_id));
-- fee payments are written through the mark_fee_paid() RPC only

-- ============================================================
-- RPCs
-- ============================================================

-- Committee creates a poll together with its options (atomic).
create function public.create_poll(
  p_building_id uuid,
  p_question text,
  p_options text[],
  p_event_id uuid default null,
  p_is_anonymous boolean default true,
  p_closes_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_poll_id uuid;
  v_label text;
  v_pos int := 0;
begin
  if not public.is_committee(p_building_id) then
    raise exception 'not authorized';
  end if;
  if array_length(p_options, 1) is null or array_length(p_options, 1) < 2 then
    raise exception 'a poll needs at least 2 options';
  end if;
  if p_event_id is not null and not exists (
    select 1 from events where id = p_event_id and building_id = p_building_id
  ) then
    raise exception 'event does not belong to this building';
  end if;

  insert into polls (building_id, event_id, question, is_anonymous, closes_at, created_by)
  values (p_building_id, p_event_id, p_question, p_is_anonymous, p_closes_at, auth.uid())
  returning id into v_poll_id;

  foreach v_label in array p_options loop
    if length(trim(v_label)) > 0 then
      insert into poll_options (poll_id, building_id, label, position)
      values (v_poll_id, p_building_id, trim(v_label), v_pos);
      v_pos := v_pos + 1;
    end if;
  end loop;

  return v_poll_id;
end;
$$;

-- Active member casts (or changes) their vote while the poll is open.
create function public.vote(p_poll_id uuid, p_option_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_poll polls%rowtype;
begin
  select * into v_poll from polls where id = p_poll_id;
  if not found or not public.is_active_member(v_poll.building_id) then
    raise exception 'not authorized';
  end if;
  if v_poll.status <> 'open' or (v_poll.closes_at is not null and v_poll.closes_at < now()) then
    raise exception 'poll is closed';
  end if;
  if not exists (select 1 from poll_options where id = p_option_id and poll_id = p_poll_id) then
    raise exception 'option does not belong to this poll';
  end if;

  insert into poll_votes (poll_id, building_id, option_id, user_id)
  values (p_poll_id, v_poll.building_id, p_option_id, auth.uid())
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id, created_at = now();
end;
$$;

create function public.close_poll(p_poll_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_building uuid;
begin
  select building_id into v_building from polls where id = p_poll_id;
  if not found or not public.is_committee(v_building) then
    raise exception 'not authorized';
  end if;
  update polls set status = 'closed' where id = p_poll_id;
end;
$$;

-- Aggregated results; never exposes voter identities for anonymous polls.
create function public.poll_results(p_poll_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_poll polls%rowtype;
begin
  select * into v_poll from polls where id = p_poll_id;
  if not found or not public.is_active_member(v_poll.building_id) then
    raise exception 'not authorized';
  end if;

  return jsonb_build_object(
    'poll_id', v_poll.id,
    'status', v_poll.status,
    'total_votes', (select count(*) from poll_votes where poll_id = p_poll_id),
    'my_vote', (select option_id from poll_votes where poll_id = p_poll_id and user_id = auth.uid()),
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id,
        'label', o.label,
        'votes', (select count(*) from poll_votes v where v.option_id = o.id)
      ) order by o.position), '[]'::jsonb)
      from poll_options o where o.poll_id = p_poll_id
    )
  );
end;
$$;

-- Committee marks a fee period as paid for an apartment; creates the matching income entry.
create function public.mark_fee_paid(
  p_building_id uuid,
  p_apartment_id uuid,
  p_period text,
  p_amount numeric default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_amount numeric;
  v_apartment_number text;
begin
  if not public.is_committee(p_building_id) then
    raise exception 'not authorized';
  end if;
  select number into v_apartment_number from apartments
  where id = p_apartment_id and building_id = p_building_id;
  if not found then
    raise exception 'apartment does not belong to this building';
  end if;

  v_amount := coalesce(p_amount, (select fee_amount from buildings where id = p_building_id));

  insert into fee_payments (building_id, apartment_id, period, amount, marked_by)
  values (p_building_id, p_apartment_id, p_period, v_amount, auth.uid())
  on conflict (building_id, apartment_id, period) do nothing;

  if found then
    insert into budget_entries (building_id, kind, category, title, amount, created_by)
    values (p_building_id, 'income', 'fee', 'Fee ' || p_period || ' · apt ' || v_apartment_number, v_amount, auth.uid());
  end if;
end;
$$;

-- ============================================================
-- Realtime (no-op on plain Postgres)
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.poll_votes;
    alter publication supabase_realtime add table public.polls;
  end if;
end $$;
