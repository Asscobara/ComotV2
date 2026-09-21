-- ComOt — self-service account deletion.
--
-- App Store review guideline 5.1.1(v) requires that an app which lets people
-- create an account also lets them delete it from inside the app, not only by
-- writing to support. This is the server side of that.

-- ============================================================
-- Can the caller delete their account, and what would it cost them?
-- Read-only, so the UI can warn before anything is destroyed.
-- ============================================================

create function public.account_deletion_preview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  return jsonb_build_object(
    -- Buildings that would be left with nobody able to run them.
    'blocking_buildings', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name))
      from memberships m
      join buildings b on b.id = m.building_id
      where m.user_id = v_uid and m.status = 'active' and m.role = 'committee'
        and exists (
          select 1 from memberships o
          where o.building_id = m.building_id and o.status = 'active' and o.user_id <> v_uid
        )
        and not exists (
          select 1 from memberships o
          where o.building_id = m.building_id and o.status = 'active'
            and o.role = 'committee' and o.user_id <> v_uid
        )
    ), '[]'::jsonb),
    -- Buildings the caller is the last member of, which are deleted with them.
    'buildings_removed', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name))
      from memberships m
      join buildings b on b.id = m.building_id
      where m.user_id = v_uid and m.status = 'active'
        and not exists (
          select 1 from memberships o
          where o.building_id = m.building_id and o.status = 'active' and o.user_id <> v_uid
        )
    ), '[]'::jsonb),
    'is_vendor', exists (select 1 from vendors where user_id = v_uid)
  );
end;
$$;

-- ============================================================
-- Delete the caller's own account
-- ============================================================

create function public.delete_own_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_blocked text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- A building must never be left with members but no committee: nobody could
  -- approve tenants, record payments or close faults. Refuse until the role is
  -- handed over. Checked for every building before anything is deleted, so the
  -- caller gets the same answer whatever order their memberships are in.
  select string_agg(b.name, ', ') into v_blocked
  from memberships m
  join buildings b on b.id = m.building_id
  where m.user_id = v_uid and m.status = 'active' and m.role = 'committee'
    and exists (
      select 1 from memberships o
      where o.building_id = m.building_id and o.status = 'active' and o.user_id <> v_uid
    )
    and not exists (
      select 1 from memberships o
      where o.building_id = m.building_id and o.status = 'active'
        and o.role = 'committee' and o.user_id <> v_uid
    );

  if v_blocked is not null then
    raise exception 'committee_handover_required: %', v_blocked;
  end if;

  -- Where the caller is the last active member, the building has no one left to
  -- belong to, so it goes with them rather than lingering as an orphan.
  delete from buildings b
  where exists (
    select 1 from memberships m
    where m.building_id = b.id and m.user_id = v_uid and m.status = 'active'
  )
  and not exists (
    select 1 from memberships o
    where o.building_id = b.id and o.status = 'active' and o.user_id <> v_uid
  );

  -- profiles.id references auth.users on delete cascade, and every table
  -- referencing profiles is CASCADE or SET NULL, so one delete removes the
  -- account together with its memberships, messages, faults, votes, vendor
  -- profile and notifications.
  --
  -- This also drops the rows in auth.sessions, which invalidates refresh tokens.
  -- An access token already issued stays valid until it expires, so the client
  -- signs out immediately after calling this.
  delete from auth.users where id = v_uid;
end;
$$;
