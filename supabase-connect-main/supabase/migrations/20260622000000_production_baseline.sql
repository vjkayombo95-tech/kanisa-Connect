--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: accept_invitation(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_invitation(_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _invitation public.invitations%rowtype;
  _member_id uuid;
  _linked_user_id uuid;
  _user_id uuid := auth.uid();
  _user_email text := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  _member_name text;
  _role text;
begin
  if _user_id is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  select i.* into _invitation
  from public.invitations i
  where i.token = _token
  limit 1;

  if _invitation.id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid invitation token');
  end if;

  if coalesce(_invitation.status, 'pending') = 'accepted' then
    return jsonb_build_object('success', false, 'error', 'This invitation has already been accepted');
  end if;

  if _invitation.status = 'revoked' then
    return jsonb_build_object('success', false, 'error', 'This invitation has been revoked');
  end if;

  if _invitation.expires_at is not null and _invitation.expires_at < now() then
    update public.invitations set status = 'expired' where id = _invitation.id;
    return jsonb_build_object('success', false, 'error', 'This invitation has expired');
  end if;

  if _user_email is null
    or _invitation.email is null
    or _user_email <> lower(trim(_invitation.email)) then
    return jsonb_build_object(
      'success', false,
      'error', format('Please sign in as %s to accept this invitation', coalesce(_invitation.email, 'the invited email'))
    );
  end if;

  select m.id, m.user_id into _member_id, _linked_user_id
  from public.members m
  where m.church_id = _invitation.church_id
    and lower(trim(coalesce(m.email, ''))) = _user_email
  order by m.created_at
  limit 1;

  if _member_id is not null and _linked_user_id is not null and _linked_user_id <> _user_id then
    return jsonb_build_object('success', false, 'error', 'This invitation has already been linked to another account');
  end if;

  if _member_id is null then
    _member_name := coalesce(
      nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
      split_part(_user_email, '@', 1),
      'Member'
    );

    insert into public.members (full_name, email, church_id, user_id, status)
    values (_member_name, _user_email, _invitation.church_id, _user_id, 'active')
    returning id into _member_id;
  else
    update public.members
    set user_id = _user_id,
        status = 'active'
    where id = _member_id;
  end if;

  _role := coalesce(nullif(trim(_invitation.role), ''), 'member');

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.church_id = _invitation.church_id
  ) then
    update public.user_roles
    set role = _role
    where user_id = _user_id
      and church_id = _invitation.church_id;
  else
    insert into public.user_roles (user_id, church_id, role)
    values (_user_id, _invitation.church_id, _role);
  end if;

  update public.invitations
  set status = 'accepted'
  where id = _invitation.id;

  return jsonb_build_object(
    'success', true,
    'church_id', _invitation.church_id,
    'church_name', (select c.name from public.churches c where c.id = _invitation.church_id),
    'member_id', _member_id,
    'role', _role
  );
end;
$$;


--
-- Name: assign_default_member_role(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_default_member_role(_church_id uuid, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO church_staff (church_id, role, name)
  VALUES (_church_id, 'member', _name);
END;
$$;


--
-- Name: assign_default_member_role(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_default_member_role(_user_id uuid, _church_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if _user_id is null or _church_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and church_id = _church_id
  ) then
    insert into public.user_roles (user_id, church_id, role)
    values (_user_id, _church_id, 'member');
  end if;
end;
$$;


--
-- Name: can_manage_chat_channel(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_chat_channel(target_channel_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.chat_channels c
    where c.id = target_channel_id
      and (
        c.created_by = auth.uid()
        or public.is_chat_admin_for_church(c.church_id)
        or (
          c.community_id is not null
          and public.is_current_user_community_leader_for(c.community_id, c.church_id)
        )
      )
  );
$$;


--
-- Name: can_manage_church_workspace(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_church_workspace(_user_id uuid, _church_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select _user_id is not null
    and _church_id is not null
    and (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = _user_id
          and ur.church_id = _church_id
          and lower(coalesce(ur.role, '')) in ('church_admin', 'admin', 'pastor', 'secretary', 'treasurer')
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = _user_id
          and p.church_id = _church_id
          and lower(coalesce(p.role, '')) in ('church_admin', 'admin', 'pastor', 'secretary', 'treasurer')
      )
      or exists (
        select 1
        from public.churches c
        where c.id = _church_id
          and (_user_id = c.owner_id or _user_id = c.created_by)
      )
      or exists (
        select 1
        from public.super_admins sa
        where sa.id = _user_id
      )
    );
$$;


--
-- Name: can_review_pastoral_requests(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_review_pastoral_requests(p_church_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p_church_id is not null and (
    public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = p_church_id
        and ur.role in ('church_admin', 'pastor')
    )
    or exists (
      select 1 from public.churches c
      where c.id = p_church_id and c.created_by = auth.uid()
    )
  );
$$;


--
-- Name: can_view_chat_channel(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_chat_channel(target_channel_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.chat_channels c
    where c.id = target_channel_id
      and (
        c.created_by = auth.uid()
        or public.is_chat_admin_for_church(c.church_id)
        or (
          c.community_id is not null
          and public.is_current_user_community_leader_for(c.community_id, c.church_id)
        )
        or exists (
          select 1
          from public.chat_channel_members m
          where m.channel_id = c.id
            and m.user_id = auth.uid()
        )
      )
  );
$$;


--
-- Name: can_view_church_billing(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_church_billing(_user_id uuid, _church_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select _user_id is not null
    and _church_id is not null
    and (
      public.is_platform_super_admin(_user_id)
      or public.can_manage_church_workspace(_user_id, _church_id)
      or exists (
        select 1
        from public.user_roles ur
        where ur.user_id = _user_id
          and ur.church_id = _church_id
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = _user_id
          and p.church_id = _church_id
      )
      or exists (
        select 1
        from public.members m
        where m.user_id = _user_id
          and m.church_id = _church_id
      )
    );
$$;


--
-- Name: can_view_church_workspace(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_church_workspace(_user_id uuid, _church_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.can_manage_church_workspace(_user_id, _church_id)
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = _user_id
        and ur.church_id = _church_id
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = _user_id
        and p.church_id = _church_id
    );
$$;


--
-- Name: complete_public_registration(uuid, text, text, text, text, text, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_public_registration(_church_id uuid, _full_name text, _email text, _phone text, _gender text, _photo_url text, _community_id uuid DEFAULT NULL::uuid, _ministry_ids uuid[] DEFAULT ARRAY[]::uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _member_id uuid;
  _church_name text;
  _normalized_email text;
  has_community_members_table boolean;
  has_member_communities_table boolean;
  has_ministry_members_table boolean;
  has_member_ministries_table boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  _normalized_email := lower(trim(coalesce(_email, '')));

  if _church_id is null or coalesce(trim(_full_name), '') = '' or _normalized_email = '' then
    return jsonb_build_object('success', false, 'error', 'Missing required registration fields');
  end if;

  select name into _church_name
  from public.churches
  where id = _church_id;

  if _church_name is null then
    return jsonb_build_object('success', false, 'error', 'Church not found');
  end if;

  if exists (
    select 1
    from public.members
    where church_id = _church_id
      and lower(coalesce(email, '')) = _normalized_email
  ) then
    return jsonb_build_object('success', false, 'error', 'A member with this email already exists for this church');
  end if;

  insert into public.members (
    full_name,
    email,
    phone,
    gender,
    photo_url,
    church_id,
    user_id,
    status
  )
  values (
    trim(_full_name),
    _normalized_email,
    nullif(trim(coalesce(_phone, '')), ''),
    nullif(trim(coalesce(_gender, '')), ''),
    nullif(trim(coalesce(_photo_url, '')), ''),
    _church_id,
    auth.uid(),
    'active'
  )
  returning id into _member_id;

  select to_regclass('public.community_members') is not null into has_community_members_table;
  select to_regclass('public.member_communities') is not null into has_member_communities_table;
  select to_regclass('public.ministry_members') is not null into has_ministry_members_table;
  select to_regclass('public.member_ministries') is not null into has_member_ministries_table;

  if _community_id is not null then
    if has_community_members_table then
      insert into public.community_members (community_id, member_id)
      values (_community_id, _member_id)
      on conflict do nothing;
    elsif has_member_communities_table then
      insert into public.member_communities (community_id, member_id)
      values (_community_id, _member_id)
      on conflict do nothing;
    end if;
  end if;

  if coalesce(array_length(_ministry_ids, 1), 0) > 0 then
    if has_ministry_members_table then
      insert into public.ministry_members (member_id, ministry_id)
      select _member_id, ministry_id
      from unnest(_ministry_ids) as ministry_id
      on conflict do nothing;
    elsif has_member_ministries_table then
      insert into public.member_ministries (member_id, ministry_id)
      select _member_id, ministry_id
      from unnest(_ministry_ids) as ministry_id
      on conflict do nothing;
    end if;
  end if;

  perform public.assign_default_member_role(auth.uid(), _church_id);

  return jsonb_build_object(
    'success', true,
    'member_id', _member_id,
    'church_id', _church_id,
    'church_name', _church_name
  );
end;
$$;


--
-- Name: create_church_workspace(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_church_workspace(_name text, _email text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _address text DEFAULT NULL::text, _owner_name text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _user_id uuid := auth.uid();
  _owner_email text;
  _church public.churches%rowtype;
  _free_plan_id uuid;
begin
  if _user_id is null then
    raise exception 'Your session is no longer valid. Please sign in again.';
  end if;

  if nullif(trim(_name), '') is null then
    raise exception 'Church name is required.';
  end if;

  select email
  into _owner_email
  from auth.users
  where id = _user_id;

  _owner_email := nullif(lower(trim(coalesce(_owner_email, auth.jwt() ->> 'email', ''))), '');

  begin
    insert into public.churches (name, email, phone, address, created_by)
    values (
      trim(_name),
      nullif(trim(_email), ''),
      nullif(trim(_phone), ''),
      nullif(trim(_address), ''),
      _user_id
    )
    returning * into _church;
  exception
    when others then
      raise exception 'Unable to create the church record: %', sqlerrm;
  end;

  begin
    insert into public.user_roles (user_id, church_id, role)
    values (_user_id, _church.id, 'church_admin');

    insert into public.members (church_id, user_id, full_name, email, phone)
    values (
      _church.id,
      _user_id,
      coalesce(nullif(trim(_owner_name), ''), _owner_email, 'Admin'),
      _owner_email,
      nullif(trim(_phone), '')
    );
  exception
    when others then
      raise exception 'Unable to create the church administrator profile: %', sqlerrm;
  end;

  begin
    insert into public.contribution_categories (church_id, name, description, is_special)
    values
      (_church.id, 'Tithe', 'Regular tithe', false),
      (_church.id, 'Offering', 'General offering', false),
      (_church.id, 'Building Fund', 'Church building fund', true),
      (_church.id, 'Donations', 'General donations', false);
  exception
    when others then
      raise warning 'Unable to initialize optional contribution categories for church %: %', _church.id, sqlerrm;
  end;

  begin
    select id
    into _free_plan_id
    from public.subscription_plans
    where name = 'free'
    limit 1;

    if _free_plan_id is not null then
      insert into public.church_subscriptions (
        church_id,
        plan_id,
        status,
        current_period_end
      )
      values (
        _church.id,
        _free_plan_id,
        'active',
        now() + interval '30 days'
      );
    end if;
  exception
    when others then
      raise warning 'Unable to initialize optional legacy subscription for church %: %', _church.id, sqlerrm;
  end;

  return jsonb_build_object(
    'id', _church.id,
    'code', _church.code,
    'name', _church.name
  );
end;
$$;


--
-- Name: create_pledge(uuid, uuid, uuid, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_pledge(_member_id uuid, _church_id uuid, _community_id uuid, _amount_pledged numeric, _target_amount numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _pledge_id uuid;
begin
  if _member_id is null or _church_id is null or _amount_pledged is null or _amount_pledged <= 0 then
    return jsonb_build_object('success', false, 'error', 'Invalid pledge details');
  end if;

  if not (
    public.is_pledge_admin_for_church(_church_id)
    or (_community_id is not null and public.is_pledge_leader_for_community(_community_id))
    or public.is_pledge_owner(_member_id)
  ) then
    return jsonb_build_object('success', false, 'error', 'Not allowed to create this pledge');
  end if;

  if not exists (
    select 1
    from public.members m
    where m.id = _member_id
      and m.church_id = _church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Member does not belong to this church');
  end if;

  if _community_id is not null and not exists (
    select 1 from public.communities c where c.id = _community_id and c.church_id = _church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Community does not belong to this church');
  end if;

  insert into public.pledges (member_id, church_id, community_id, amount_pledged, amount_paid, status)
  values (_member_id, _church_id, _community_id, _amount_pledged, 0, 'pending')
  returning id into _pledge_id;

  if _community_id is not null then
    insert into public.community_targets (community_id, church_id, target_amount, total_pledged, total_paid)
    values (_community_id, _church_id, greatest(coalesce(_target_amount, 0), 0), _amount_pledged, 0)
    on conflict (community_id) do update
    set
      target_amount = case
        when _target_amount is null then public.community_targets.target_amount
        else greatest(public.community_targets.target_amount, _target_amount)
      end,
      total_pledged = public.community_targets.total_pledged + excluded.total_pledged;
  end if;

  return jsonb_build_object('success', true, 'pledge_id', _pledge_id);
end;
$$;


--
-- Name: delete_old_app_error_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_old_app_error_logs() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_deleted_count integer := 0;
begin
  if not (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.super_admins sa
      where sa.id = auth.uid()
    )
  ) then
    raise exception 'Only platform super admins can delete old application logs.';
  end if;

  delete from public.app_error_logs
  where (
      level = 'info'
      and created_at < now() - interval '14 days'
    )
    or (
      level = 'warning'
      and created_at < now() - interval '30 days'
    )
    or (
      level = 'error'
      and created_at < now() - interval '90 days'
      and resolved = true
    );

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;


--
-- Name: enforce_rate_limit(text, text, integer, interval); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_rate_limit(_action text, _scope_key text, _max_attempts integer, _window interval) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _actor_id uuid := auth.uid();
  _recent_count integer;
begin
  if nullif(trim(coalesce(_action, '')), '') is null then
    raise exception 'Rate limit action is required.';
  end if;

  if nullif(trim(coalesce(_scope_key, '')), '') is null then
    raise exception 'Rate limit scope is required.';
  end if;

  delete from public.rate_limits
  where occurred_at < now() - interval '2 days';

  select count(*)
  into _recent_count
  from public.rate_limits
  where action = _action
    and scope_key = _scope_key
    and occurred_at >= now() - _window;

  if _recent_count >= _max_attempts then
    raise exception 'Too many requests. Please wait and try again.';
  end if;

  insert into public.rate_limits(action, actor_id, scope_key)
  values (_action, _actor_id, _scope_key);
end;
$$;


--
-- Name: ensure_birthday_announcements(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_birthday_announcements(_church_id uuid, _automation_date date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _target_date date := coalesce(_automation_date, (now() at time zone 'Africa/Nairobi')::date);
  _member record;
  _automation_id uuid;
  _automation_key text;
  _announcement_id uuid;
  _content text;
  _created_count integer := 0;
  _skipped_count integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if _church_id is null then
    return jsonb_build_object('success', false, 'error', 'Church is required');
  end if;

  if not (
    public.is_super_admin(auth.uid())
    or public.is_church_admin(auth.uid(), _church_id)
    or exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.church_id = _church_id
    )
  ) then
    return jsonb_build_object('success', false, 'error', 'You are not allowed to run birthday announcements for this church');
  end if;

  for _member in
    select id, full_name, date_of_birth
    from public.members
    where church_id = _church_id
      and status = 'active'
      and date_of_birth is not null
      and extract(month from date_of_birth) = extract(month from _target_date)
      and extract(day from date_of_birth) = extract(day from _target_date)
  loop
    _automation_id := null;
    _announcement_id := null;
    _automation_key := 'birthday-' || _member.id::text || '-' || _target_date::text;
    _content := 'Happy Birthday ' || _member.full_name || ' ðŸŽ‰ May God bless you with joy, good health, and many more years.';

    select baa.id, baa.announcement_id
    into _automation_id, _announcement_id
    from public.birthday_announcement_automations baa
    where baa.church_id = _church_id
      and baa.member_id = _member.id
      and baa.automation_date = _target_date
    for update;

    if _automation_id is not null and exists (
      select 1
      from public.announcements a
      where a.id = _announcement_id
    ) then
      _skipped_count := _skipped_count + 1;
      continue;
    end if;

    if _automation_id is null then
      select a.id
      into _announcement_id
      from public.announcements a
      where a.church_id = _church_id
        and a.title = 'Birthday ðŸŽ‰'
        and a.content = _content
        and (a.created_at at time zone 'Africa/Nairobi')::date = _target_date
      order by a.created_at desc, a.id desc
      limit 1;

      if _announcement_id is not null then
        insert into public.birthday_announcement_automations (
          church_id,
          member_id,
          automation_date,
          automation_key,
          announcement_id
        )
        values (
          _church_id,
          _member.id,
          _target_date,
          _automation_key,
          _announcement_id
        )
        on conflict (church_id, member_id, automation_date) do update
        set announcement_id = excluded.announcement_id;

        _skipped_count := _skipped_count + 1;
        continue;
      end if;

      insert into public.birthday_announcement_automations (
        church_id,
        member_id,
        automation_date,
        automation_key
      )
      values (
        _church_id,
        _member.id,
        _target_date,
        _automation_key
      )
      on conflict (church_id, member_id, automation_date) do nothing
      returning id into _automation_id;

      if _automation_id is null then
        _skipped_count := _skipped_count + 1;
        continue;
      end if;
    end if;

    insert into public.announcements (
      church_id,
      title,
      content,
      is_published,
      published_at,
      created_by
    )
    values (
      _church_id,
      'Birthday ðŸŽ‰',
      _content,
      true,
      now(),
      auth.uid()
    )
    returning id into _announcement_id;

    update public.birthday_announcement_automations
    set announcement_id = _announcement_id
    where id = _automation_id;

    _created_count := _created_count + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'automation_date', _target_date,
    'birthday_members_count', _created_count + _skipped_count,
    'created_count', _created_count,
    'skipped_count', _skipped_count
  );
end;
$$;


--
-- Name: ensure_default_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_default_subscription() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _trial_days integer := 7;
begin
  if to_regclass('public.platform_settings') is not null then
    select coalesce(default_trial_days, 7)
    into _trial_days
    from public.platform_settings
    order by created_at
    limit 1;
  end if;

  insert into public.subscriptions (church_id, plan, status, started_at, expires_at)
  select new.id, 'pro', 'trial', now(), now() + make_interval(days => greatest(coalesce(_trial_days, 7), 1))
  where not exists (
    select 1
    from public.subscriptions s
    where s.church_id = new.id
      and s.status in ('active', 'trial')
  );

  return new;
end;
$$;


--
-- Name: expire_member_record_subscriptions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_member_record_subscriptions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_expired_count integer := 0;
begin
  update public.member_record_subscriptions
  set status = 'expired'
  where status = 'active'
    and end_date is not null
    and end_date < now();

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'basic'::text, 'intermediate'::text, 'pro'::text, 'enterprise'::text]))),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'trial'::text, 'expired'::text])))
);


--
-- Name: extend_trial(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.extend_trial(_church_id uuid, _days integer) RETURNS public.subscriptions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _subscription public.subscriptions%rowtype;
begin
  if not public.is_platform_super_admin(auth.uid()) then
    raise exception 'Only super admins can extend trials';
  end if;

  if _days is null or _days <= 0 then
    raise exception 'Days must be greater than zero';
  end if;

  select s.* into _subscription
  from public.subscriptions s
  where s.church_id = _church_id
    and s.status in ('active', 'trial')
  order by s.started_at desc
  limit 1;

  if _subscription.id is null then
    raise exception 'No active or trial subscription found for church %', _church_id;
  end if;

  update public.subscriptions
  set status = 'trial',
      expires_at = greatest(coalesce(_subscription.expires_at, now()), now()) + make_interval(days => _days)
  where id = _subscription.id
  returning * into _subscription;

  insert into public.trial_extensions (church_id, extended_by, days_added)
  values (_church_id, auth.uid(), _days);

  return _subscription;
end;
$$;


--
-- Name: analytics_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    snapshot_type text DEFAULT 'monthly_overview'::text NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    generated_by uuid,
    generated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: generate_church_analytics_snapshot(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_church_analytics_snapshot(p_church_id uuid) RETURNS public.analytics_snapshots
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_month_start timestamptz := date_trunc('month', now());
  v_next_month timestamptz := date_trunc('month', now()) + interval '1 month';
  v_last_month_start timestamptz := date_trunc('month', now()) - interval '1 month';
  v_six_months_ago timestamptz := date_trunc('month', now()) - interval '5 months';
  v_this_total numeric := 0;
  v_last_total numeric := 0;
  v_total_contributions numeric := 0;
  v_transaction_count integer := 0;
  v_category_count integer := 0;
  v_active_members integer := 0;
  v_new_members integer := 0;
  v_pledged_total numeric := 0;
  v_pledge_paid_total numeric := 0;
  v_payload jsonb;
  v_snapshot public.analytics_snapshots%rowtype;
begin
  if p_church_id is null then
    raise exception 'Church id is required.';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.church_id = p_church_id
      and ur.user_id = v_user_id
      and ur.role in ('church_admin', 'pastor', 'admin')
  ) then
    raise exception 'You do not have permission to generate analytics for this church.';
  end if;

  perform public.enforce_rate_limit('analytics_snapshot', p_church_id::text, 3, interval '1 hour');

  select coalesce(sum(amount), 0), count(*), count(distinct category_id)
  into v_this_total, v_transaction_count, v_category_count
  from public.contributions
  where church_id = p_church_id
    and created_at >= v_month_start
    and created_at < v_next_month;

  select coalesce(sum(amount), 0)
  into v_last_total
  from public.contributions
  where church_id = p_church_id
    and created_at >= v_last_month_start
    and created_at < v_month_start;

  select coalesce(sum(amount), 0)
  into v_total_contributions
  from public.contributions
  where church_id = p_church_id;

  select count(*)
  into v_active_members
  from public.members
  where church_id = p_church_id
    and status = 'active';

  select count(*)
  into v_new_members
  from public.members
  where church_id = p_church_id
    and created_at >= v_month_start
    and created_at < v_next_month;

  select coalesce(sum(amount_pledged), 0), coalesce(sum(amount_paid), 0)
  into v_pledged_total, v_pledge_paid_total
  from public.pledges
  where church_id = p_church_id;

  v_payload := jsonb_build_object(
    'generatedAt', v_now,
    'thisTotal', v_this_total,
    'lastTotal', v_last_total,
    'totalContributions', v_total_contributions,
    'transactionCount', v_transaction_count,
    'categoryCount', v_category_count,
    'overallChange', case when v_last_total > 0 then ((v_this_total - v_last_total) / v_last_total) * 100 else 0 end,
    'activeMembers', v_active_members,
    'newMembers', v_new_members,
    'pledgeTotals', jsonb_build_object(
      'pledged', v_pledged_total,
      'paid', v_pledge_paid_total,
      'balance', greatest(v_pledged_total - v_pledge_paid_total, 0)
    ),
    'monthlyContributions', (
      select coalesce(jsonb_agg(month_row order by month_row->>'month'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'month', to_char(month_bucket, 'Mon YY'),
          'amount', coalesce(total_amount, 0)
        ) as month_row
        from (
          select date_trunc('month', gs)::date as month_bucket
          from generate_series(v_six_months_ago, v_month_start, interval '1 month') gs
        ) months
        left join (
          select date_trunc('month', created_at)::date as month_bucket, sum(amount) as total_amount
          from public.contributions
          where church_id = p_church_id
            and created_at >= v_six_months_ago
          group by 1
        ) totals using (month_bucket)
      ) rows
    ),
    'trendData', (
      select coalesce(jsonb_agg(month_row order by month_row->>'month'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'month', to_char(month_bucket, 'Mon YY'),
          'amount', coalesce(total_amount, 0)
        ) as month_row
        from (
          select date_trunc('month', gs)::date as month_bucket
          from generate_series(v_six_months_ago, v_month_start, interval '1 month') gs
        ) months
        left join (
          select date_trunc('month', created_at)::date as month_bucket, sum(amount) as total_amount
          from public.contributions
          where church_id = p_church_id
            and created_at >= v_six_months_ago
          group by 1
        ) totals using (month_bucket)
      ) rows
    ),
    'topCategories', (
      select coalesce(jsonb_agg(jsonb_build_object('name', category_name, 'total', total_amount) order by total_amount desc), '[]'::jsonb)
      from (
        select coalesce(cc.name, 'Uncategorized') as category_name, sum(c.amount) as total_amount
        from public.contributions c
        left join public.contribution_categories cc on cc.id = c.category_id
        where c.church_id = p_church_id
          and c.created_at >= v_month_start
          and c.created_at < v_next_month
        group by coalesce(cc.name, 'Uncategorized')
        order by total_amount desc
        limit 10
      ) categories
    ),
    'categoryComparison', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', name,
        'thisMonth', this_month,
        'lastMonth', last_month,
        'change', case when last_month > 0 then ((this_month - last_month) / last_month) * 100 else 0 end
      ) order by this_month desc), '[]'::jsonb)
      from (
        select
          coalesce(current_categories.name, previous_categories.name) as name,
          coalesce(current_categories.total_amount, 0) as this_month,
          coalesce(previous_categories.total_amount, 0) as last_month
        from (
          select coalesce(cc.name, 'Uncategorized') as name, sum(c.amount) as total_amount
          from public.contributions c
          left join public.contribution_categories cc on cc.id = c.category_id
          where c.church_id = p_church_id
            and c.created_at >= v_month_start
            and c.created_at < v_next_month
          group by coalesce(cc.name, 'Uncategorized')
        ) current_categories
        full outer join (
          select coalesce(cc.name, 'Uncategorized') as name, sum(c.amount) as total_amount
          from public.contributions c
          left join public.contribution_categories cc on cc.id = c.category_id
          where c.church_id = p_church_id
            and c.created_at >= v_last_month_start
            and c.created_at < v_month_start
          group by coalesce(cc.name, 'Uncategorized')
        ) previous_categories using (name)
      ) comparison
    ),
    'recentTrends', (
      select coalesce(jsonb_agg(jsonb_build_object('date', day, 'amount', total_amount) order by day), '[]'::jsonb)
      from (
        select created_at::date as day, sum(amount) as total_amount
        from public.contributions
        where church_id = p_church_id
          and created_at >= now() - interval '30 days'
        group by created_at::date
        order by day
      ) daily
    ),
    'jumuiyaData', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'members', member_count) order by name), '[]'::jsonb)
      from (
        select c.name, count(m.id) as member_count
        from public.communities c
        left join public.members m on m.community_id = c.id
        where c.church_id = p_church_id
        group by c.id, c.name
        order by c.name
      ) communities
    )
  );

  insert into public.analytics_snapshots (
    church_id,
    snapshot_type,
    period_start,
    period_end,
    payload,
    generated_by
  )
  values (
    p_church_id,
    'monthly_overview',
    v_month_start,
    v_next_month,
    v_payload,
    v_user_id
  )
  returning * into v_snapshot;

  return v_snapshot;
end;
$$;


--
-- Name: get_church_pledges_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_church_pledges_summary(_church_id uuid) RETURNS TABLE(community_id uuid, community_name text, target_amount numeric, total_pledged numeric, total_paid numeric, balance numeric, pledge_count bigint, completed_count bigint, progress_percentage numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if _church_id is null or not public.is_pledge_admin_for_church(_church_id) then
    return;
  end if;

  return query
  select
    c.id as community_id,
    c.name as community_name,
    coalesce(max(ct.target_amount), 0) as target_amount,
    coalesce(sum(p.amount_pledged), 0) as total_pledged,
    coalesce(sum(p.amount_paid), 0) as total_paid,
    greatest(coalesce(sum(p.amount_pledged), 0) - coalesce(sum(p.amount_paid), 0), 0) as balance,
    count(p.id) as pledge_count,
    count(*) filter (where p.status = 'completed') as completed_count,
    case
      when coalesce(sum(p.amount_pledged), 0) = 0 then 0
      else round((coalesce(sum(p.amount_paid), 0) / sum(p.amount_pledged)) * 100, 2)
    end as progress_percentage
  from public.communities c
  left join public.community_targets ct on ct.community_id = c.id
  left join public.pledges p on p.community_id = c.id
  where c.church_id = _church_id
  group by c.id, c.name
  order by c.name;
end;
$$;


--
-- Name: get_community_pledges(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_community_pledges(_community_id uuid) RETURNS TABLE(id uuid, member_id uuid, member_name text, church_id uuid, community_id uuid, community_name text, amount_pledged numeric, amount_paid numeric, balance numeric, status text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if _community_id is null then
    return;
  end if;

  if not (
    public.is_pledge_leader_for_community(_community_id)
    or exists (
      select 1
      from public.communities c
      where c.id = _community_id
        and public.is_pledge_admin_for_church(c.church_id)
    )
  ) then
    return;
  end if;

  return query
  select
    p.id,
    p.member_id,
    m.full_name as member_name,
    p.church_id,
    p.community_id,
    c.name as community_name,
    p.amount_pledged,
    p.amount_paid,
    greatest(p.amount_pledged - p.amount_paid, 0) as balance,
    p.status,
    p.created_at
  from public.pledges p
  join public.members m on m.id = p.member_id
  left join public.communities c on c.id = p.community_id
  where p.community_id = _community_id
  order by p.created_at desc;
end;
$$;


--
-- Name: get_contributions_by_member(uuid, timestamp with time zone, timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_contributions_by_member(p_church_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_limit integer DEFAULT 100) RETURNS TABLE(member_id uuid, member_name text, phone text, total_amount numeric, contribution_count bigint, last_contribution_date timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_church_id is null then
    raise exception 'Church is required.';
  end if;

  if not (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = p_church_id
        and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
    )
  ) then
    raise exception 'You do not have permission to view member contribution reports for this church.';
  end if;

  return query
  select
    summary.member_id,
    summary.member_name,
    summary.phone,
    summary.total_amount,
    summary.contribution_count,
    summary.last_contribution_date
  from (
    select
      c.member_id::uuid as member_id,
      coalesce(nullif(btrim(m.full_name), ''), nullif(btrim(c.donor_name), ''), 'Anonymous')::text as member_name,
      coalesce(nullif(btrim(m.phone), ''), nullif(btrim(c.phone), ''))::text as phone,
      coalesce(sum(c.amount), 0)::numeric as total_amount,
      count(*)::bigint as contribution_count,
      max(c.created_at)::timestamptz as last_contribution_date
    from public.contributions c
    left join public.members m
      on m.id = c.member_id
      and m.church_id = c.church_id
    where c.church_id = p_church_id
      and c.created_at >= p_start_date
      and c.created_at < p_end_date
    group by
      c.member_id,
      coalesce(nullif(btrim(m.full_name), ''), nullif(btrim(c.donor_name), ''), 'Anonymous'),
      coalesce(nullif(btrim(m.phone), ''), nullif(btrim(c.phone), ''))
  ) summary
  order by summary.total_amount desc, summary.last_contribution_date desc
  limit v_limit;
end;
$$;


--
-- Name: get_member_pledges(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_member_pledges(_member_id uuid) RETURNS TABLE(id uuid, member_id uuid, member_name text, church_id uuid, community_id uuid, community_name text, amount_pledged numeric, amount_paid numeric, balance numeric, status text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if _member_id is null then
    return;
  end if;

  if not (
    public.is_pledge_owner(_member_id)
    or exists (
      select 1
      from public.members m
      where m.id = _member_id
        and public.is_pledge_admin_for_church(m.church_id)
    )
    or exists (
      select 1
      from public.pledges p
      where p.member_id = _member_id
        and p.community_id is not null
        and public.is_pledge_leader_for_community(p.community_id)
    )
  ) then
    return;
  end if;

  return query
  select
    p.id,
    p.member_id,
    m.full_name as member_name,
    p.church_id,
    p.community_id,
    c.name as community_name,
    p.amount_pledged,
    p.amount_paid,
    greatest(p.amount_pledged - p.amount_paid, 0) as balance,
    p.status,
    p.created_at
  from public.pledges p
  join public.members m on m.id = p.member_id
  left join public.communities c on c.id = p.community_id
  where p.member_id = _member_id
  order by p.created_at desc;
end;
$$;


--
-- Name: get_portal_announcements(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_portal_announcements(_church_id uuid, _limit integer DEFAULT 50) RETURNS TABLE(id uuid, church_id uuid, title text, content text, is_published boolean, published_at timestamp with time zone, created_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone, archived_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _safe_limit integer := least(greatest(coalesce(_limit, 50), 1), 100);
  _user_email text;
begin
  if auth.uid() is null or _church_id is null then
    return;
  end if;

  select email
  into _user_email
  from auth.users
  where id = auth.uid();

  if not (
    public.is_super_admin(auth.uid())
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = _church_id
    )
    or exists (
      select 1
      from public.members m
      where m.church_id = _church_id
        and (
          m.user_id = auth.uid()
          or (
            _user_email is not null
            and m.email is not null
            and lower(trim(m.email)) = lower(trim(_user_email))
          )
        )
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.church_id = _church_id
    )
  ) then
    return;
  end if;

  return query
  select
    a.id,
    a.church_id,
    a.title,
    a.content,
    a.is_published,
    a.published_at,
    a.created_by,
    a.created_at,
    a.updated_at,
    a.archived_at
  from public.announcements a
  where a.church_id = _church_id
    and a.is_published = true
    and a.archived_at is null
  order by a.created_at desc
  limit _safe_limit;
end;
$$;


--
-- Name: get_public_invitation(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_invitation(_token text) RETURNS TABLE(id uuid, email text, token text, church_id uuid, status text, expires_at timestamp without time zone, invited_by uuid, created_at timestamp without time zone, role text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    i.id,
    i.email,
    i.token,
    i.church_id,
    i.status,
    i.expires_at,
    i.invited_by,
    i.created_at,
    i.role
  from public.invitations i
  where i.token = _token
  limit 1;
$$;


--
-- Name: get_public_join_church(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_join_church(_slug text) RETURNS TABLE(id uuid, name text, code text, slug text, logo_url text, metadata jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  _has_metadata boolean;
  _has_logo_url boolean;
  _has_status boolean;
  _metadata_expression text;
  _logo_expression text;
  _status_condition text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'metadata'
  )
  into _has_metadata;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'logo_url'
  )
  into _has_logo_url;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'status'
  )
  into _has_status;

  _metadata_expression := case
    when _has_metadata then 'coalesce(c.metadata, ''{}''::jsonb)'
    else '''{}''::jsonb'
  end;
  _logo_expression := case
    when _has_logo_url then 'c.logo_url'
    else 'null::text'
  end;
  _status_condition := case
    when _has_status then 'and c.status = ''active'''
    else ''
  end;

  return query execute format(
    'select c.id, c.name, c.code, c.slug, %s, %s
     from public.churches c
     where lower(c.slug) = lower(trim($1))
       %s
     limit 1',
    _logo_expression,
    _metadata_expression,
    _status_condition
  )
  using _slug;
end;
$_$;


--
-- Name: get_public_registration_church(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_registration_church(_church_code text DEFAULT NULL::text, _church_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, name text, code text, metadata jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  has_metadata_column boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'metadata'
  )
  into has_metadata_column;

  if has_metadata_column then
    return query
    select c.id, c.name, c.code, coalesce(c.metadata, '{}'::jsonb) as metadata
    from public.churches c
    where (
      _church_code is not null
      and btrim(_church_code) <> ''
      and c.code = btrim(_church_code)
    )
    or (
      _church_id is not null
      and c.id = _church_id
    )
    limit 1;
  else
    return query
    select c.id, c.name, c.code, null::jsonb as metadata
    from public.churches c
    where (
      _church_code is not null
      and btrim(_church_code) <> ''
      and c.code = btrim(_church_code)
    )
    or (
      _church_id is not null
      and c.id = _church_id
    )
    limit 1;
  end if;
end;
$$;


--
-- Name: get_public_registration_communities(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_registration_communities(_church_id uuid) RETURNS TABLE(id uuid, name text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.id, c.name
  from public.communities c
  where c.church_id = _church_id
  order by c.name;
$$;


--
-- Name: get_public_registration_ministries(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_registration_ministries(_church_id uuid) RETURNS TABLE(id uuid, name text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select m.id, m.name
  from public.ministries m
  where m.church_id = _church_id
  order by m.name;
$$;


--
-- Name: get_user_church_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_church_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT church_id
  FROM members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;


--
-- Name: get_user_led_communities(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_led_communities(_user_id uuid) RETURNS TABLE(community_id uuid, community_name text, leadership_role text, church_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    c.id as community_id,
    c.name::text as community_name,
    case
      when c.mwenyekiti_id = m.id then 'Mwenyekiti'
      when c.makamu_mwenyekiti_id = m.id then 'Makamu Mwenyekiti'
      when c.katibu_id = m.id then 'Katibu'
      when c.mweka_hazina_id = m.id then 'Mweka Hazina'
    end::text as leadership_role,
    c.church_id
  from public.communities c
  join public.members m
    on m.user_id = _user_id
   and m.church_id = c.church_id
  where c.mwenyekiti_id = m.id
     or c.makamu_mwenyekiti_id = m.id
     or c.katibu_id = m.id
     or c.mweka_hazina_id = m.id;
$$;


--
-- Name: is_chat_admin_for_church(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_chat_admin_for_church(target_church_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = target_church_id
      and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
  );
$$;


--
-- Name: is_church_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_church_admin(_user_id uuid, _church_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and church_id = _church_id
      and role::text in ('church_admin', 'pastor', 'secretary', 'treasurer')
  );
$$;


--
-- Name: is_church_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_church_member(_user_id uuid, _church_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.church_id = _church_id
  )
  or exists (
    select 1
    from public.members m
    where m.user_id = _user_id
      and m.church_id = _church_id
  );
$$;


--
-- Name: is_current_user_community_leader_for(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_current_user_community_leader_for(target_community_id uuid, target_church_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.members m
    join public.communities c on c.id = target_community_id
    where m.user_id = auth.uid()
      and m.church_id = target_church_id
      and c.church_id = target_church_id
      and (
        c.chairperson_id = m.id
        or c.vice_chairperson_id = m.id
        or c.treasurer_id = m.id
        or c.secretary_id = m.id
        or c.katibu_id = m.id
      )
  );
$$;


--
-- Name: is_platform_super_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_super_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select _user_id is not null
    and exists (
      select 1
      from public.super_admins sa
      where sa.id = _user_id
    );
$$;


--
-- Name: is_pledge_admin_for_church(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_pledge_admin_for_church(_church_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = _church_id
      and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
  );
$$;


--
-- Name: is_pledge_leader_for_community(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_pledge_leader_for_community(_community_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.members m
    join public.communities c on c.id = _community_id
    where m.user_id = auth.uid()
      and (
        c.chairperson_id = m.id
        or c.vice_chairperson_id = m.id
        or c.treasurer_id = m.id
        or c.secretary_id = m.id
        or c.katibu_id = m.id
      )
  );
$$;


--
-- Name: is_pledge_owner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_pledge_owner(_member_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.members m
    where m.id = _member_id
      and m.user_id = auth.uid()
  );
$$;


--
-- Name: is_super_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  _has_user_id boolean := false;
  _has_id boolean := false;
  _is_admin boolean := false;
begin
  if _user_id is null then
    return false;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'super_admins'
      and column_name = 'user_id'
  )
  into _has_user_id;

  if _has_user_id then
    execute 'select exists (select 1 from public.super_admins where user_id = $1)'
    using _user_id
    into _is_admin;

    if _is_admin then
      return true;
    end if;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'super_admins'
      and column_name = 'id'
  )
  into _has_id;

  if _has_id then
    execute 'select exists (select 1 from public.super_admins where id = $1)'
    using _user_id
    into _is_admin;
  end if;

  return coalesce(_is_admin, false);
end;
$_$;


--
-- Name: join_church_workspace(text, text, text, text, text, text, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_church_workspace(_slug text, _full_name text, _email text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _gender text DEFAULT NULL::text, _photo_url text DEFAULT NULL::text, _community_id uuid DEFAULT NULL::uuid, _ministry_ids uuid[] DEFAULT ARRAY[]::uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  _user_id uuid := auth.uid();
  _church public.churches%rowtype;
  _member_id uuid;
  _normalized_email text := nullif(lower(trim(coalesce(_email, ''))), '');
  _registration_enabled boolean := true;
  _has_metadata boolean;
  _has_status boolean;
  _status_condition text;
begin
  if _user_id is null then
    raise exception 'Please sign in before joining this church.';
  end if;

  if nullif(trim(_slug), '') is null then
    raise exception 'This church join link is invalid.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'status'
  )
  into _has_status;

  _status_condition := case
    when _has_status then 'and c.status = ''active'''
    else ''
  end;

  execute format(
    'select c.*
     from public.churches c
     where lower(c.slug) = lower(trim($1))
       %s
     limit 1',
    _status_condition
  )
  into _church
  using _slug;

  if _church.id is null then
    raise exception 'This church join link is invalid or no longer active.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'metadata'
  )
  into _has_metadata;

  if _has_metadata then
    execute
      'select coalesce((metadata ->> ''public_registration_enabled'')::boolean, true)
       from public.churches
       where id = $1'
    into _registration_enabled
    using _church.id;
  end if;

  if not _registration_enabled then
    raise exception 'Public registration is not currently available for this church.';
  end if;

  if nullif(trim(_full_name), '') is null then
    raise exception 'Your full name is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(_user_id::text || ':' || _church.id::text, 0));

  if exists (
    select 1
    from public.members m
    where m.user_id = _user_id
      and m.church_id = _church.id
  ) then
    raise exception 'You are already registered with this church.';
  end if;

  if exists (
    select 1
    from public.members m
    where m.user_id = _user_id
      and m.church_id <> _church.id
  ) then
    raise exception 'Your account is already linked to another church workspace.';
  end if;

  if _normalized_email is not null and exists (
    select 1
    from public.members m
    where m.church_id = _church.id
      and lower(coalesce(m.email, '')) = _normalized_email
  ) then
    raise exception 'A member with this email is already registered with this church.';
  end if;

  if nullif(trim(coalesce(_phone, '')), '') is not null and exists (
    select 1
    from public.members m
    where m.church_id = _church.id
      and m.phone = trim(_phone)
  ) then
    raise exception 'A member with this phone number is already registered with this church.';
  end if;

  if _community_id is not null and not exists (
    select 1 from public.communities c
    where c.id = _community_id and c.church_id = _church.id
  ) then
    raise exception 'The selected Jumuiya does not belong to this church.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(_ministry_ids, array[]::uuid[])) as requested_id
    where not exists (
      select 1 from public.ministries m
      where m.id = requested_id and m.church_id = _church.id
    )
  ) then
    raise exception 'One or more selected ministries do not belong to this church.';
  end if;

  insert into public.members (
    full_name,
    email,
    phone,
    gender,
    photo_url,
    church_id,
    user_id,
    status
  )
  values (
    trim(_full_name),
    _normalized_email,
    nullif(trim(coalesce(_phone, '')), ''),
    nullif(trim(coalesce(_gender, '')), '')::public.gender_type,
    nullif(trim(coalesce(_photo_url, '')), ''),
    _church.id,
    _user_id,
    'active'
  )
  returning id into _member_id;

  insert into public.user_roles (user_id, church_id, role)
  values (_user_id, _church.id, 'member')
  on conflict do nothing;

  if _community_id is not null then
    insert into public.member_communities (community_id, member_id)
    values (_community_id, _member_id)
    on conflict do nothing;
  end if;

  insert into public.member_ministries (member_id, ministry_id)
  select _member_id, ministry_id
  from unnest(coalesce(_ministry_ids, array[]::uuid[])) as ministry_id
  on conflict do nothing;

  return jsonb_build_object(
    'success', true,
    'member_id', _member_id,
    'church_id', _church.id,
    'church_name', _church.name,
    'slug', _church.slug
  );
end;
$_$;


--
-- Name: app_error_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_error_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    level text NOT NULL,
    message text NOT NULL,
    stack text,
    page text,
    route text,
    component text,
    function_name text,
    church_id uuid,
    user_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    browser_info text,
    occurrence_count integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    CONSTRAINT app_error_logs_level_check CHECK ((level = ANY (ARRAY['error'::text, 'warning'::text, 'info'::text])))
);


--
-- Name: log_app_error(text, text, text, text, text, text, text, uuid, uuid, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_app_error(p_level text, p_message text, p_stack text DEFAULT NULL::text, p_page text DEFAULT NULL::text, p_route text DEFAULT NULL::text, p_component text DEFAULT NULL::text, p_function_name text DEFAULT NULL::text, p_church_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT '{}'::jsonb, p_browser_info text DEFAULT NULL::text) RETURNS public.app_error_logs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_existing_id uuid;
  v_log public.app_error_logs%rowtype;
  v_actor_id uuid := coalesce(p_user_id, auth.uid());
  v_session_id text := nullif(coalesce(p_metadata->>'logger_session_id', p_metadata->>'session_id', ''), '');
  v_recent_count integer := 0;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if p_level not in ('error', 'warning', 'info') then
    p_level := 'error';
  end if;

  p_message := left(coalesce(nullif(trim(p_message), ''), 'Unknown application log'), 1000);
  p_stack := case when p_stack is null then null else left(p_stack, 8000) end;
  p_page := case when p_page is null then null else left(p_page, 250) end;
  p_route := case when p_route is null then null else left(p_route, 500) end;
  p_component := case when p_component is null then null else left(p_component, 250) end;
  p_function_name := case when p_function_name is null then null else left(p_function_name, 250) end;
  p_browser_info := case when p_browser_info is null then null else left(p_browser_info, 1000) end;

  if length(v_metadata::text) > 6000 then
    v_metadata := jsonb_build_object(
      'truncated', true,
      'logger_session_id', v_session_id,
      'preview', left(v_metadata::text, 6000)
    );
  end if;

  if v_actor_id is not null then
    select count(*)
    into v_recent_count
    from public.app_error_logs
    where user_id = v_actor_id
      and created_at >= now() - interval '1 hour';

    if v_recent_count >= 30 then
      return null;
    end if;
  end if;

  if p_church_id is not null then
    select count(*)
    into v_recent_count
    from public.app_error_logs
    where church_id = p_church_id
      and created_at >= now() - interval '1 hour';

    if v_recent_count >= 100 then
      return null;
    end if;
  end if;

  if v_actor_id is null and v_session_id is not null then
    select count(*)
    into v_recent_count
    from public.app_error_logs
    where metadata->>'logger_session_id' = v_session_id
      and created_at >= now() - interval '1 hour';

    if v_recent_count >= 20 then
      return null;
    end if;
  end if;

  select id
  into v_existing_id
  from public.app_error_logs
  where message = p_message
    and coalesce(component, '') = coalesce(p_component, '')
    and coalesce(route, '') = coalesce(p_route, '')
    and created_at >= now() - interval '5 minutes'
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    update public.app_error_logs
    set occurrence_count = occurrence_count + 1,
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || v_metadata
    where id = v_existing_id
    returning * into v_log;

    return v_log;
  end if;

  insert into public.app_error_logs (
    level,
    message,
    stack,
    page,
    route,
    component,
    function_name,
    church_id,
    user_id,
    metadata,
    browser_info
  )
  values (
    p_level,
    p_message,
    p_stack,
    p_page,
    p_route,
    p_component,
    p_function_name,
    p_church_id,
    v_actor_id,
    v_metadata,
    p_browser_info
  )
  returning * into v_log;

  return v_log;
exception
  when others then
    return null;
end;
$$;


--
-- Name: make_church_join_slug(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.make_church_join_slug(_name text, _church_id uuid DEFAULT NULL::uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _base text;
  _candidate text;
  _suffix integer := 1;
begin
  _base := lower(regexp_replace(trim(coalesce(_name, 'church')), '[^a-zA-Z0-9]+', '-', 'g'));
  _base := trim(both '-' from _base);

  if _base = '' then
    _base := 'church';
  end if;

  _candidate := _base;
  while exists (
    select 1
    from public.churches c
    where lower(c.slug) = lower(_candidate)
      and (_church_id is null or c.id <> _church_id)
  ) loop
    _suffix := _suffix + 1;
    _candidate := _base || '-' || _suffix::text;
  end loop;

  return _candidate;
end;
$$;


--
-- Name: make_pledge_payment(uuid, numeric, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.make_pledge_payment(_pledge_id uuid, _amount numeric, _payment_method text, _transaction_id text DEFAULT NULL::text, _proof_url text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  _pledge public.pledges%rowtype;
  _payment_id uuid;
  _transaction_id_normalized text := nullif(btrim(coalesce(_transaction_id, '')), '');
  _proof_url_normalized text := nullif(btrim(coalesce(_proof_url, '')), '');
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required.');
  end if;
  if _pledge_id is null or _amount is null or _amount <= 0 or coalesce(btrim(_payment_method), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Enter valid payment details.');
  end if;
  if _transaction_id_normalized is null and _proof_url_normalized is null then
    return jsonb_build_object('success', false, 'error', 'Provide a transaction ID or payment proof before submitting.');
  end if;
  if _transaction_id_normalized is not null and _transaction_id_normalized !~ '^[A-Za-z0-9._-]{4,80}$' then
    return jsonb_build_object('success', false, 'error', 'Enter a valid transaction ID.');
  end if;

  select * into _pledge from public.pledges where id = _pledge_id for update;
  if _pledge.id is null then return jsonb_build_object('success', false, 'error', 'Pledge not found.'); end if;
  if not (
    public.is_pledge_owner(_pledge.member_id)
    or public.is_pledge_admin_for_church(_pledge.church_id)
    or (_pledge.community_id is not null and public.is_pledge_leader_for_community(_pledge.community_id))
  ) then return jsonb_build_object('success', false, 'error', 'Not allowed to submit this payment.'); end if;
  if _amount > (_pledge.amount_pledged - _pledge.amount_paid) / 0.99 then
    return jsonb_build_object('success', false, 'error', 'Payment exceeds the remaining pledge balance.');
  end if;
  if _transaction_id_normalized is not null and exists (
    select 1 from public.pledge_payments pp where lower(btrim(pp.transaction_id)) = lower(_transaction_id_normalized)
  ) then return jsonb_build_object('success', false, 'error', 'This transaction has already been submitted.'); end if;

  insert into public.pledge_payments (pledge_id, member_id, amount, payment_method, transaction_id, proof_url, verification_status)
  values (_pledge.id, _pledge.member_id, _amount, btrim(_payment_method), _transaction_id_normalized, _proof_url_normalized, 'pending')
  returning id into _payment_id;
  return jsonb_build_object('success', true, 'payment_id', _payment_id, 'status', 'pending', 'message', 'Payment submitted for verification.');
end;
$_$;


--
-- Name: record_portal_contribution(uuid, numeric, uuid, text, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_portal_contribution(_church_id uuid, _amount numeric, _member_id uuid DEFAULT NULL::uuid, _donor_name text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _payment_reference text DEFAULT NULL::text, _category_id uuid DEFAULT NULL::uuid, _notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  _contribution_id uuid;
  _categories_have_church_id boolean;
  _category_valid boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if _church_id is null then
    return jsonb_build_object('success', false, 'error', 'Church is required');
  end if;

  if _amount is null or _amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = _church_id
  ) and not exists (
    select 1
    from public.members m
    where m.user_id = auth.uid()
      and m.church_id = _church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'You are not allowed to record contributions for this church');
  end if;

  if _member_id is not null and not exists (
    select 1
    from public.members m
    where m.id = _member_id
      and m.church_id = _church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Member does not belong to this church');
  end if;

  if _category_id is not null then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contribution_categories'
        and column_name = 'church_id'
    )
    into _categories_have_church_id;

    if _categories_have_church_id then
      execute
        'select exists (
          select 1
          from public.contribution_categories c
          where c.id = $1
            and c.church_id = $2
        )'
      into _category_valid
      using _category_id, _church_id;
    else
      select exists (
        select 1
        from public.contribution_categories c
        where c.id = _category_id
      )
      into _category_valid;
    end if;

    if not _category_valid then
      return jsonb_build_object('success', false, 'error', 'Contribution category was not found');
    end if;
  end if;

  insert into public.contributions (
    church_id,
    amount,
    donor_name,
    member_id,
    phone,
    payment_reference,
    category_id,
    created_by,
    notes
  )
  values (
    _church_id,
    _amount,
    nullif(trim(coalesce(_donor_name, '')), ''),
    _member_id,
    nullif(trim(coalesce(_phone, '')), ''),
    nullif(trim(coalesce(_payment_reference, '')), ''),
    _category_id,
    auth.uid(),
    nullif(trim(coalesce(_notes, '')), '')
  )
  returning id into _contribution_id;

  return jsonb_build_object('success', true, 'id', _contribution_id);
end;
$_$;


--
-- Name: resolve_app_error_log(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_app_error_log(p_log_id uuid) RETURNS public.app_error_logs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_log public.app_error_logs%rowtype;
begin
  if not (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.super_admins sa
      where sa.id = auth.uid()
    )
  ) then
    raise exception 'Only platform super admins can resolve application logs.';
  end if;

  update public.app_error_logs
  set resolved = true,
      resolved_at = now(),
      resolved_by = auth.uid(),
      updated_at = now()
  where id = p_log_id
  returning * into v_log;

  if v_log.id is null then
    raise exception 'Log entry not found.';
  end if;

  return v_log;
end;
$$;


--
-- Name: member_record_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_record_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    member_id uuid NOT NULL,
    amount numeric DEFAULT 3000 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    transaction_id text,
    proof_url text,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    plan_interval text DEFAULT 'monthly'::text NOT NULL,
    CONSTRAINT member_record_subscriptions_amount_check CHECK ((((plan_interval = 'monthly'::text) AND (amount = (3000)::numeric)) OR ((plan_interval = 'yearly'::text) AND (amount = (30000)::numeric)))),
    CONSTRAINT member_record_subscriptions_plan_interval_check CHECK ((plan_interval = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
    CONSTRAINT member_record_subscriptions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'rejected'::text])))
);


--
-- Name: review_member_record_subscription(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_member_record_subscription(p_subscription_id uuid, p_approved boolean, p_rejection_reason text DEFAULT NULL::text) RETURNS public.member_record_subscriptions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_request public.member_record_subscriptions%rowtype;
  v_active public.member_record_subscriptions%rowtype;
  v_new_start timestamptz;
  v_new_end timestamptz;
  v_extension interval;
begin
  select *
  into v_request
  from public.member_record_subscriptions
  where id = p_subscription_id
  for update;

  if v_request.id is null then
    raise exception 'Subscription request not found.';
  end if;

  if not (
    exists (
      select 1
      from public.super_admins sa
      where sa.id = auth.uid()
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = v_request.church_id
        and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
    )
  ) then
    raise exception 'You do not have permission to review this subscription.';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This preservation request has already been reviewed.';
  end if;

  if not p_approved then
    update public.member_record_subscriptions
    set status = 'rejected',
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where id = v_request.id
    returning * into v_request;

    return v_request;
  end if;

  v_extension := case
    when v_request.plan_interval = 'yearly' then interval '1 year'
    else interval '1 month'
  end;

  select *
  into v_active
  from public.member_record_subscriptions
  where church_id = v_request.church_id
    and member_id = v_request.member_id
    and status = 'active'
    and end_date > now()
    and id <> v_request.id
  order by end_date desc
  limit 1
  for update;

  if v_active.id is not null then
    v_new_start := coalesce(v_active.start_date, now());
    v_new_end := v_active.end_date + v_extension;

    update public.member_record_subscriptions
    set status = 'expired'
    where id = v_active.id;
  else
    v_new_start := now();
    v_new_end := now() + v_extension;
  end if;

  update public.member_record_subscriptions
  set status = 'active',
      start_date = v_new_start,
      end_date = v_new_end,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;


--
-- Name: review_pledge_payment(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_pledge_payment(_payment_id uuid, _approve boolean, _reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _payment public.pledge_payments%rowtype;
  _pledge public.pledges%rowtype;
  _fee numeric(12,2);
  _net numeric(12,2);
  _new_paid numeric(12,2);
begin
  select pp.* into _payment from public.pledge_payments pp where pp.id = _payment_id for update;
  if _payment.id is null then return jsonb_build_object('success', false, 'error', 'Payment not found.'); end if;
  select * into _pledge from public.pledges where id = _payment.pledge_id for update;
  if not (
    public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = _pledge.church_id
        and ur.role in ('church_admin', 'pastor')
    )
  ) then
    return jsonb_build_object('success', false, 'error', 'Not authorized to review this payment.');
  end if;
  if _payment.verification_status <> 'pending' then
    return jsonb_build_object('success', false, 'error', 'This payment has already been reviewed.');
  end if;
  if not _approve then
    update public.pledge_payments set verification_status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_reason = nullif(btrim(_reason), '') where id = _payment.id;
    return jsonb_build_object('success', true, 'status', 'rejected');
  end if;
  _fee := round(_payment.amount * 0.01, 2);
  _net := round(_payment.amount - _fee, 2);
  if _pledge.amount_paid + _net > _pledge.amount_pledged then
    return jsonb_build_object('success', false, 'error', 'Approval would exceed the pledge balance.');
  end if;
  update public.pledge_payments set verification_status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_reason = nullif(btrim(_reason), '') where id = _payment.id;
  insert into public.platform_fees (church_id, source_type, source_id, gross_amount, fee_percentage, fee_amount, net_amount, member_id)
  values (_pledge.church_id, 'pledge_payment', _payment.id, _payment.amount, 1, _fee, _net, _pledge.member_id);
  _new_paid := _pledge.amount_paid + _net;
  update public.pledges set amount_paid = _new_paid, status = case when _new_paid < _pledge.amount_pledged then 'partial' else 'completed' end where id = _pledge.id;
  if _pledge.community_id is not null then
    update public.community_targets set total_paid = total_paid + _net where community_id = _pledge.community_id;
  end if;
  return jsonb_build_object('success', true, 'status', 'approved', 'net_amount', _net);
end;
$$;


--
-- Name: subscription_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    plan text NOT NULL,
    amount numeric NOT NULL,
    payment_method text DEFAULT 'mobile_money'::text NOT NULL,
    payment_reference text NOT NULL,
    payer_phone text,
    receipt_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    verified_by uuid,
    verified_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT subscription_payments_payment_method_check CHECK ((payment_method = 'mobile_money'::text)),
    CONSTRAINT subscription_payments_plan_check CHECK ((plan = ANY (ARRAY['basic'::text, 'intermediate'::text, 'pro'::text, 'enterprise'::text]))),
    CONSTRAINT subscription_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: review_subscription_payment(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_subscription_payment(_payment_id uuid, _approved boolean, _rejection_reason text DEFAULT NULL::text) RETURNS public.subscription_payments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _payment public.subscription_payments%rowtype;
  _action text;
begin
  if not public.is_platform_super_admin(auth.uid()) then
    raise exception 'Only super admins can review subscription payments.';
  end if;

  select p.* into _payment
  from public.subscription_payments p
  where p.id = _payment_id
  for update;

  if _payment.id is null then
    raise exception 'Payment request not found.';
  end if;

  if _payment.status <> 'pending' then
    raise exception 'This payment request has already been reviewed.';
  end if;

  if _approved then
    update public.subscriptions
    set status = 'expired',
        expires_at = now()
    where church_id = _payment.church_id
      and status in ('active', 'trial');

    insert into public.subscriptions (church_id, plan, status, started_at, expires_at)
    values (_payment.church_id, _payment.plan, 'active', now(), now() + interval '1 month');

    update public.subscription_payments
    set status = 'approved',
        verified_by = auth.uid(),
        verified_at = now(),
        rejection_reason = null
    where id = _payment.id
    returning * into _payment;

    _action := 'SUBSCRIPTION_PAYMENT_APPROVED';
  else
    update public.subscription_payments
    set status = 'rejected',
        verified_by = auth.uid(),
        verified_at = now(),
        rejection_reason = nullif(trim(coalesce(_rejection_reason, '')), '')
    where id = _payment.id
    returning * into _payment;

    _action := 'SUBSCRIPTION_PAYMENT_REJECTED';
  end if;

  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    _action,
    'subscription_payment',
    _payment.id,
    format(
      '%s payment request for church %s, plan %s, amount %s.',
      case when _approved then 'Approved' else 'Rejected' end,
      _payment.church_id,
      _payment.plan,
      _payment.amount
    )
  );

  return _payment;
end;
$$;


--
-- Name: run_daily_automations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_daily_automations() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_pastor text := 'Pastor John';
BEGIN
  /* =========================
     BIRTHDAYS
  ========================= */
  WITH due AS (
    SELECT
      m.id AS member_id,
      m.full_name,
      m.church_id,
      m.date_of_birth
    FROM public.members m
    WHERE m.date_of_birth IS NOT NULL
      AND m.church_id IS NOT NULL
      AND EXTRACT(MONTH FROM m.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM m.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
  ),
  picked AS (
    SELECT
      d.member_id,
      d.full_name,
      d.church_id,
      a2.message_template
    FROM due d
    JOIN LATERAL (
      SELECT a2.message_template
      FROM public.automations a2
      WHERE a2.church_id IS NOT DISTINCT FROM d.church_id
        AND a2.type = 'birthday'
        AND a2.is_enabled = true
      ORDER BY a2.created_at DESC
      LIMIT 1
    ) a2 ON true
  ),
  to_send AS (
    SELECT
      p.member_id,
      p.church_id,
      REPLACE(
        REPLACE(p.message_template, '{{name}}', p.full_name),
        '{{pastor}}', v_pastor
      ) AS content,
      'Birthday ðŸŽ‰'::text AS title,
      'birthday'::text AS automation_type
    FROM picked p
    WHERE p.message_template IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.automation_logs l
        WHERE l.member_id = p.member_id
          AND l.automation_type = 'birthday'
          AND DATE(l.sent_at) = CURRENT_DATE
      )
  )
  INSERT INTO public.announcements (title, content, is_published, church_id)
  SELECT title, content, true, church_id
  FROM to_send;

  INSERT INTO public.automation_logs (member_id, automation_type, message)
  SELECT member_id, automation_type, content
  FROM to_send;

  /* =========================
     ANNIVERSARIES
  ========================= */
  WITH due AS (
    SELECT
      m.id AS member_id,
      m.full_name,
      m.church_id,
      m.wedding_date
    FROM public.members m
    WHERE m.wedding_date IS NOT NULL
      AND m.church_id IS NOT NULL
      AND EXTRACT(MONTH FROM m.wedding_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM m.wedding_date) = EXTRACT(DAY FROM CURRENT_DATE)
  ),
  picked AS (
    SELECT
      d.member_id,
      d.full_name,
      d.church_id,
      a2.message_template
    FROM due d
    JOIN LATERAL (
      SELECT a2.message_template
      FROM public.automations a2
      WHERE a2.church_id IS NOT DISTINCT FROM d.church_id
        AND a2.type = 'anniversary'
        AND a2.is_enabled = true
      ORDER BY a2.created_at DESC
      LIMIT 1
    ) a2 ON true
  ),
  to_send AS (
    SELECT
      p.member_id,
      p.church_id,
      REPLACE(
        REPLACE(p.message_template, '{{name}}', p.full_name),
        '{{pastor}}', v_pastor
      ) AS content,
      'Anniversary ðŸ’'::text AS title,
      'anniversary'::text AS automation_type
    FROM picked p
    WHERE p.message_template IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.automation_logs l
        WHERE l.member_id = p.member_id
          AND l.automation_type = 'anniversary'
          AND DATE(l.sent_at) = CURRENT_DATE
      )
  )
  INSERT INTO public.announcements (title, content, is_published, church_id)
  SELECT title, content, true, church_id
  FROM to_send;

  INSERT INTO public.automation_logs (member_id, automation_type, message)
  SELECT member_id, automation_type, content
  FROM to_send;
END;
$$;


--
-- Name: set_billing_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_billing_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: set_church_join_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_church_join_slug() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.make_church_join_slug(new.name, new.id);
  else
    new.slug := lower(regexp_replace(trim(new.slug), '[^a-zA-Z0-9]+', '-', 'g'));
    new.slug := trim(both '-' from new.slug);
  end if;

  if new.slug = '' then
    new.slug := public.make_church_join_slug(new.name, new.id);
  end if;

  return new;
end;
$$;


--
-- Name: submit_public_contribution(text, text, numeric, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_public_contribution(p_church_slug_or_id text, p_contribution_type text, p_amount numeric, p_donor_name text, p_phone text, p_note text DEFAULT NULL::text, p_transaction_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_church_id uuid; v_category_id uuid; v_type text := nullif(btrim(coalesce(p_contribution_type, '')), '');
  v_donor_name text := nullif(btrim(coalesce(p_donor_name, '')), ''); v_phone text := regexp_replace(coalesce(p_phone, ''), '\s+', '', 'g');
  v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_reference text := nullif(btrim(coalesce(p_transaction_id, '')), ''); v_scope text;
begin
  select church.id into v_church_id from public.get_public_giving_church(p_church_slug_or_id) church limit 1;
  if v_church_id is null then return jsonb_build_object('success', false, 'error', 'We could not accept this submission.'); end if;
  v_scope := v_church_id::text || ':' || lower(coalesce(v_phone, '')) || ':' || lower(coalesce(v_reference, ''));
  if v_type is null or v_type not in ('Sadaka', 'Zaka', 'Jengo', 'Shukrani', 'Special Contribution') or p_amount is null or p_amount <= 0 or p_amount > 100000000 or v_donor_name is null or length(v_donor_name) < 2 or v_phone !~ '^\+?[0-9]{9,15}$' or (v_reference is not null and v_reference !~ '^[A-Za-z0-9._-]{4,80}$') then
    insert into public.security_audit_events(event_type, church_id, scope_key, metadata) values ('public_contribution_rejected', v_church_id, v_scope, jsonb_build_object('reason', 'validation_failed'));
    return jsonb_build_object('success', false, 'error', 'We could not accept this submission. Please check your details.');
  end if;
  if v_reference is not null and exists (select 1 from public.contributions c where c.church_id = v_church_id and lower(btrim(c.payment_reference)) = lower(v_reference)) then
    return jsonb_build_object('success', true, 'message', 'This contribution was already received and is awaiting confirmation.');
  end if;
  begin
    perform public.enforce_rate_limit('public_contribution', v_scope, 3, interval '15 minutes');
  exception when others then
    insert into public.security_audit_events(event_type, church_id, scope_key, metadata) values ('public_contribution_rate_limited', v_church_id, v_scope, '{}'::jsonb);
    return jsonb_build_object('success', false, 'error', 'Too many submissions. Please wait and try again.');
  end;
  select cc.id into v_category_id from public.contribution_categories cc where cc.church_id = v_church_id and lower(cc.name) = lower(case v_type when 'Sadaka' then 'Offering' when 'Zaka' then 'Tithe' when 'Jengo' then 'Building Fund' else 'Donations' end) limit 1;
  insert into public.contributions(church_id, amount, category_id, donor_name, phone, payment_reference, notes, currency, date, created_by)
  values (v_church_id, p_amount, v_category_id, left(v_donor_name,160), left(v_phone,32), left(v_reference,120), left(concat_ws(E'\n','Public QR giving submission - pending confirmation','Type: ' || v_type, case when v_note is not null then 'Note: ' || v_note end),1000), 'TZS', current_date, null);
  return jsonb_build_object('success', true, 'message', 'Thank you. Your contribution has been submitted for confirmation.');
end; $_$;


--
-- Name: submit_subscription_payment(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_subscription_payment(_church_id uuid, _plan text, _payment_reference text, _payer_phone text DEFAULT NULL::text, _receipt_url text DEFAULT NULL::text) RETURNS public.subscription_payments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _amount numeric;
  _payment public.subscription_payments%rowtype;
begin
  if not public.can_manage_church_workspace(auth.uid(), _church_id) then
    raise exception 'Only workspace managers can submit a subscription payment.';
  end if;

  _amount := case _plan
    when 'basic' then 50000
    when 'intermediate' then 80000
    when 'pro' then 120000
    when 'enterprise' then 150000
    else null
  end;

  if _amount is null then
    raise exception 'Select a paid subscription plan.';
  end if;

  if nullif(trim(coalesce(_payment_reference, '')), '') is null then
    raise exception 'Enter the mobile-money transaction reference.';
  end if;

  if _receipt_url is not null
    and _receipt_url not like _church_id::text || '/%' then
    raise exception 'Invalid receipt upload path.';
  end if;

  if exists (
    select 1 from public.subscription_payments p
    where p.church_id = _church_id and p.status = 'pending'
  ) then
    raise exception 'This workspace already has a payment awaiting verification.';
  end if;

  insert into public.subscription_payments (
    church_id,
    requested_by,
    plan,
    amount,
    payment_reference,
    payer_phone,
    receipt_url
  )
  values (
    _church_id,
    auth.uid(),
    _plan,
    _amount,
    trim(_payment_reference),
    nullif(trim(coalesce(_payer_phone, '')), ''),
    _receipt_url
  )
  returning * into _payment;

  return _payment;
end;
$$;


--
-- Name: update_community_leadership(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_community_leadership(_community_id uuid, _role_field text, _member_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  _church_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if _role_field not in ('mwenyekiti_id', 'makamu_mwenyekiti_id', 'mweka_hazina_id', 'katibu_id') then
    return jsonb_build_object('success', false, 'error', 'Invalid leadership role');
  end if;

  select c.church_id into _church_id
  from public.communities c
  where c.id = _community_id;

  if _church_id is null then
    return jsonb_build_object('success', false, 'error', 'Community not found');
  end if;

  if not public.can_manage_church_workspace(auth.uid(), _church_id) then
    return jsonb_build_object('success', false, 'error', 'You do not have permission to update this community');
  end if;

  if _member_id is not null and not exists (
    select 1
    from public.members m
    where m.id = _member_id
      and m.church_id = _church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Selected member does not belong to this church');
  end if;

  execute format('update public.communities set %I = $1 where id = $2', _role_field)
  using _member_id, _community_id;

  return jsonb_build_object('success', true);
end;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    addon_name text NOT NULL,
    purchased boolean DEFAULT false NOT NULL,
    purchased_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT addons_addon_name_check CHECK ((addon_name = 'member_portal'::text))
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    is_published boolean DEFAULT false,
    church_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    published_at timestamp without time zone,
    archived_at timestamp with time zone
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text,
    created_at timestamp without time zone DEFAULT now(),
    details text,
    entity text,
    entity_id uuid
);


--
-- Name: automation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid,
    automation_type text,
    sent_at timestamp without time zone DEFAULT now(),
    message text
);


--
-- Name: automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid,
    type text,
    is_enabled boolean DEFAULT true,
    is_public boolean DEFAULT false,
    message_template text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: bible_verses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bible_verses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference text NOT NULL,
    verse_text text NOT NULL,
    language text DEFAULT 'sw'::text,
    created_at timestamp without time zone DEFAULT now(),
    archived_at timestamp with time zone,
    church_id uuid,
    text text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: birthday_announcement_automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.birthday_announcement_automations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    member_id uuid NOT NULL,
    automation_date date NOT NULL,
    automation_key text NOT NULL,
    announcement_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_channel_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_channel_members (
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    member_id uuid,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    owner_scope text NOT NULL,
    audience_type text NOT NULL,
    community_id uuid,
    ministry_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_channels_audience_type_check CHECK ((audience_type = ANY (ARRAY['ministry'::text, 'community_leaders'::text, 'all_community_leaders'::text, 'admin_roles'::text, 'community_members'::text]))),
    CONSTRAINT chat_channels_owner_scope_check CHECK ((owner_scope = ANY (ARRAY['church_admin'::text, 'community_leader'::text])))
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    sender_user_id uuid NOT NULL,
    sender_member_id uuid,
    body text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    attachment_name text,
    attachment_url text,
    attachment_type text,
    attachment_size bigint
);


--
-- Name: church_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.church_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    feature_id uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: church_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.church_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid,
    role text,
    name text,
    created_at timestamp without time zone DEFAULT now(),
    community_id uuid,
    user_id uuid
);


--
-- Name: churches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.churches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text,
    created_at timestamp without time zone DEFAULT now(),
    owner_id uuid,
    address text,
    created_by uuid,
    email text,
    phone text,
    logo_url text,
    banner_url text,
    slug text NOT NULL
);


--
-- Name: communities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    church_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    description text,
    chairperson_id uuid,
    vice_chairperson_id uuid,
    treasurer_id uuid,
    secretary_id uuid,
    katibu_id uuid,
    mwenyekiti_id uuid,
    makamu_mwenyekiti_id uuid,
    mweka_hazina_id uuid
);


--
-- Name: community_help; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_help (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    description text,
    goal_amount numeric,
    current_amount numeric DEFAULT 0,
    status text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: community_help_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_help_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid,
    church_id uuid,
    category text,
    description text,
    target_amount numeric,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now(),
    current_amount numeric DEFAULT 0 NOT NULL
);


--
-- Name: community_leaders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_leaders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id uuid,
    user_id uuid,
    leadership_role text,
    church_id uuid
);


--
-- Name: community_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id uuid NOT NULL,
    church_id uuid NOT NULL,
    target_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_pledged numeric(12,2) DEFAULT 0 NOT NULL,
    total_paid numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT community_targets_target_amount_check CHECK ((target_amount >= (0)::numeric)),
    CONSTRAINT community_targets_total_paid_check CHECK ((total_paid >= (0)::numeric)),
    CONSTRAINT community_targets_total_pledged_check CHECK ((total_pledged >= (0)::numeric))
);


--
-- Name: contribution_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contribution_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    contribution_id uuid,
    action text NOT NULL,
    reason text NOT NULL,
    old_values jsonb,
    new_values jsonb,
    performed_by uuid,
    performer_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contribution_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contribution_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text
);


--
-- Name: contributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid,
    amount numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    category_id uuid,
    donor_name text,
    phone text,
    payment_reference text,
    notes text,
    church_id uuid,
    created_by uuid,
    date date DEFAULT CURRENT_DATE
);


--
-- Name: event_attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_attendances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    event_id uuid NOT NULL,
    member_id uuid NOT NULL,
    response text NOT NULL,
    responded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_attendances_response_check CHECK ((response = ANY (ARRAY['yes'::text, 'no'::text])))
);


--
-- Name: event_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid,
    type text,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now(),
    church_id uuid,
    event_date date,
    description text,
    contact_phone text,
    preferred_date date,
    requester_name text,
    requester_phone text,
    request_type text,
    reviewed_by uuid,
    reviewed_at timestamp without time zone
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    location text,
    church_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    archived_at timestamp with time zone
);


--
-- Name: families; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.families (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    church_id uuid
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: help_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    help_request_id uuid NOT NULL,
    member_id uuid,
    author_name text NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: help_donations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_donations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    help_request_id uuid NOT NULL,
    donor_name text NOT NULL,
    amount numeric(12,2) NOT NULL,
    is_anonymous boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    role text,
    church_id uuid,
    token text,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    invited_by uuid,
    status text DEFAULT 'pending'::text
);


--
-- Name: invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    church_id uuid,
    token text,
    invited_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    used boolean DEFAULT false,
    status text DEFAULT 'pending'::text,
    expires_at timestamp without time zone,
    CONSTRAINT check_status CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text])))
);


--
-- Name: jumuiya; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jumuiya (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: mass_intentions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mass_intentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid,
    intention text,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now(),
    church_id uuid,
    intention_type text,
    message text,
    offering_amount numeric,
    CONSTRAINT mass_intentions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'scheduled'::text, 'completed'::text, 'archived'::text])))
);


--
-- Name: member_communities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_communities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid,
    community_id uuid,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: member_ministries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_ministries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    ministry_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    phone text,
    community_id uuid,
    group_id uuid,
    family_id uuid,
    family_role text,
    created_at timestamp without time zone DEFAULT now(),
    church_id uuid,
    email text,
    user_id uuid,
    gender text,
    photo_url text,
    jumuiya_id uuid,
    ministry_id uuid,
    status text DEFAULT 'active'::text,
    date_of_birth date,
    wedding_date date,
    spouse_name text
);


--
-- Name: message_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid,
    title text NOT NULL,
    body text NOT NULL,
    category text DEFAULT 'announcement'::text NOT NULL,
    language text DEFAULT 'sw'::text NOT NULL,
    tone text,
    occasion text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type text DEFAULT 'announcement'::text NOT NULL,
    content text,
    template_type text,
    default_bible_verse text
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    language text DEFAULT 'sw'::text,
    type text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ministries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ministries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid,
    name text,
    created_at timestamp without time zone DEFAULT now(),
    description text
);


--
-- Name: platform_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text,
    is_global boolean DEFAULT true NOT NULL,
    globally_enabled boolean DEFAULT true NOT NULL,
    globally_locked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_fees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    source_type text NOT NULL,
    source_id uuid,
    gross_amount numeric(12,2) NOT NULL,
    fee_percentage numeric(5,2) DEFAULT 1 NOT NULL,
    fee_amount numeric(12,2) NOT NULL,
    net_amount numeric(12,2) NOT NULL,
    member_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform_name text DEFAULT 'Ecclesia'::text NOT NULL,
    support_email text DEFAULT 'support@ecclesia.app'::text NOT NULL,
    platform_description text DEFAULT 'Church management platform for modern congregations.'::text NOT NULL,
    maintenance_mode boolean DEFAULT false NOT NULL,
    default_trial_days integer DEFAULT 30 NOT NULL,
    grace_period_days integer DEFAULT 7 NOT NULL,
    auto_expire_trials boolean DEFAULT true NOT NULL,
    allow_downgrades boolean DEFAULT true NOT NULL,
    welcome_email_subject text DEFAULT 'Welcome to Ecclesia!'::text NOT NULL,
    welcome_email_body text DEFAULT 'Thank you for joining Ecclesia. Your church is now set up and ready to go.'::text NOT NULL,
    invite_email_subject text DEFAULT 'You''ve been invited to join a church on Ecclesia'::text NOT NULL,
    invite_email_body text DEFAULT 'You''ve been invited to join {church_name}. Click the link below to accept.'::text NOT NULL,
    notify_new_church_registration boolean DEFAULT true NOT NULL,
    notify_payment_received boolean DEFAULT true NOT NULL,
    notify_subscription_expiring boolean DEFAULT true NOT NULL,
    notify_system_errors boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    billing_payment_method text DEFAULT 'Mobile Money / Lipa Namba'::text NOT NULL,
    billing_lipa_number text DEFAULT 'Configure Lipa Namba in Platform Settings'::text NOT NULL,
    billing_payment_instructions text DEFAULT 'Pay the exact plan amount, then submit the mobile-money transaction reference for verification.'::text NOT NULL
);


--
-- Name: pledge_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pledge_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pledge_id uuid NOT NULL,
    member_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_method text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    transaction_id text,
    proof_url text,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_reason text,
    CONSTRAINT pledge_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT pledge_payments_verification_status_check CHECK ((verification_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: pledges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pledges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    church_id uuid NOT NULL,
    community_id uuid,
    amount_pledged numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pledges_amount_paid_check CHECK ((amount_paid >= (0)::numeric)),
    CONSTRAINT pledges_amount_pledged_check CHECK ((amount_pledged > (0)::numeric)),
    CONSTRAINT pledges_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partial'::text, 'completed'::text])))
);


--
-- Name: prayer_request_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prayer_request_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prayer_request_id uuid NOT NULL,
    church_id uuid NOT NULL,
    member_id uuid,
    author_name text NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prayer_request_prayers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prayer_request_prayers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prayer_request_id uuid NOT NULL,
    church_id uuid NOT NULL,
    member_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prayer_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prayer_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid,
    request_text text,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now(),
    church_id uuid,
    offering_amount numeric DEFAULT 0,
    is_anonymous boolean DEFAULT false,
    request text,
    privacy text DEFAULT 'public_to_church'::text NOT NULL,
    CONSTRAINT prayer_requests_privacy_check CHECK ((privacy = ANY (ARRAY['public_to_church'::text, 'private_to_pastor_admin'::text, 'anonymous_public'::text]))),
    CONSTRAINT prayer_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    role text DEFAULT 'member'::text,
    created_at timestamp without time zone DEFAULT now(),
    church_id uuid
);


--
-- Name: qr_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_codes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    type text,
    reference_id uuid,
    qr_data text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action text NOT NULL,
    actor_id uuid,
    scope_key text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: security_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    church_id uuid,
    scope_key text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sermons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sermons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    preacher text,
    date date,
    content text,
    video_url text,
    audio_url text,
    church_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    archived_at timestamp with time zone
);


--
-- Name: super_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.super_admins (
    id uuid NOT NULL
);


--
-- Name: trial_extensions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trial_extensions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    extended_by uuid NOT NULL,
    days_added integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trial_extensions_days_added_check CHECK ((days_added > 0))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role text,
    church_id uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: addons addons_church_id_addon_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addons
    ADD CONSTRAINT addons_church_id_addon_name_key UNIQUE (church_id, addon_name);


--
-- Name: addons addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addons
    ADD CONSTRAINT addons_pkey PRIMARY KEY (id);


--
-- Name: analytics_snapshots analytics_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: app_error_logs app_error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_error_logs
    ADD CONSTRAINT app_error_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_logs automation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_logs
    ADD CONSTRAINT automation_logs_pkey PRIMARY KEY (id);


--
-- Name: automations automations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_pkey PRIMARY KEY (id);


--
-- Name: bible_verses bible_verses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_verses
    ADD CONSTRAINT bible_verses_pkey PRIMARY KEY (id);


--
-- Name: birthday_announcement_automations birthday_announcement_automat_church_id_member_id_automatio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_announcement_automations
    ADD CONSTRAINT birthday_announcement_automat_church_id_member_id_automatio_key UNIQUE (church_id, member_id, automation_date);


--
-- Name: birthday_announcement_automations birthday_announcement_automations_automation_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_announcement_automations
    ADD CONSTRAINT birthday_announcement_automations_automation_key_key UNIQUE (automation_key);


--
-- Name: birthday_announcement_automations birthday_announcement_automations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_announcement_automations
    ADD CONSTRAINT birthday_announcement_automations_pkey PRIMARY KEY (id);


--
-- Name: chat_channel_members chat_channel_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channel_members
    ADD CONSTRAINT chat_channel_members_pkey PRIMARY KEY (channel_id, user_id);


--
-- Name: chat_channels chat_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: church_features church_features_church_id_feature_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.church_features
    ADD CONSTRAINT church_features_church_id_feature_id_key UNIQUE (church_id, feature_id);


--
-- Name: church_features church_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.church_features
    ADD CONSTRAINT church_features_pkey PRIMARY KEY (id);


--
-- Name: church_staff church_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.church_staff
    ADD CONSTRAINT church_staff_pkey PRIMARY KEY (id);


--
-- Name: churches churches_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.churches
    ADD CONSTRAINT churches_code_key UNIQUE (code);


--
-- Name: churches churches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.churches
    ADD CONSTRAINT churches_pkey PRIMARY KEY (id);


--
-- Name: communities communities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_pkey PRIMARY KEY (id);


--
-- Name: community_help community_help_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_help
    ADD CONSTRAINT community_help_pkey PRIMARY KEY (id);


--
-- Name: community_help_requests community_help_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_help_requests
    ADD CONSTRAINT community_help_requests_pkey PRIMARY KEY (id);


--
-- Name: community_leaders community_leaders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_leaders
    ADD CONSTRAINT community_leaders_pkey PRIMARY KEY (id);


--
-- Name: community_targets community_targets_community_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_targets
    ADD CONSTRAINT community_targets_community_id_key UNIQUE (community_id);


--
-- Name: community_targets community_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_targets
    ADD CONSTRAINT community_targets_pkey PRIMARY KEY (id);


--
-- Name: contribution_audit_logs contribution_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contribution_audit_logs
    ADD CONSTRAINT contribution_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: contribution_categories contribution_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contribution_categories
    ADD CONSTRAINT contribution_categories_name_key UNIQUE (name);


--
-- Name: contribution_categories contribution_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contribution_categories
    ADD CONSTRAINT contribution_categories_pkey PRIMARY KEY (id);


--
-- Name: contributions contributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contributions
    ADD CONSTRAINT contributions_pkey PRIMARY KEY (id);


--
-- Name: event_attendances event_attendances_event_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendances
    ADD CONSTRAINT event_attendances_event_id_member_id_key UNIQUE (event_id, member_id);


--
-- Name: event_attendances event_attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendances
    ADD CONSTRAINT event_attendances_pkey PRIMARY KEY (id);


--
-- Name: event_requests event_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_requests
    ADD CONSTRAINT event_requests_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: families families_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_pkey PRIMARY KEY (id);


--
-- Name: groups groups_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_name_key UNIQUE (name);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: help_comments help_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_comments
    ADD CONSTRAINT help_comments_pkey PRIMARY KEY (id);


--
-- Name: help_donations help_donations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_donations
    ADD CONSTRAINT help_donations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_token_key UNIQUE (token);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: invites invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_token_key UNIQUE (token);


--
-- Name: jumuiya jumuiya_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jumuiya
    ADD CONSTRAINT jumuiya_name_key UNIQUE (name);


--
-- Name: jumuiya jumuiya_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jumuiya
    ADD CONSTRAINT jumuiya_pkey PRIMARY KEY (id);


--
-- Name: mass_intentions mass_intentions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mass_intentions
    ADD CONSTRAINT mass_intentions_pkey PRIMARY KEY (id);


--
-- Name: member_communities member_communities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_communities
    ADD CONSTRAINT member_communities_pkey PRIMARY KEY (id);


--
-- Name: member_ministries member_ministries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_ministries
    ADD CONSTRAINT member_ministries_pkey PRIMARY KEY (id);


--
-- Name: member_record_subscriptions member_record_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_record_subscriptions
    ADD CONSTRAINT member_record_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);


--
-- Name: message_templates message_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: ministries ministries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministries
    ADD CONSTRAINT ministries_pkey PRIMARY KEY (id);


--
-- Name: platform_features platform_features_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_features
    ADD CONSTRAINT platform_features_key_key UNIQUE (key);


--
-- Name: platform_features platform_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_features
    ADD CONSTRAINT platform_features_pkey PRIMARY KEY (id);


--
-- Name: platform_fees platform_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_fees
    ADD CONSTRAINT platform_fees_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: pledge_payments pledge_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pledge_payments
    ADD CONSTRAINT pledge_payments_pkey PRIMARY KEY (id);


--
-- Name: pledges pledges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pledges
    ADD CONSTRAINT pledges_pkey PRIMARY KEY (id);


--
-- Name: prayer_request_comments prayer_request_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_request_comments
    ADD CONSTRAINT prayer_request_comments_pkey PRIMARY KEY (id);


--
-- Name: prayer_request_prayers prayer_request_prayers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_request_prayers
    ADD CONSTRAINT prayer_request_prayers_pkey PRIMARY KEY (id);


--
-- Name: prayer_request_prayers prayer_request_prayers_prayer_request_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_request_prayers
    ADD CONSTRAINT prayer_request_prayers_prayer_request_id_member_id_key UNIQUE (prayer_request_id, member_id);


--
-- Name: prayer_requests prayer_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_requests
    ADD CONSTRAINT prayer_requests_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: qr_codes qr_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_codes
    ADD CONSTRAINT qr_codes_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);


--
-- Name: security_audit_events security_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audit_events
    ADD CONSTRAINT security_audit_events_pkey PRIMARY KEY (id);


--
-- Name: sermons sermons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sermons
    ADD CONSTRAINT sermons_pkey PRIMARY KEY (id);


--
-- Name: subscription_payments subscription_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: super_admins super_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_pkey PRIMARY KEY (id);


--
-- Name: trial_extensions trial_extensions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trial_extensions
    ADD CONSTRAINT trial_extensions_pkey PRIMARY KEY (id);


--
-- Name: members unique_family_role_per_member; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT unique_family_role_per_member UNIQUE (id, family_role);


--
-- Name: member_ministries unique_member_ministry; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_ministries
    ADD CONSTRAINT unique_member_ministry UNIQUE (member_id, ministry_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: birthday_announcement_automations_church_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX birthday_announcement_automations_church_date_idx ON public.birthday_announcement_automations USING btree (church_id, automation_date);


--
-- Name: churches_slug_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX churches_slug_unique_idx ON public.churches USING btree (lower(slug)) WHERE (slug IS NOT NULL);


--
-- Name: contribution_audit_logs_church_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contribution_audit_logs_church_created_at_idx ON public.contribution_audit_logs USING btree (church_id, created_at DESC);


--
-- Name: idx_analytics_snapshots_church_type_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_snapshots_church_type_generated ON public.analytics_snapshots USING btree (church_id, snapshot_type, generated_at DESC);


--
-- Name: idx_app_error_logs_church_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_error_logs_church_id ON public.app_error_logs USING btree (church_id);


--
-- Name: idx_app_error_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_error_logs_created_at ON public.app_error_logs USING btree (created_at DESC);


--
-- Name: idx_app_error_logs_dedupe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_error_logs_dedupe ON public.app_error_logs USING btree (message, component, route, created_at DESC);


--
-- Name: idx_app_error_logs_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_error_logs_level ON public.app_error_logs USING btree (level);


--
-- Name: idx_app_error_logs_rate_church; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_error_logs_rate_church ON public.app_error_logs USING btree (church_id, created_at DESC);


--
-- Name: idx_app_error_logs_rate_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_error_logs_rate_session ON public.app_error_logs USING btree (((metadata ->> 'logger_session_id'::text)), created_at DESC);


--
-- Name: idx_app_error_logs_rate_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_error_logs_rate_user ON public.app_error_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_app_error_logs_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_error_logs_resolved ON public.app_error_logs USING btree (resolved);


--
-- Name: idx_app_error_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_error_logs_user_id ON public.app_error_logs USING btree (user_id);


--
-- Name: idx_chat_channel_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_channel_members_user_id ON public.chat_channel_members USING btree (user_id);


--
-- Name: idx_chat_channels_church_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_channels_church_id ON public.chat_channels USING btree (church_id);


--
-- Name: idx_chat_channels_community_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_channels_community_id ON public.chat_channels USING btree (community_id);


--
-- Name: idx_chat_messages_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_channel_id ON public.chat_messages USING btree (channel_id, created_at);


--
-- Name: idx_communities_church_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_communities_church_id ON public.communities USING btree (church_id);


--
-- Name: idx_community_targets_church_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_community_targets_church_id ON public.community_targets USING btree (church_id);


--
-- Name: idx_contributions_church_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contributions_church_created_at ON public.contributions USING btree (church_id, created_at DESC);


--
-- Name: idx_contributions_church_created_at_member_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contributions_church_created_at_member_report ON public.contributions USING btree (church_id, created_at DESC, member_id);


--
-- Name: idx_contributions_church_member_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contributions_church_member_created_at ON public.contributions USING btree (church_id, member_id, created_at DESC);


--
-- Name: idx_contributions_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contributions_member_id ON public.contributions USING btree (member_id);


--
-- Name: idx_event_attendances_church; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_attendances_church ON public.event_attendances USING btree (church_id);


--
-- Name: idx_event_attendances_church_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_attendances_church_created_at ON public.event_attendances USING btree (church_id, created_at DESC);


--
-- Name: idx_event_attendances_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_attendances_event ON public.event_attendances USING btree (event_id);


--
-- Name: idx_event_attendances_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_attendances_event_id ON public.event_attendances USING btree (event_id);


--
-- Name: idx_event_attendances_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_attendances_member ON public.event_attendances USING btree (member_id);


--
-- Name: idx_event_attendances_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_attendances_member_id ON public.event_attendances USING btree (member_id);


--
-- Name: idx_mass_intentions_church_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mass_intentions_church_date ON public.mass_intentions USING btree (church_id, created_at DESC);


--
-- Name: idx_member_communities_community_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_communities_community_id ON public.member_communities USING btree (community_id);


--
-- Name: idx_member_communities_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_communities_member_id ON public.member_communities USING btree (member_id);


--
-- Name: idx_member_ministries_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_ministries_member_id ON public.member_ministries USING btree (member_id);


--
-- Name: idx_member_ministries_ministry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_ministries_ministry_id ON public.member_ministries USING btree (ministry_id);


--
-- Name: idx_member_record_subscriptions_church_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_record_subscriptions_church_id ON public.member_record_subscriptions USING btree (church_id);


--
-- Name: idx_member_record_subscriptions_end_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_record_subscriptions_end_date ON public.member_record_subscriptions USING btree (end_date DESC);


--
-- Name: idx_member_record_subscriptions_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_record_subscriptions_member_id ON public.member_record_subscriptions USING btree (member_id);


--
-- Name: idx_member_record_subscriptions_plan_interval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_record_subscriptions_plan_interval ON public.member_record_subscriptions USING btree (plan_interval);


--
-- Name: idx_member_record_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_record_subscriptions_status ON public.member_record_subscriptions USING btree (status);


--
-- Name: idx_members_church_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_members_church_created_at ON public.members USING btree (church_id, created_at DESC);


--
-- Name: idx_members_church_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_members_church_id ON public.members USING btree (church_id);


--
-- Name: idx_members_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_members_email ON public.members USING btree (email);


--
-- Name: idx_members_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_members_phone ON public.members USING btree (phone);


--
-- Name: idx_message_templates_church_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_templates_church_id ON public.message_templates USING btree (church_id);


--
-- Name: idx_message_templates_church_template_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_templates_church_template_type ON public.message_templates USING btree (church_id, template_type);


--
-- Name: idx_message_templates_type_language; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_templates_type_language ON public.message_templates USING btree (type, language);


--
-- Name: idx_messages_church_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_church_id_created_at ON public.messages USING btree (church_id, created_at DESC);


--
-- Name: idx_pledge_payments_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pledge_payments_member_id ON public.pledge_payments USING btree (member_id);


--
-- Name: idx_pledge_payments_pledge_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pledge_payments_pledge_id ON public.pledge_payments USING btree (pledge_id);


--
-- Name: idx_pledges_church_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pledges_church_id ON public.pledges USING btree (church_id);


--
-- Name: idx_pledges_church_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pledges_church_status_date ON public.pledges USING btree (church_id, status, created_at DESC);


--
-- Name: idx_pledges_community_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pledges_community_id ON public.pledges USING btree (community_id);


--
-- Name: idx_pledges_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pledges_member_id ON public.pledges USING btree (member_id);


--
-- Name: idx_prayer_request_comments_church_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prayer_request_comments_church_id ON public.prayer_request_comments USING btree (church_id);


--
-- Name: idx_prayer_request_comments_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prayer_request_comments_request_id ON public.prayer_request_comments USING btree (prayer_request_id);


--
-- Name: idx_prayer_request_prayers_church_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prayer_request_prayers_church_id ON public.prayer_request_prayers USING btree (church_id);


--
-- Name: idx_prayer_request_prayers_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prayer_request_prayers_request_id ON public.prayer_request_prayers USING btree (prayer_request_id);


--
-- Name: idx_prayer_requests_church_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prayer_requests_church_date ON public.prayer_requests USING btree (church_id, created_at DESC);


--
-- Name: idx_rate_limits_action_scope_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_action_scope_time ON public.rate_limits USING btree (action, scope_key, occurred_at DESC);


--
-- Name: idx_subscription_payments_church_status_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_payments_church_status_created_at ON public.subscription_payments USING btree (church_id, status, created_at DESC);


--
-- Name: message_templates_category_language_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_templates_category_language_idx ON public.message_templates USING btree (category, language);


--
-- Name: message_templates_church_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_templates_church_id_idx ON public.message_templates USING btree (church_id);


--
-- Name: message_templates_type_language_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_templates_type_language_idx ON public.message_templates USING btree (type, language);


--
-- Name: pledge_payments_transaction_id_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pledge_payments_transaction_id_unique_idx ON public.pledge_payments USING btree (lower(btrim(transaction_id))) WHERE (NULLIF(btrim(transaction_id), ''::text) IS NOT NULL);


--
-- Name: security_audit_events_event_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX security_audit_events_event_created_idx ON public.security_audit_events USING btree (event_type, created_at DESC);


--
-- Name: subscription_payments_one_pending_per_church_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subscription_payments_one_pending_per_church_idx ON public.subscription_payments USING btree (church_id) WHERE (status = 'pending'::text);


--
-- Name: subscription_payments_review_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscription_payments_review_queue_idx ON public.subscription_payments USING btree (status, created_at DESC);


--
-- Name: subscriptions_church_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_church_status_idx ON public.subscriptions USING btree (church_id, status);


--
-- Name: subscriptions_one_current_per_church_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subscriptions_one_current_per_church_idx ON public.subscriptions USING btree (church_id) WHERE (status = ANY (ARRAY['active'::text, 'trial'::text]));


--
-- Name: trial_extensions_church_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trial_extensions_church_idx ON public.trial_extensions USING btree (church_id, created_at DESC);


--
-- Name: unique_user_member; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_user_member ON public.members USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: churches create_default_subscription_for_church; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER create_default_subscription_for_church AFTER INSERT ON public.churches FOR EACH ROW EXECUTE FUNCTION public.ensure_default_subscription();


--
-- Name: addons set_addons_updated_at_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_addons_updated_at_before_write BEFORE UPDATE ON public.addons FOR EACH ROW EXECUTE FUNCTION public.set_billing_updated_at();


--
-- Name: churches set_church_join_slug_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_church_join_slug_before_write BEFORE INSERT OR UPDATE OF slug ON public.churches FOR EACH ROW EXECUTE FUNCTION public.set_church_join_slug();


--
-- Name: subscription_payments set_subscription_payments_updated_at_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_subscription_payments_updated_at_before_write BEFORE UPDATE ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION public.set_billing_updated_at();


--
-- Name: subscriptions set_subscriptions_updated_at_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_subscriptions_updated_at_before_write BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_billing_updated_at();


--
-- Name: event_attendances update_event_attendances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_event_attendances_updated_at BEFORE UPDATE ON public.event_attendances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: platform_settings update_platform_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: addons addons_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addons
    ADD CONSTRAINT addons_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: analytics_snapshots analytics_snapshots_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: analytics_snapshots analytics_snapshots_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: app_error_logs app_error_logs_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_error_logs
    ADD CONSTRAINT app_error_logs_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE SET NULL;


--
-- Name: app_error_logs app_error_logs_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_error_logs
    ADD CONSTRAINT app_error_logs_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: app_error_logs app_error_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_error_logs
    ADD CONSTRAINT app_error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: bible_verses bible_verses_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_verses
    ADD CONSTRAINT bible_verses_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id);


--
-- Name: birthday_announcement_automations birthday_announcement_automations_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_announcement_automations
    ADD CONSTRAINT birthday_announcement_automations_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE SET NULL;


--
-- Name: birthday_announcement_automations birthday_announcement_automations_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_announcement_automations
    ADD CONSTRAINT birthday_announcement_automations_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: birthday_announcement_automations birthday_announcement_automations_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_announcement_automations
    ADD CONSTRAINT birthday_announcement_automations_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: chat_channel_members chat_channel_members_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channel_members
    ADD CONSTRAINT chat_channel_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON DELETE CASCADE;


--
-- Name: chat_channel_members chat_channel_members_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channel_members
    ADD CONSTRAINT chat_channel_members_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: chat_channel_members chat_channel_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channel_members
    ADD CONSTRAINT chat_channel_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_channels chat_channels_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: chat_channels chat_channels_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE CASCADE;


--
-- Name: chat_channels chat_channels_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_channels chat_channels_ministry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_ministry_id_fkey FOREIGN KEY (ministry_id) REFERENCES public.ministries(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_sender_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_member_id_fkey FOREIGN KEY (sender_member_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: chat_messages chat_messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: church_features church_features_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.church_features
    ADD CONSTRAINT church_features_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: church_features church_features_feature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.church_features
    ADD CONSTRAINT church_features_feature_id_fkey FOREIGN KEY (feature_id) REFERENCES public.platform_features(id) ON DELETE CASCADE;


--
-- Name: church_staff church_staff_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.church_staff
    ADD CONSTRAINT church_staff_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: churches churches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.churches
    ADD CONSTRAINT churches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: churches churches_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.churches
    ADD CONSTRAINT churches_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: communities communities_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id);


--
-- Name: communities communities_makamu_mwenyekiti_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_makamu_mwenyekiti_id_fkey FOREIGN KEY (makamu_mwenyekiti_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: communities communities_mweka_hazina_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_mweka_hazina_id_fkey FOREIGN KEY (mweka_hazina_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: communities communities_mwenyekiti_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_mwenyekiti_id_fkey FOREIGN KEY (mwenyekiti_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: community_leaders community_leaders_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_leaders
    ADD CONSTRAINT community_leaders_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id);


--
-- Name: community_leaders community_leaders_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_leaders
    ADD CONSTRAINT community_leaders_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id);


--
-- Name: community_leaders community_leaders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_leaders
    ADD CONSTRAINT community_leaders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: community_targets community_targets_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_targets
    ADD CONSTRAINT community_targets_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: community_targets community_targets_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_targets
    ADD CONSTRAINT community_targets_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE CASCADE;


--
-- Name: contribution_audit_logs contribution_audit_logs_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contribution_audit_logs
    ADD CONSTRAINT contribution_audit_logs_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: contribution_audit_logs contribution_audit_logs_contribution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contribution_audit_logs
    ADD CONSTRAINT contribution_audit_logs_contribution_id_fkey FOREIGN KEY (contribution_id) REFERENCES public.contributions(id) ON DELETE SET NULL;


--
-- Name: contributions contributions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contributions
    ADD CONSTRAINT contributions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.contribution_categories(id);


--
-- Name: contributions contributions_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contributions
    ADD CONSTRAINT contributions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: event_attendances event_attendances_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendances
    ADD CONSTRAINT event_attendances_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: event_attendances event_attendances_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendances
    ADD CONSTRAINT event_attendances_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_attendances event_attendances_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendances
    ADD CONSTRAINT event_attendances_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: event_requests event_requests_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_requests
    ADD CONSTRAINT event_requests_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id);


--
-- Name: event_requests event_requests_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_requests
    ADD CONSTRAINT event_requests_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: communities fk_chairperson; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT fk_chairperson FOREIGN KEY (chairperson_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: contributions fk_contributions_church; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contributions
    ADD CONSTRAINT fk_contributions_church FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: contributions fk_contributions_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contributions
    ADD CONSTRAINT fk_contributions_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: invitations fk_invited_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT fk_invited_by FOREIGN KEY (invited_by) REFERENCES auth.users(id);


--
-- Name: communities fk_katibu; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT fk_katibu FOREIGN KEY (katibu_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: communities fk_secretary; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT fk_secretary FOREIGN KEY (secretary_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: communities fk_treasurer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT fk_treasurer FOREIGN KEY (treasurer_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: communities fk_vice_chairperson; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT fk_vice_chairperson FOREIGN KEY (vice_chairperson_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: help_comments help_comments_help_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_comments
    ADD CONSTRAINT help_comments_help_request_id_fkey FOREIGN KEY (help_request_id) REFERENCES public.community_help_requests(id) ON DELETE CASCADE;


--
-- Name: help_comments help_comments_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_comments
    ADD CONSTRAINT help_comments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: help_donations help_donations_help_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_donations
    ADD CONSTRAINT help_donations_help_request_id_fkey FOREIGN KEY (help_request_id) REFERENCES public.community_help_requests(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id);


--
-- Name: invites invites_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: invites invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);


--
-- Name: mass_intentions mass_intentions_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mass_intentions
    ADD CONSTRAINT mass_intentions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: member_communities member_communities_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_communities
    ADD CONSTRAINT member_communities_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE CASCADE;


--
-- Name: member_communities member_communities_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_communities
    ADD CONSTRAINT member_communities_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: member_ministries member_ministries_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_ministries
    ADD CONSTRAINT member_ministries_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: member_ministries member_ministries_ministry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_ministries
    ADD CONSTRAINT member_ministries_ministry_id_fkey FOREIGN KEY (ministry_id) REFERENCES public.ministries(id) ON DELETE CASCADE;


--
-- Name: member_record_subscriptions member_record_subscriptions_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_record_subscriptions
    ADD CONSTRAINT member_record_subscriptions_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: member_record_subscriptions member_record_subscriptions_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_record_subscriptions
    ADD CONSTRAINT member_record_subscriptions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: member_record_subscriptions member_record_subscriptions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_record_subscriptions
    ADD CONSTRAINT member_record_subscriptions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: members members_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: members members_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id);


--
-- Name: members members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: members members_jumuiya_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_jumuiya_fkey FOREIGN KEY (jumuiya_id) REFERENCES public.jumuiya(id) ON DELETE SET NULL;


--
-- Name: members members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: message_templates message_templates_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: messages messages_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: messages messages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ministries ministries_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministries
    ADD CONSTRAINT ministries_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: platform_fees platform_fees_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_fees
    ADD CONSTRAINT platform_fees_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: platform_fees platform_fees_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_fees
    ADD CONSTRAINT platform_fees_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: pledge_payments pledge_payments_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pledge_payments
    ADD CONSTRAINT pledge_payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: pledge_payments pledge_payments_pledge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pledge_payments
    ADD CONSTRAINT pledge_payments_pledge_id_fkey FOREIGN KEY (pledge_id) REFERENCES public.pledges(id) ON DELETE CASCADE;


--
-- Name: pledge_payments pledge_payments_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pledge_payments
    ADD CONSTRAINT pledge_payments_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: pledges pledges_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pledges
    ADD CONSTRAINT pledges_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: pledges pledges_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pledges
    ADD CONSTRAINT pledges_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE SET NULL;


--
-- Name: pledges pledges_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pledges
    ADD CONSTRAINT pledges_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: prayer_request_comments prayer_request_comments_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_request_comments
    ADD CONSTRAINT prayer_request_comments_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: prayer_request_comments prayer_request_comments_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_request_comments
    ADD CONSTRAINT prayer_request_comments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: prayer_request_comments prayer_request_comments_prayer_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_request_comments
    ADD CONSTRAINT prayer_request_comments_prayer_request_id_fkey FOREIGN KEY (prayer_request_id) REFERENCES public.prayer_requests(id) ON DELETE CASCADE;


--
-- Name: prayer_request_prayers prayer_request_prayers_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_request_prayers
    ADD CONSTRAINT prayer_request_prayers_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: prayer_request_prayers prayer_request_prayers_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_request_prayers
    ADD CONSTRAINT prayer_request_prayers_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: prayer_request_prayers prayer_request_prayers_prayer_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_request_prayers
    ADD CONSTRAINT prayer_request_prayers_prayer_request_id_fkey FOREIGN KEY (prayer_request_id) REFERENCES public.prayer_requests(id) ON DELETE CASCADE;


--
-- Name: prayer_requests prayer_requests_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_requests
    ADD CONSTRAINT prayer_requests_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: profiles profiles_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: security_audit_events security_audit_events_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audit_events
    ADD CONSTRAINT security_audit_events_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE SET NULL;


--
-- Name: subscription_payments subscription_payments_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: subscription_payments subscription_payments_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subscription_payments subscription_payments_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: super_admins super_admins_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: trial_extensions trial_extensions_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trial_extensions
    ADD CONSTRAINT trial_extensions_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: trial_extensions trial_extensions_extended_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trial_extensions
    ADD CONSTRAINT trial_extensions_extended_by_fkey FOREIGN KEY (extended_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: chat_channels Admins and community leaders can create chat channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and community leaders can create chat channels" ON public.chat_channels FOR INSERT WITH CHECK ((((owner_scope = 'church_admin'::text) AND (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = chat_channels.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text])))))) OR ((owner_scope = 'community_leader'::text) AND (EXISTS ( SELECT 1
   FROM (public.members m
     JOIN public.communities c ON ((c.id = chat_channels.community_id)))
  WHERE ((m.user_id = auth.uid()) AND (m.church_id = chat_channels.church_id) AND (c.church_id = chat_channels.church_id) AND ((c.chairperson_id = m.id) OR (c.vice_chairperson_id = m.id) OR (c.treasurer_id = m.id) OR (c.secretary_id = m.id) OR (c.katibu_id = m.id))))))));


--
-- Name: member_record_subscriptions Admins can manage record preservation subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage record preservation subscriptions" ON public.member_record_subscriptions TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.super_admins sa
  WHERE (sa.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = member_record_subscriptions.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text, 'admin'::text]))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.super_admins sa
  WHERE (sa.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = member_record_subscriptions.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text, 'admin'::text])))))));


