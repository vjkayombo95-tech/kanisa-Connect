-- RC-1.3.4 Transactional Member Creation
-- Creates a member and related family/community/ministry records atomically.

create or replace function public.create_member_with_relations(
  p_church_id uuid,
  p_full_name text,
  p_email text default null,
  p_phone text default null,
  p_gender text default null,
  p_date_of_birth date default null,
  p_is_married boolean default false,
  p_family_name text default null,
  p_spouse_name text default null,
  p_wedding_date date default null,
  p_primary_family_role text default null,
  p_spouse_family_role text default null,
  p_family_members jsonb default '[]'::jsonb,
  p_community_ids uuid[] default array[]::uuid[],
  p_ministry_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_full_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_gender text := nullif(trim(coalesce(p_gender, '')), '');
  v_family_name text := nullif(trim(coalesce(p_family_name, '')), '');
  v_spouse_name text := nullif(trim(coalesce(p_spouse_name, '')), '');
  v_member_id uuid;
  v_family_id uuid;
  v_plan text := 'free';
  v_status text := 'active';
  v_member_limit integer := 50;
  v_current_count integer := 0;
  v_pending_count integer := 1;
  v_family_member jsonb;
  v_family_member_name text;
  v_family_member_gender text;
  v_family_member_dob date;
  v_family_member_role text;
begin
  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_church_id is null then
    raise exception 'Church context is required'
      using errcode = '22023';
  end if;

  if not public.can_manage_church_workspace(v_actor_id, p_church_id) then
    raise exception 'You do not have permission to manage members for this church'
      using errcode = '42501';
  end if;

  if v_full_name is null then
    raise exception 'Full name is required'
      using errcode = '22023';
  end if;

  if v_gender is not null and v_gender not in ('male', 'female') then
    raise exception 'Invalid gender'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_family_members, '[]'::jsonb)) <> 'array' then
    raise exception 'Family members must be an array'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('create_member_with_relations:' || p_church_id::text, 0));

  select s.plan, s.status
  into v_plan, v_status
  from public.subscriptions s
  where s.church_id = p_church_id
    and s.status in ('active', 'trial')
  order by s.started_at desc
  limit 1;

  v_plan := coalesce(v_plan, 'free');
  v_status := coalesce(v_status, 'active');

  v_member_limit := case
    when v_status = 'trial' then null
    when v_plan = 'free' then 50
    when v_plan = 'basic' then 150
    else null
  end;

  v_pending_count := v_pending_count
    + case when p_is_married and v_spouse_name is not null then 1 else 0 end
    + (
      select count(*)::integer
      from jsonb_array_elements(coalesce(p_family_members, '[]'::jsonb)) item
      where nullif(trim(coalesce(item->>'full_name', '')), '') is not null
    );

  if v_member_limit is not null then
    select count(*)::integer
    into v_current_count
    from public.members m
    where m.church_id = p_church_id;

    if v_current_count + v_pending_count > v_member_limit then
      raise exception 'You have reached your member limit. Upgrade your plan to add more members.'
        using errcode = '23514';
    end if;
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_community_ids, array[]::uuid[])) community_id
    where not exists (
      select 1
      from public.communities c
      where c.id = community_id
        and c.church_id = p_church_id
    )
  ) then
    raise exception 'One or more selected communities do not belong to this church'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_ministry_ids, array[]::uuid[])) ministry_id
    where not exists (
      select 1
      from public.ministries m
      where m.id = ministry_id
        and m.church_id = p_church_id
    )
  ) then
    raise exception 'One or more selected ministries do not belong to this church'
      using errcode = '42501';
  end if;

  insert into public.members (
    full_name,
    email,
    phone,
    gender,
    date_of_birth,
    church_id,
    status
  )
  values (
    v_full_name,
    v_email,
    v_phone,
    v_gender,
    p_date_of_birth,
    p_church_id,
    'active'
  )
  returning id into v_member_id;

  if p_is_married or v_pending_count > 1 then
    insert into public.families (church_id, name)
    values (p_church_id, coalesce(v_family_name, v_full_name || ' Family'))
    returning id into v_family_id;

    update public.members
    set family_id = v_family_id,
        family_role = coalesce(nullif(trim(coalesce(p_primary_family_role, '')), ''), 'guardian'),
        wedding_date = case when p_is_married then p_wedding_date else null end,
        spouse_name = case when p_is_married then v_spouse_name else null end
    where id = v_member_id;

    if p_is_married and v_spouse_name is not null then
      insert into public.members (
        full_name,
        church_id,
        family_id,
        family_role,
        wedding_date,
        spouse_name,
        status
      )
      values (
        v_spouse_name,
        p_church_id,
        v_family_id,
        coalesce(nullif(trim(coalesce(p_spouse_family_role, '')), ''), 'guardian'),
        p_wedding_date,
        v_full_name,
        'active'
      );
    end if;

    for v_family_member in
      select value from jsonb_array_elements(coalesce(p_family_members, '[]'::jsonb))
    loop
      v_family_member_name := nullif(trim(coalesce(v_family_member->>'full_name', '')), '');

      if v_family_member_name is null then
        continue;
      end if;

      v_family_member_gender := nullif(trim(coalesce(v_family_member->>'gender', '')), '');
      if v_family_member_gender is not null and v_family_member_gender not in ('male', 'female') then
        raise exception 'Invalid family member gender'
          using errcode = '22023';
      end if;

      v_family_member_dob := nullif(trim(coalesce(v_family_member->>'date_of_birth', '')), '')::date;
      v_family_member_role := coalesce(nullif(trim(coalesce(v_family_member->>'role', '')), ''), 'other');

      insert into public.members (
        full_name,
        church_id,
        status,
        gender,
        date_of_birth,
        family_id,
        family_role
      )
      values (
        v_family_member_name,
        p_church_id,
        'active',
        v_family_member_gender,
        v_family_member_dob,
        v_family_id,
        v_family_member_role
      );
    end loop;
  end if;

  insert into public.member_communities (community_id, member_id)
  select distinct community_id, v_member_id
  from unnest(coalesce(p_community_ids, array[]::uuid[])) community_id
  on conflict do nothing;

  insert into public.member_ministries (ministry_id, member_id)
  select distinct ministry_id, v_member_id
  from unnest(coalesce(p_ministry_ids, array[]::uuid[])) ministry_id
  on conflict do nothing;

  return jsonb_build_object(
    'success', true,
    'member_id', v_member_id,
    'family_id', v_family_id,
    'created_count', v_pending_count
  );
end;
$$;

grant execute on function public.create_member_with_relations(
  uuid,
  text,
  text,
  text,
  text,
  date,
  boolean,
  text,
  text,
  date,
  text,
  text,
  jsonb,
  uuid[],
  uuid[]
) to authenticated;
