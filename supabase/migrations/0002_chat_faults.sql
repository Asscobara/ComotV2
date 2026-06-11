-- ComOt — Phase 2 schema: internal chat (building channels + DMs) and fault reporting.

-- ============================================================
-- Chat
-- ============================================================

create type public.conversation_kind as enum ('channel', 'dm');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  kind public.conversation_kind not null,
  name text, -- channel name; null for DMs
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (building_id, kind, name)
);

-- participants are tracked for DMs only; channels are open to all active building members
create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  building_id uuid not null references public.buildings (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index conversations_building_idx on public.conversations (building_id);
create index conversation_members_user_idx on public.conversation_members (user_id);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- ============================================================
-- Faults
-- ============================================================

create type public.fault_status as enum ('reported', 'in_progress', 'resolved', 'closed');

create table public.faults (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (
    category in ('plumbing', 'electricity', 'gardening', 'elevator', 'cleaning', 'roofing', 'general')
  ),
  title text not null check (length(trim(title)) between 2 and 120),
  description text,
  location text,
  photo_url text,
  status public.fault_status not null default 'reported',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- status history / discussion timeline
create table public.fault_updates (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null references public.faults (id) on delete cascade,
  building_id uuid not null references public.buildings (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  status public.fault_status, -- null for plain notes
  note text,
  created_at timestamptz not null default now()
);

create index faults_building_idx on public.faults (building_id, status);
create index fault_updates_fault_idx on public.fault_updates (fault_id, created_at);

create trigger faults_updated_at before update on public.faults
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS helpers
-- ============================================================

create function public.can_access_conversation(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from conversations conv
    where conv.id = c
      and public.is_active_member(conv.building_id)
      and (
        conv.kind = 'channel'
        or exists (
          select 1 from conversation_members cm
          where cm.conversation_id = conv.id and cm.user_id = auth.uid()
        )
      )
  );
$$;

-- ============================================================
-- RLS
-- ============================================================

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.faults enable row level security;
alter table public.fault_updates enable row level security;

create policy conversations_select on public.conversations for select
  using (public.can_access_conversation(id));
-- channels are created by the committee; DMs go through the get_or_create_dm RPC
create policy conversations_insert on public.conversations for insert
  with check (kind = 'channel' and public.is_committee(building_id));
create policy conversations_delete on public.conversations for delete
  using (kind = 'channel' and name <> 'general' and public.is_committee(building_id));

create policy conversation_members_select on public.conversation_members for select
  using (user_id = auth.uid() or public.can_access_conversation(conversation_id));

create policy messages_select on public.messages for select
  using (public.can_access_conversation(conversation_id));
create policy messages_insert on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_active_member(building_id)
    and public.can_access_conversation(conversation_id)
    and building_id = (select building_id from public.conversations where id = conversation_id)
  );

create policy faults_select on public.faults for select
  using (public.is_active_member(building_id));
create policy faults_insert on public.faults for insert
  with check (reporter_id = auth.uid() and public.is_active_member(building_id));
-- status changes go through the update_fault_status RPC (committee-only, audited)

create policy fault_updates_select on public.fault_updates for select
  using (public.is_active_member(building_id));
create policy fault_updates_insert on public.fault_updates for insert
  with check (
    author_id = auth.uid()
    and public.is_active_member(building_id)
    and status is null -- plain notes only; status rows are written by the RPC
    and building_id = (select building_id from public.faults where id = fault_id)
  );

-- ============================================================
-- RPCs
-- ============================================================

-- Open (or return the existing) DM between the caller and another active member of the same building.
create function public.get_or_create_dm(p_building_id uuid, p_other_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_conversation uuid;
begin
  if not public.is_active_member(p_building_id) then
    raise exception 'not a member of this building';
  end if;
  if p_other_user = auth.uid() then
    raise exception 'cannot open a DM with yourself';
  end if;
  if not exists (
    select 1 from memberships
    where building_id = p_building_id and user_id = p_other_user and status = 'active'
  ) then
    raise exception 'other user is not an active member of this building';
  end if;

  select cm1.conversation_id into v_conversation
  from conversation_members cm1
  join conversation_members cm2 on cm2.conversation_id = cm1.conversation_id
  join conversations c on c.id = cm1.conversation_id
  where cm1.user_id = auth.uid() and cm2.user_id = p_other_user
    and c.kind = 'dm' and c.building_id = p_building_id
  limit 1;

  if v_conversation is not null then
    return v_conversation;
  end if;

  insert into conversations (building_id, kind, created_by)
  values (p_building_id, 'dm', auth.uid())
  returning id into v_conversation;

  insert into conversation_members (conversation_id, user_id)
  values (v_conversation, auth.uid()), (v_conversation, p_other_user);

  return v_conversation;
end;
$$;

-- Committee changes a fault's status; every change is recorded on the timeline.
create function public.update_fault_status(
  p_fault_id uuid,
  p_status public.fault_status,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_building uuid;
begin
  select building_id into v_building from faults where id = p_fault_id;
  if not found or not public.is_committee(v_building) then
    raise exception 'not authorized';
  end if;

  update faults
  set status = p_status,
      resolved_at = case when p_status in ('resolved', 'closed') then now() else null end
  where id = p_fault_id;

  insert into fault_updates (fault_id, building_id, author_id, status, note)
  values (p_fault_id, v_building, auth.uid(), p_status, p_note);
end;
$$;

-- ============================================================
-- Default #general channel: for new buildings and backfill for existing ones
-- ============================================================

create or replace function public.create_building(
  p_name text,
  p_address text,
  p_city text,
  p_floors int,
  p_apartments_count int,
  p_fee_amount numeric default 0,
  p_fee_due_day int default 1,
  p_fee_frequency text default 'monthly'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_building_id uuid;
  v_apartment int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into buildings (name, address, city, floors, apartments_count, fee_amount, fee_due_day, fee_frequency, created_by)
  values (
    coalesce(nullif(trim(p_name), ''), trim(p_address)),
    trim(p_address), trim(p_city),
    p_floors, p_apartments_count, p_fee_amount, p_fee_due_day, p_fee_frequency,
    auth.uid()
  )
  returning id into v_building_id;

  for v_apartment in 1..p_apartments_count loop
    insert into apartments (building_id, number, floor)
    values (
      v_building_id,
      v_apartment::text,
      least(((v_apartment - 1) * p_floors / p_apartments_count) + 1, p_floors)
    );
  end loop;

  insert into memberships (building_id, user_id, role, status)
  values (v_building_id, auth.uid(), 'committee', 'active');

  insert into conversations (building_id, kind, name, created_by)
  values (v_building_id, 'channel', 'general', auth.uid());

  return v_building_id;
end;
$$;

insert into public.conversations (building_id, kind, name, created_by)
select b.id, 'channel', 'general', b.created_by
from public.buildings b
where not exists (
  select 1 from public.conversations c
  where c.building_id = b.id and c.kind = 'channel' and c.name = 'general'
);

-- ============================================================
-- Realtime (no-op on plain Postgres without the supabase_realtime publication)
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.faults;
    alter publication supabase_realtime add table public.fault_updates;
  end if;
end $$;