--
-- Name: platform_settings Authenticated users can view platform billing settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view platform billing settings" ON public.platform_settings FOR SELECT TO authenticated USING (true);


--
-- Name: contributions Authorized church users can read contributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authorized church users can read contributions" ON public.contributions FOR SELECT TO authenticated USING ((public.is_church_admin(auth.uid(), church_id) OR public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = contributions.member_id) AND (m.user_id = auth.uid()))))));


--
-- Name: chat_channel_members Channel members can view memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Channel members can view memberships" ON public.chat_channel_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: chat_channel_members Channel owners can add memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Channel owners can add memberships" ON public.chat_channel_members FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.chat_channels c
  WHERE ((c.id = chat_channel_members.channel_id) AND ((c.created_by = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.user_roles ur
          WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = c.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text]))))) OR (EXISTS ( SELECT 1
           FROM (public.members m
             JOIN public.communities community ON ((community.id = c.community_id)))
          WHERE ((m.user_id = auth.uid()) AND (m.church_id = c.church_id) AND (community.church_id = c.church_id) AND ((community.chairperson_id = m.id) OR (community.vice_chairperson_id = m.id) OR (community.treasurer_id = m.id) OR (community.secretary_id = m.id) OR (community.katibu_id = m.id))))))))));


--
-- Name: contribution_audit_logs Church admins and owners can insert contribution audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church admins and owners can insert contribution audit logs" ON public.contribution_audit_logs FOR INSERT WITH CHECK ((public.is_church_admin(auth.uid(), church_id) OR public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.churches
  WHERE ((churches.id = contribution_audit_logs.church_id) AND (churches.created_by = auth.uid()))))));


