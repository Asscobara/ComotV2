-- ComOt — Phase 1 schema: profiles, buildings, apartments, memberships, committee handover.
-- Multi-tenancy: every building-scoped table carries building_id and is protected by RLS.

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  email text,
  avatar_url text,
  preferred_language text not null default 'he' check (preferred_language in ('he', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  floors int not null check (floors between 1 and 200),
  apartments_count int not null check (apartments_count between 1 and 1000),
  notes text,
  invite_code text not null unique default encode(gen_random_bytes(4), 'hex'),
  fee_amount numeric(10, 2) not null default 0 check (fee_amount >= 0),
  fee_due_day int not null default 1 check (fee_due_day between 1 and 28),
  fee_frequency text not null default 'monthly'
    check (fee_frequency in ('monthly', 'bimonthly', 'quarterly', 'yearly')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.apartments (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  number text not null,
  floor int not null default 1,
  unique (building_id, number)
);

create type public.membership_role as enum ('committee', 'tenant');
create type public.tenant_type as enum ('owner', 'renter');
create type public.membership_status as enum ('pending', 'active', 'rejected', 'removed');

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  apartment_id uuid references public.apartments (id) on delete set null,
  role public.membership_role not null default 'tenant',
  tenant_type public.tenant_type not null default 'owner',
  status public.membership_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, user_id)
);

create table public.committee_handovers (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index memberships_building_idx on public.memberships (building_id);
create index memberships_user_idx on public.memberships (user_id);
create index apartments_building_idx on public.apartments (building_id);
create index handovers_building_idx on public.committee_handovers (building_id);
create index handovers_to_user_idx on public.committee_handovers (to_user_id);

-- ============================================================
-- updated_at maintenance
-- ============================================================

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger buildings_updated_at before update on public.buildings
  for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();

-- ============================================================
-- Profile auto-creation on signup (email or social login)
-- ============================================================

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS helper functions (security definer to avoid policy recursion)
-- ============================================================

create function public.is_member(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.building_id = b and m.user_id = auth.uid() and m.status in ('pending', 'active')
  );
$$;

create function public.is_active_member(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.building_id = b and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create function public.is_committee(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.building_id = b and m.user_id = auth.uid()
      and m.status = 'active' and m.role = 'committee'
  );
$$;

create function public.shares_building_with(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from memberships viewer
    join memberships other on other.building_id = viewer.building_id
    where viewer.user_id = auth.uid() and viewer.status = 'active'
      and other.user_id = target
  );
$$;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.buildings enable row level security;
alter table public.apartments enable row level security;
alter table public.memberships enable row level security;
alter table public.committee_handovers enable row level security;

-- profiles: self, or anyone you share a building with (committee must see pending applicants)
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_building_with(id));
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- buildings: members (incl. pending, who need the building name) read; committee updates
create policy buildings_select on public.buildings for select
  using (public.is_member(id));
create policy buildings_update on public.buildings for update
  using (public.is_committee(id)) with check (public.is_committee(id));

-- apartments: members read; committee manages
create policy apartments_select on public.apartments for select
  using (public.is_member(building_id));
create policy apartments_insert on public.apartments for insert
  with check (public.is_committee(building_id));
create policy apartments_update on public.apartments for update
  using (public.is_committee(building_id)) with check (public.is_committee(building_id));
create policy apartments_delete on public.apartments for delete
  using (public.is_committee(building_id));

-- memberships: own rows + active members of the same building read;
-- committee updates (approve/reject/edit/remove); joining happens via RPCs below
create policy memberships_select on public.memberships for select
  using (user_id = auth.uid() or public.is_active_member(building_id));
create policy memberships_update on public.memberships for update
  using (public.is_committee(building_id)) with check (public.is_committee(building_id));
create policy memberships_delete on public.memberships for delete
  using (public.is_committee(building_id) or user_id = auth.uid());

-- handovers: involved parties + committee read
create policy handovers_select on public.committee_handovers for select
  using (
    from_user_id = auth.uid() or to_user_id = auth.uid() or public.is_committee(building_id)
  );

-- ============================================================
-- RPCs (security definer; all inputs re-validated server-side)
-- ============================================================

-- Committee member sets up a building; apartments are auto-generated; creator becomes committee.
create function public.create_building(
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

  return v_building_id;
end;
$$;

-- Lookup used by the tenant join flow (runs before the user is a member).
create function public.get_building_by_invite_code(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_building buildings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_building from buildings where invite_code = lower(trim(p_code));
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'building', jsonb_build_object(
      'id', v_building.id,
      'name', v_building.name,
      'address', v_building.address,
      'city', v_building.city,
      'floors', v_building.floors,
      'apartments_count', v_building.apartments_count
    ),
    'apartments', (
      select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'number', a.number, 'floor', a.floor) order by a.floor, length(a.number), a.number), '[]'::jsonb)
      from apartments a where a.building_id = v_building.id
    )
  );
