-- ComOt — Phase 3b schema: vendor marketplace, automatic matching, fault bookings.

-- ============================================================
-- Vendors (global marketplace — vendors register cross-building)
-- ============================================================

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  business_name text not null check (length(trim(business_name)) between 2 and 120),
  categories text[] not null check (
    array_length(categories, 1) >= 1
    and categories <@ array['plumbing','electricity','gardening','elevator','cleaning','roofing','general']::text[]
  ),
  city text not null check (length(trim(city)) between 2 and 80),
  phone text,
  about text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vendors_city_idx on public.vendors (city);
create index vendors_categories_idx on public.vendors using gin (categories);

create trigger vendors_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();

-- committee's per-building vendor book
create table public.building_vendors (
  building_id uuid not null references public.buildings (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  preferred boolean not null default false,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (building_id, vendor_id)
);

-- a vendor booked for a specific fault; carries snapshots so the vendor
-- never needs (and never gets) access to the building's fault table
create table public.fault_bookings (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null references public.faults (id) on delete cascade,
  building_id uuid not null references public.buildings (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  status text not null default 'booked' check (status in ('booked', 'accepted', 'declined', 'done')),
  fault_title text not null,
  fault_category text not null,
  city text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- at most one live booking per fault
create unique index fault_bookings_open_idx on public.fault_bookings (fault_id)
  where status in ('booked', 'accepted');

create index fault_bookings_vendor_idx on public.fault_bookings (vendor_id, created_at desc);

create trigger fault_bookings_updated_at before update on public.fault_bookings
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.vendors enable row level security;
alter table public.building_vendors enable row level security;
alter table public.fault_bookings enable row level security;

-- marketplace is visible to any signed-in user; vendors manage their own profile
create policy vendors_select on public.vendors for select
  using (auth.uid() is not null);
create policy vendors_insert on public.vendors for insert
  with check (user_id = auth.uid());
create policy vendors_update on public.vendors for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy building_vendors_select on public.building_vendors for select
  using (public.is_active_member(building_id));
create policy building_vendors_insert on public.building_vendors for insert
  with check (public.is_committee(building_id));
create policy building_vendors_update on public.building_vendors for update
  using (public.is_committee(building_id)) with check (public.is_committee(building_id));
create policy building_vendors_delete on public.building_vendors for delete
  using (public.is_committee(building_id));

-- bookings: building members see their building's bookings; the vendor sees their own
create policy fault_bookings_select on public.fault_bookings for select
  using (
    public.is_active_member(building_id)
    or exists (select 1 from public.vendors v where v.id = vendor_id and v.user_id = auth.uid())
  );
-- writes go through the RPCs below

-- ============================================================
-- RPCs
-- ============================================================

-- Matching: active vendors for the fault's category, preferred & local first.
create function public.match_vendors(p_fault_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_fault faults%rowtype;
  v_city text;
begin
  select * into v_fault from faults where id = p_fault_id;
  if not found or not public.is_active_member(v_fault.building_id) then
    raise exception 'not authorized';
  end if;
  select city into v_city from buildings where id = v_fault.building_id;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'vendor_id', v.id,
      'business_name', v.business_name,
      'categories', to_jsonb(v.categories),
      'city', v.city,
      'phone', v.phone,
      'about', v.about,
      'same_city', (lower(v.city) = lower(v_city)),
      'in_book', (bv.vendor_id is not null),
      'preferred', coalesce(bv.preferred, false)
    ) order by coalesce(bv.preferred, false) desc, (bv.vendor_id is not null) desc,
               (lower(v.city) = lower(v_city)) desc, v.business_name)
    from vendors v
    left join building_vendors bv
      on bv.vendor_id = v.id and bv.building_id = v_fault.building_id
    where v.is_active and v.categories @> array[v_fault.category]
  ), '[]'::jsonb);
end;
$$;

-- Committee books a vendor for a fault; audited on the fault timeline.
create function public.book_vendor(p_fault_id uuid, p_vendor_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_fault faults%rowtype;
  v_vendor vendors%rowtype;
  v_city text;
  v_booking_id uuid;
begin
  select * into v_fault from faults where id = p_fault_id;
  if not found or not public.is_committee(v_fault.building_id) then
    raise exception 'not authorized';
  end if;
  select * into v_vendor from vendors where id = p_vendor_id and is_active;
  if not found then
    raise exception 'vendor not found';
  end if;
  select city into v_city from buildings where id = v_fault.building_id;

  insert into fault_bookings (fault_id, building_id, vendor_id, fault_title, fault_category, city, created_by)
  values (p_fault_id, v_fault.building_id, p_vendor_id, v_fault.title, v_fault.category, v_city, auth.uid())
  returning id into v_booking_id;

  update faults set status = 'in_progress', resolved_at = null where id = p_fault_id;
  insert into fault_updates (fault_id, building_id, author_id, status, note)
  values (p_fault_id, v_fault.building_id, auth.uid(), 'in_progress', 'Booked: ' || v_vendor.business_name);

  return v_booking_id;
end;
$$;

-- The vendor accepts or declines a booking.
create function public.respond_booking(p_booking_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_booking fault_bookings%rowtype;
  v_vendor vendors%rowtype;
begin
  select b.* into v_booking from fault_bookings b
  join vendors v on v.id = b.vendor_id
  where b.id = p_booking_id and v.user_id = auth.uid() and b.status = 'booked';
  if not found then
    raise exception 'booking not found or not addressed to you';
  end if;
  select * into v_vendor from vendors where id = v_booking.vendor_id;

  update fault_bookings
  set status = case when p_accept then 'accepted' else 'declined' end
  where id = p_booking_id;

  insert into fault_updates (fault_id, building_id, author_id, note)
  values (
    v_booking.fault_id, v_booking.building_id, auth.uid(),
    v_vendor.business_name || ': ' || case when p_accept then 'accepted the job' else 'declined the job' end
  );
end;
$$;