--
-- Name: contribution_audit_logs Church admins and owners can view contribution audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church admins and owners can view contribution audit logs" ON public.contribution_audit_logs FOR SELECT USING ((public.is_church_admin(auth.uid(), church_id) OR public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.churches
  WHERE ((churches.id = contribution_audit_logs.church_id) AND (churches.created_by = auth.uid()))))));


--
-- Name: analytics_snapshots Church admins can create analytics snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church admins can create analytics snapshots" ON public.analytics_snapshots FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.church_id = analytics_snapshots.church_id) AND (ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text, 'admin'::text]))))));


--
-- Name: messages Church admins can create messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church admins can create messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) AND (public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = messages.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text, 'admin'::text]))))))));


--
-- Name: contributions Church admins can delete contributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church admins can delete contributions" ON public.contributions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = contributions.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text]))))));


--
-- Name: messages Church admins can delete messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church admins can delete messages" ON public.messages FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = messages.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text, 'admin'::text])))))));


--
-- Name: event_attendances Church admins can manage event attendances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church admins can manage event attendances" ON public.event_attendances USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = event_attendances.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = event_attendances.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text]))))));


--
-- Name: event_requests Church admins can manage event requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church admins can manage event requests" ON public.event_requests FOR UPDATE USING (public.is_church_admin(auth.uid(), church_id)) WITH CHECK (public.is_church_admin(auth.uid(), church_id));