end;
$$;

-- Tenant requests to join a building; lands in 'pending' until the committee approves.
create function public.join_building(
  p_invite_code text,
  p_apartment_id uuid,
  p_tenant_type public.tenant_type default 'owner'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_building_id uuid;
  v_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into v_building_id from buildings where invite_code = lower(trim(p_invite_code));
  if not found then
    raise exception 'building not found';
  end if;

  if p_apartment_id is not null and not exists (
    select 1 from apartments where id = p_apartment_id and building_id = v_building_id
  ) then
    raise exception 'apartment does not belong to this building';
  end if;

  if exists (
    select 1 from memberships
    where building_id = v_building_id and user_id = auth.uid() and status in ('pending', 'active')
  ) then
    raise exception 'already a member or pending approval';
  end if;

  -- re-applying after rejection/removal replaces the old record
  delete from memberships where building_id = v_building_id and user_id = auth.uid();

  insert into memberships (building_id, user_id, apartment_id, tenant_type, status)
  values (v_building_id, auth.uid(), p_apartment_id, p_tenant_type, 'pending')
  returning id into v_membership_id;

  return v_membership_id;
end;
$$;

-- Committee approves or rejects a pending member.
create function public.approve_member(p_membership_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_building_id uuid;
begin
  select building_id into v_building_id from memberships where id = p_membership_id;
  if not found or not public.is_committee(v_building_id) then
    raise exception 'not authorized';
  end if;

  update memberships
  set status = case when p_approve then 'active'::membership_status else 'rejected'::membership_status end
  where id = p_membership_id and status = 'pending';
end;
$$;

-- Outgoing committee member nominates a successor.
create function public.request_handover(p_building_id uuid, p_to_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_handover_id uuid;
begin
  if not public.is_committee(p_building_id) then
    raise exception 'not authorized';
  end if;
  if not exists (
    select 1 from memberships
    where building_id = p_building_id and user_id = p_to_user and status = 'active'
  ) then
    raise exception 'successor must be an active member of the building';
  end if;
  if p_to_user = auth.uid() then
    raise exception 'cannot hand over to yourself';
  end if;

  -- only one open handover per building
  update committee_handovers set status = 'cancelled', resolved_at = now()
  where building_id = p_building_id and status = 'pending';

  insert into committee_handovers (building_id, from_user_id, to_user_id)
  values (p_building_id, auth.uid(), p_to_user)
  returning id into v_handover_id;

  return v_handover_id;
end;
$$;

-- Successor explicitly confirms (or declines); the role transfers only on confirmation.
create function public.respond_handover(p_handover_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_handover committee_handovers%rowtype;
begin
  select * into v_handover from committee_handovers
  where id = p_handover_id and status = 'pending' and to_user_id = auth.uid();
  if not found then
    raise exception 'handover not found or not addressed to you';
  end if;

  if p_accept then
    update memberships set role = 'committee'
    where building_id = v_handover.building_id and user_id = v_handover.to_user_id and status = 'active';
    update memberships set role = 'tenant'
    where building_id = v_handover.building_id and user_id = v_handover.from_user_id;
    update committee_handovers set status = 'confirmed', resolved_at = now() where id = p_handover_id;
  else
    update committee_handovers set status = 'declined', resolved_at = now() where id = p_handover_id;
  end if;
end;
$$;