--
-- Name: community_help_requests Church admins can manage help requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church admins can manage help requests" ON public.community_help_requests FOR UPDATE USING ((church_id IN ( SELECT ur.church_id
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text])))))) WITH CHECK ((church_id IN ( SELECT ur.church_id
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text]))))));


--
-- Name: contributions Church admins can update contributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church admins can update contributions" ON public.contributions FOR UPDATE TO authenticated USING ((public.is_church_admin(auth.uid(), church_id) OR public.is_super_admin(auth.uid()))) WITH CHECK ((public.is_church_admin(auth.uid(), church_id) OR public.is_super_admin(auth.uid())));


--
-- Name: messages Church admins can update messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church admins can update messages" ON public.messages FOR UPDATE TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = messages.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text, 'admin'::text]))))))) WITH CHECK ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = messages.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text, 'admin'::text])))))));


--
-- Name: church_features Church admins can view own church features; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church admins can view own church features" ON public.church_features FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = church_features.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text]))))));


--
-- Name: event_attendances Church members can create own event attendances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church members can create own event attendances" ON public.event_attendances FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = event_attendances.member_id) AND (m.user_id = auth.uid()) AND (m.church_id = event_attendances.church_id)))));


--
-- Name: prayer_request_prayers Church members can create own prayer marks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church members can create own prayer marks" ON public.prayer_request_prayers FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = prayer_request_prayers.member_id) AND (m.user_id = auth.uid()) AND (m.church_id = prayer_request_prayers.church_id)))));


--
-- Name: prayer_request_comments Church members can create prayer request comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church members can create prayer request comments" ON public.prayer_request_comments FOR INSERT WITH CHECK ((((member_id IS NULL) AND (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = prayer_request_comments.church_id))))) OR (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = prayer_request_comments.member_id) AND (m.user_id = auth.uid()) AND (m.church_id = prayer_request_comments.church_id))))));


--
-- Name: prayer_request_prayers Church members can delete own prayer marks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church members can delete own prayer marks" ON public.prayer_request_prayers FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = prayer_request_prayers.member_id) AND (m.user_id = auth.uid()) AND (m.church_id = prayer_request_prayers.church_id)))));


--
-- Name: event_attendances Church members can update own event attendances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church members can update own event attendances" ON public.event_attendances FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = event_attendances.member_id) AND (m.user_id = auth.uid()) AND (m.church_id = event_attendances.church_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = event_attendances.member_id) AND (m.user_id = auth.uid()) AND (m.church_id = event_attendances.church_id)))));


--
-- Name: church_features Church members can view church features; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church members can view church features" ON public.church_features FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = church_features.church_id)))));


--
-- Name: community_help_requests Church members can view help requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church members can view help requests" ON public.community_help_requests FOR SELECT USING ((church_id IN ( SELECT ur.church_id
   FROM public.user_roles ur
  WHERE (ur.user_id = auth.uid()))));


--
-- Name: event_attendances Church members can view own event attendances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church members can view own event attendances" ON public.event_attendances FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = event_attendances.member_id) AND (m.user_id = auth.uid()) AND (m.church_id = event_attendances.church_id)))) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = event_attendances.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text])))))));


--
-- Name: prayer_request_comments Church members can view prayer request comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church members can view prayer request comments" ON public.prayer_request_comments FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.user_id = auth.uid()) AND (m.church_id = prayer_request_comments.church_id)))) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = prayer_request_comments.church_id))))));


--
-- Name: prayer_request_prayers Church members can view prayer request prayers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church members can view prayer request prayers" ON public.prayer_request_prayers FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.user_id = auth.uid()) AND (m.church_id = prayer_request_prayers.church_id)))) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = prayer_request_prayers.church_id))))));


--
-- Name: messages Church members can view sent messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church members can view sent messages" ON public.messages FOR SELECT TO authenticated USING (((status = 'sent'::text) AND (public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = messages.church_id)))) OR (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.user_id = auth.uid()) AND (m.church_id = messages.church_id)))))));


--
-- Name: addons Church workspace users can view addons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church workspace users can view addons" ON public.addons FOR SELECT TO authenticated USING (public.can_view_church_billing(auth.uid(), church_id));


--
-- Name: members Church workspace users can view members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church workspace users can view members" ON public.members FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.can_view_church_workspace(auth.uid(), church_id)));


--
-- Name: subscriptions Church workspace users can view subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Church workspace users can view subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (public.can_view_church_billing(auth.uid(), church_id));


--
-- Name: help_comments Create help comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Create help comments" ON public.help_comments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.community_help_requests h
  WHERE ((h.id = help_comments.help_request_id) AND (h.church_id IN ( SELECT ur.church_id
           FROM public.user_roles ur
          WHERE (ur.user_id = auth.uid())))))));


--
-- Name: help_donations Create help donations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Create help donations" ON public.help_donations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.community_help_requests h
  WHERE ((h.id = help_donations.help_request_id) AND (h.status = 'approved'::text) AND (h.church_id IN ( SELECT ur.church_id
           FROM public.user_roles ur
          WHERE (ur.user_id = auth.uid())))))));


--
-- Name: platform_fees Create platform fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Create platform fees" ON public.platform_fees FOR INSERT WITH CHECK ((church_id IN ( SELECT ur.church_id
   FROM public.user_roles ur
  WHERE (ur.user_id = auth.uid()))));


--
-- Name: help_comments Delete own help comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Delete own help comments" ON public.help_comments FOR DELETE USING ((member_id IN ( SELECT m.id
   FROM public.members m
  WHERE (m.user_id = auth.uid()))));


--
-- Name: community_help_requests Members can create own help requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can create own help requests" ON public.community_help_requests FOR INSERT WITH CHECK ((member_id IN ( SELECT m.id
   FROM public.members m
  WHERE ((m.user_id = auth.uid()) AND (m.church_id = community_help_requests.church_id)))));


--
-- Name: member_record_subscriptions Members can submit own record preservation subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can submit own record preservation subscriptions" ON public.member_record_subscriptions FOR INSERT TO authenticated WITH CHECK (((status = 'pending'::text) AND (((plan_interval = 'monthly'::text) AND (amount = (3000)::numeric)) OR ((plan_interval = 'yearly'::text) AND (amount = (30000)::numeric))) AND (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = member_record_subscriptions.member_id) AND (m.church_id = member_record_subscriptions.church_id) AND (m.user_id = auth.uid()))))));


--
-- Name: community_help_requests Members can update own help requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can update own help requests" ON public.community_help_requests FOR UPDATE USING ((member_id IN ( SELECT m.id
   FROM public.members m
  WHERE ((m.user_id = auth.uid()) AND (m.church_id = community_help_requests.church_id))))) WITH CHECK ((member_id IN ( SELECT m.id
   FROM public.members m
  WHERE ((m.user_id = auth.uid()) AND (m.church_id = community_help_requests.church_id)))));


--
-- Name: members Members can update own member record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can update own member record" ON public.members FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: member_record_subscriptions Members can view own record preservation subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view own record preservation subscriptions" ON public.member_record_subscriptions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = member_record_subscriptions.member_id) AND (m.user_id = auth.uid())))));


--
-- Name: mass_intentions Members create their own pending mass intentions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members create their own pending mass intentions" ON public.mass_intentions FOR INSERT TO authenticated WITH CHECK (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = mass_intentions.member_id) AND (m.church_id = mass_intentions.church_id) AND (m.user_id = auth.uid()))))));


--
-- Name: prayer_requests Members create their own pending prayers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members create their own pending prayers" ON public.prayer_requests FOR INSERT TO authenticated WITH CHECK (((status = 'pending'::text) AND (privacy = ANY (ARRAY['public_to_church'::text, 'private_to_pastor_admin'::text, 'anonymous_public'::text])) AND (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = prayer_requests.member_id) AND (m.church_id = prayer_requests.church_id) AND (m.user_id = auth.uid()))))));


--
-- Name: prayer_requests Members delete their own pending prayers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members delete their own pending prayers" ON public.prayer_requests FOR DELETE TO authenticated USING (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = prayer_requests.member_id) AND (m.user_id = auth.uid()))))));


--
-- Name: mass_intentions Members edit their own pending mass intentions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members edit their own pending mass intentions" ON public.mass_intentions FOR UPDATE TO authenticated USING (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = mass_intentions.member_id) AND (m.user_id = auth.uid())))))) WITH CHECK (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = mass_intentions.member_id) AND (m.user_id = auth.uid()))))));


--
-- Name: prayer_requests Members edit their own pending prayers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members edit their own pending prayers" ON public.prayer_requests FOR UPDATE TO authenticated USING (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = prayer_requests.member_id) AND (m.user_id = auth.uid())))))) WITH CHECK (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = prayer_requests.member_id) AND (m.user_id = auth.uid()))))));


--
-- Name: prayer_requests Members read approved shared prayers or their own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members read approved shared prayers or their own" ON public.prayer_requests FOR SELECT TO authenticated USING ((public.can_review_pastoral_requests(church_id) OR (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = prayer_requests.member_id) AND (m.user_id = auth.uid())))) OR ((status = 'approved'::text) AND (privacy = ANY (ARRAY['public_to_church'::text, 'anonymous_public'::text])) AND public.is_church_member(auth.uid(), church_id))));


--
-- Name: mass_intentions Members read their own mass intentions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members read their own mass intentions" ON public.mass_intentions FOR SELECT TO authenticated USING ((public.can_review_pastoral_requests(church_id) OR (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = mass_intentions.member_id) AND (m.user_id = auth.uid()))))));


--
-- Name: prayer_requests Pastoral reviewers manage church prayers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Pastoral reviewers manage church prayers" ON public.prayer_requests FOR UPDATE TO authenticated USING (public.can_review_pastoral_requests(church_id)) WITH CHECK (public.can_review_pastoral_requests(church_id));


--
-- Name: mass_intentions Pastoral reviewers manage mass intentions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Pastoral reviewers manage mass intentions" ON public.mass_intentions FOR UPDATE TO authenticated USING (public.can_review_pastoral_requests(church_id)) WITH CHECK (public.can_review_pastoral_requests(church_id));


--
-- Name: app_error_logs Platform super admins can read app error logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform super admins can read app error logs" ON public.app_error_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.super_admins sa
  WHERE (sa.id = auth.uid()))));


--
-- Name: subscription_payments Super admins can manage subscription payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage subscription payments" ON public.subscription_payments TO authenticated USING (public.is_platform_super_admin(auth.uid())) WITH CHECK (public.is_platform_super_admin(auth.uid()));


--
-- Name: subscriptions Super admins can manage subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage subscriptions" ON public.subscriptions TO authenticated USING (public.is_platform_super_admin(auth.uid())) WITH CHECK (public.is_platform_super_admin(auth.uid()));


--
-- Name: trial_extensions Super admins can manage trial extensions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage trial extensions" ON public.trial_extensions TO authenticated USING (public.is_platform_super_admin(auth.uid())) WITH CHECK (public.is_platform_super_admin(auth.uid()));


--
-- Name: platform_settings Super admins manage platform settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins manage platform settings" ON public.platform_settings TO authenticated USING (public.is_platform_super_admin(auth.uid())) WITH CHECK (public.is_platform_super_admin(auth.uid()));


--
-- Name: churches Users can create their own church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own church" ON public.churches FOR INSERT WITH CHECK ((auth.uid() = owner_id));


--
-- Name: churches Users can see their church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see their church" ON public.churches FOR SELECT USING ((id IN ( SELECT members.church_id
   FROM public.members
  WHERE (members.user_id = auth.uid()))));


--
-- Name: user_roles Users can see their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see their own roles" ON public.user_roles FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: profiles Users can see their profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see their profile" ON public.profiles FOR SELECT USING ((id = auth.uid()));


--
-- Name: chat_messages Users can send channel messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can send channel messages" ON public.chat_messages FOR INSERT WITH CHECK (((sender_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.chat_channel_members m
  WHERE ((m.channel_id = chat_messages.channel_id) AND (m.user_id = auth.uid()))))));


--
-- Name: chat_channels Users can view accessible chat channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view accessible chat channels" ON public.chat_channels FOR SELECT USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.chat_channel_members m
  WHERE ((m.channel_id = chat_channels.id) AND (m.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = chat_channels.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text]))))) OR (EXISTS ( SELECT 1
   FROM (public.members m
     JOIN public.communities c ON ((c.id = chat_channels.community_id)))
  WHERE ((m.user_id = auth.uid()) AND (m.church_id = chat_channels.church_id) AND (c.church_id = chat_channels.church_id) AND ((c.chairperson_id = m.id) OR (c.vice_chairperson_id = m.id) OR (c.treasurer_id = m.id) OR (c.secretary_id = m.id) OR (c.katibu_id = m.id)))))));


--
-- Name: community_targets Users can view accessible community targets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view accessible community targets" ON public.community_targets FOR SELECT USING ((public.is_pledge_admin_for_church(church_id) OR public.is_pledge_leader_for_community(community_id)));


--
-- Name: pledge_payments Users can view accessible pledge payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view accessible pledge payments" ON public.pledge_payments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.pledges p
  WHERE ((p.id = pledge_payments.pledge_id) AND (public.is_pledge_owner(p.member_id) OR public.is_pledge_admin_for_church(p.church_id) OR ((p.community_id IS NOT NULL) AND public.is_pledge_leader_for_community(p.community_id)))))));


--
-- Name: pledges Users can view accessible pledges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view accessible pledges" ON public.pledges FOR SELECT TO authenticated USING ((public.is_pledge_owner(member_id) OR public.is_pledge_admin_for_church(church_id) OR ((community_id IS NOT NULL) AND public.is_pledge_leader_for_community(community_id))));


--
-- Name: chat_messages Users can view channel messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view channel messages" ON public.chat_messages FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.chat_channel_members m
  WHERE ((m.channel_id = chat_messages.channel_id) AND (m.user_id = auth.uid())))) OR (sender_user_id = auth.uid())));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: churches Users can view their own church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own church" ON public.churches FOR SELECT USING ((auth.uid() = owner_id));


--
-- Name: event_requests Users manage own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own requests" ON public.event_requests FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = event_requests.member_id) AND (m.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = event_requests.member_id) AND (m.user_id = auth.uid())))));


--
-- Name: help_comments View help comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View help comments" ON public.help_comments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.community_help_requests h
  WHERE ((h.id = help_comments.help_request_id) AND (h.church_id IN ( SELECT ur.church_id
           FROM public.user_roles ur
          WHERE (ur.user_id = auth.uid())))))));


--
-- Name: help_donations View help donations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View help donations" ON public.help_donations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.community_help_requests h
  WHERE ((h.id = help_donations.help_request_id) AND (h.church_id IN ( SELECT ur.church_id
           FROM public.user_roles ur
          WHERE (ur.user_id = auth.uid())))))));


--
-- Name: platform_fees View platform fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View platform fees" ON public.platform_fees FOR SELECT USING ((church_id IN ( SELECT ur.church_id
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text]))))));


--
-- Name: addons Workspace managers can manage addons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace managers can manage addons" ON public.addons TO authenticated USING (public.can_manage_church_workspace(auth.uid(), church_id)) WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id));


--
-- Name: communities Workspace managers can manage communities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace managers can manage communities" ON public.communities TO authenticated USING (public.can_manage_church_workspace(auth.uid(), church_id)) WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id));


--
-- Name: families Workspace managers can manage families; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace managers can manage families" ON public.families TO authenticated USING (public.can_manage_church_workspace(auth.uid(), church_id)) WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id));


--
-- Name: invitations Workspace managers can manage invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace managers can manage invitations" ON public.invitations TO authenticated USING (public.can_manage_church_workspace(auth.uid(), church_id)) WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id));


--
-- Name: member_communities Workspace managers can manage member communities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace managers can manage member communities" ON public.member_communities TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.communities c
  WHERE ((c.id = member_communities.community_id) AND public.can_manage_church_workspace(auth.uid(), c.church_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.communities c
  WHERE ((c.id = member_communities.community_id) AND public.can_manage_church_workspace(auth.uid(), c.church_id)))));


--
-- Name: member_ministries Workspace managers can manage member ministries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace managers can manage member ministries" ON public.member_ministries TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ministries m
  WHERE ((m.id = member_ministries.ministry_id) AND public.can_manage_church_workspace(auth.uid(), m.church_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ministries m
  WHERE ((m.id = member_ministries.ministry_id) AND public.can_manage_church_workspace(auth.uid(), m.church_id)))));


--
-- Name: members Workspace managers can manage members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace managers can manage members" ON public.members TO authenticated USING (public.can_manage_church_workspace(auth.uid(), church_id)) WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id));


--
-- Name: ministries Workspace managers can manage ministries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace managers can manage ministries" ON public.ministries TO authenticated USING (public.can_manage_church_workspace(auth.uid(), church_id)) WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id));


--
-- Name: analytics_snapshots Workspace managers can read analytics snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace managers can read analytics snapshots" ON public.analytics_snapshots FOR SELECT TO authenticated USING ((public.is_church_admin(auth.uid(), church_id) OR public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.churches c
  WHERE ((c.id = analytics_snapshots.church_id) AND (c.created_by = auth.uid()))))));


--
-- Name: subscription_payments Workspace managers can submit subscription payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace managers can submit subscription payments" ON public.subscription_payments FOR INSERT TO authenticated WITH CHECK (((requested_by = auth.uid()) AND (status = 'pending'::text) AND (verified_by IS NULL) AND (verified_at IS NULL) AND public.can_manage_church_workspace(auth.uid(), church_id) AND (amount = (
CASE plan
    WHEN 'basic'::text THEN 50000
    WHEN 'intermediate'::text THEN 80000
    WHEN 'pro'::text THEN 120000
    WHEN 'enterprise'::text THEN 150000
    ELSE NULL::integer
END)::numeric)));


--
-- Name: subscription_payments Workspace managers can view subscription payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace managers can view subscription payments" ON public.subscription_payments FOR SELECT TO authenticated USING (public.can_manage_church_workspace(auth.uid(), church_id));


--
-- Name: addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles admin can view profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin can view profiles" ON public.profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::text)))));


--
-- Name: church_features admin manage church features; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage church features" ON public.church_features USING ((auth.uid() IN ( SELECT super_admins.id
   FROM public.super_admins)));


--
-- Name: invitations admin manage invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage invitations" ON public.invitations USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::text) AND (ur.church_id = invitations.church_id)))));


--
-- Name: audit_logs admin only audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin only audit logs" ON public.audit_logs FOR SELECT USING ((auth.uid() IN ( SELECT super_admins.id
   FROM public.super_admins)));


--
-- Name: churches admin update church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin update church" ON public.churches FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::text) AND (ur.church_id = churches.id)))));


--
-- Name: churches allow_authenticated_delete_own_church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_authenticated_delete_own_church ON public.churches FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = created_by));


--
-- Name: churches allow_authenticated_insert_own_church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_authenticated_insert_own_church ON public.churches FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = created_by));


--
-- Name: churches allow_authenticated_select_own_church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_authenticated_select_own_church ON public.churches FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = created_by));


--
-- Name: churches allow_authenticated_update_own_church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_authenticated_update_own_church ON public.churches FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = created_by)) WITH CHECK ((( SELECT auth.uid() AS uid) = created_by));


--
-- Name: analytics_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements announcements same church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "announcements same church" ON public.announcements FOR SELECT USING ((church_id = public.get_user_church_id()));


--
-- Name: app_error_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_channels chat channels same church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat channels same church" ON public.chat_channels FOR SELECT USING ((church_id IN ( SELECT members.church_id
   FROM public.members
  WHERE (members.user_id = auth.uid()))));


--
-- Name: chat_channel_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: church_features; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.church_features ENABLE ROW LEVEL SECURITY;

--
-- Name: prayer_request_comments comments same church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "comments same church" ON public.prayer_request_comments FOR SELECT USING ((member_id IN ( SELECT members.id
   FROM public.members
  WHERE (members.church_id = public.get_user_church_id()))));


--
-- Name: communities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

--
-- Name: communities communities same church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "communities same church" ON public.communities FOR SELECT USING ((church_id IN ( SELECT members.church_id
   FROM public.members
  WHERE (members.user_id = auth.uid()))));


--
-- Name: community_help; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.community_help ENABLE ROW LEVEL SECURITY;

--
-- Name: community_help_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.community_help_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: community_targets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.community_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: contribution_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contribution_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: contribution_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contribution_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: contributions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages delete own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete own messages" ON public.chat_messages FOR DELETE USING ((sender_user_id = auth.uid()));


--
-- Name: chat_messages edit own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "edit own messages" ON public.chat_messages FOR UPDATE USING ((sender_user_id = auth.uid()));


--
-- Name: event_requests event requests same church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "event requests same church" ON public.event_requests FOR SELECT USING ((church_id = public.get_user_church_id()));


--
-- Name: event_attendances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_attendances ENABLE ROW LEVEL SECURITY;

--
-- Name: event_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: events events same church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "events same church" ON public.events FOR SELECT USING ((church_id IN ( SELECT members.church_id
   FROM public.members
  WHERE (members.user_id = auth.uid()))));


--
-- Name: families; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

--
-- Name: community_help_requests help requests same church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "help requests same church" ON public.community_help_requests FOR SELECT USING ((church_id = public.get_user_church_id()));


--
-- Name: help_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.help_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: help_donations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.help_donations ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements insert announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert announcements" ON public.announcements FOR INSERT WITH CHECK (((church_id = public.get_user_church_id()) AND (created_by = auth.uid())));


--
-- Name: event_requests insert own event request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert own event request" ON public.event_requests FOR INSERT WITH CHECK ((member_id IN ( SELECT members.id
   FROM public.members
  WHERE (members.user_id = auth.uid()))));


--
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

--
-- Name: jumuiya; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jumuiya ENABLE ROW LEVEL SECURITY;

--
-- Name: mass_intentions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mass_intentions ENABLE ROW LEVEL SECURITY;

--
-- Name: member_communities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_communities ENABLE ROW LEVEL SECURITY;

--
-- Name: member_ministries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_ministries ENABLE ROW LEVEL SECURITY;

--
-- Name: member_record_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_record_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

--
-- Name: message_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: message_templates message_templates_manage_by_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_templates_manage_by_role ON public.message_templates TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((church_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = message_templates.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text, 'admin'::text])))))))) WITH CHECK ((public.is_super_admin(auth.uid()) OR ((church_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = message_templates.church_id) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text, 'admin'::text]))))))));


--
-- Name: message_templates message_templates_select_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_templates_select_access ON public.message_templates FOR SELECT TO authenticated USING (((church_id IS NULL) OR public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.church_id = message_templates.church_id)))) OR (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.user_id = auth.uid()) AND (m.church_id = message_templates.church_id))))));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: ministries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;

--
-- Name: pledge_payments payments same church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payments same church" ON public.pledge_payments FOR SELECT USING ((pledge_id IN ( SELECT pledges.id
   FROM public.pledges
  WHERE (pledges.church_id = public.get_user_church_id()))));


--
-- Name: platform_features; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_features ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: pledge_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pledge_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: pledges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;

--
-- Name: prayer_request_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prayer_request_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: prayer_request_prayers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prayer_request_prayers ENABLE ROW LEVEL SECURITY;

--
-- Name: prayer_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: contribution_categories read categories safe; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read categories safe" ON public.contribution_categories FOR SELECT USING (true);


--
-- Name: chat_messages read messages in own channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read messages in own channels" ON public.chat_messages FOR SELECT USING ((channel_id IN ( SELECT chat_channel_members.channel_id
   FROM public.chat_channel_members
  WHERE (chat_channel_members.user_id = auth.uid()))));


--
-- Name: audit_logs safe audit insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "safe audit insert" ON public.audit_logs FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: security_audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages send message as self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "send message as self" ON public.chat_messages FOR INSERT WITH CHECK (((sender_user_id = auth.uid()) AND (channel_id IN ( SELECT chat_channel_members.channel_id
   FROM public.chat_channel_members
  WHERE (chat_channel_members.user_id = auth.uid())))));


--
-- Name: user_roles simple_user_roles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY simple_user_roles_select ON public.user_roles FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: subscription_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_features super admin manage features; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "super admin manage features" ON public.platform_features USING ((auth.uid() IN ( SELECT super_admins.id
   FROM public.super_admins)));


--
-- Name: platform_settings super admin only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "super admin only" ON public.platform_settings USING ((auth.uid() IN ( SELECT super_admins.id
   FROM public.super_admins)));


--
-- Name: platform_settings super admin only settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "super admin only settings" ON public.platform_settings USING ((auth.uid() IN ( SELECT super_admins.id
   FROM public.super_admins)));


--
-- Name: trial_extensions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trial_extensions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles user can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user can update own profile" ON public.profiles FOR UPDATE USING ((id = auth.uid()));


--
-- Name: profiles user can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user can view own profile" ON public.profiles FOR SELECT USING ((id = auth.uid()));


--
-- Name: churches user sees own church; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user sees own church" ON public.churches FOR SELECT USING ((id = public.get_user_church_id()));


--
-- Name: chat_channel_members user sees own memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user sees own memberships" ON public.chat_channel_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
