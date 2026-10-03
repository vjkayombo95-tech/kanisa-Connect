-- Add externally hosted announcement image references.
-- Image bytes live in Cloudflare R2; Supabase stores only the durable object key.

alter table public.announcements
  add column if not exists image_key text;

-- Replace the current save RPC with the image-aware contract.
drop function if exists public.save_church_announcement(
  uuid,
  uuid,
  text,
  text,
  boolean,
  timestamptz,
  timestamptz,
  text,
  boolean,
  text[],
  text,
  text,
  boolean,
  text,
  text,
  boolean,
  text
);

create or replace function public.save_church_announcement(
  _announcement_id uuid,
  _church_id uuid,
  _title text,
  _content text,
  _is_published boolean default false,
  _publish_at timestamptz default null,
  _expires_at timestamptz default null,
  _timezone text default 'Africa/Nairobi',
  _never_expires boolean default false,
  _audience text[] default array['everyone']::text[],
  _target_ministry text default null,
  _target_community text default null,
  _show_on_calendar boolean default false,
  _notification_strategy text default 'none',
  _category text default 'general',
  _featured boolean default false,
  _community_audience text default 'all',
  _image_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_publish_at timestamptz := _publish_at;
  v_is_published boolean := coalesce(_is_published, false);
  v_target_community text := nullif(trim(coalesce(_target_community, '')), '');
  v_community_audience text := lower(trim(coalesce(_community_audience, 'all')));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if _church_id is null
     or nullif(trim(coalesce(_title, '')), '') is null
     or nullif(trim(coalesce(_content, '')), '') is null then
    raise exception 'Missing announcement fields' using errcode = '22023';
  end if;

  if not public.can_manage_church_roles(auth.uid(), _church_id) then
    raise exception 'You do not have permission to manage announcements for this church'
      using errcode = '42501';
  end if;

  if v_community_audience not in ('all', 'leaders') then
    raise exception 'Invalid community audience'
      using errcode = '22023';
  end if;

  -- Leader-only has meaning only when a community is actually targeted.
  if v_target_community is null then
    v_community_audience := 'all';
  end if;

  if v_is_published and v_publish_at is null then
    v_publish_at := now();
  end if;

  if _announcement_id is null then
    insert into public.announcements (
      church_id,
      title,
      content,
      is_published,
      published_at,
      created_by,
      publish_at,
      expires_at,
      timezone,
      never_expires,
      audience,
      target_ministry,
      target_community,
      community_audience,
      image_key,
      show_on_calendar,
      notification_strategy,
      category,
      featured
    )
    values (
      _church_id,
      trim(_title),
      trim(_content),
      v_is_published,
      case when v_is_published then v_publish_at else null end,
      auth.uid(),
      v_publish_at,
      case when coalesce(_never_expires, false) then null else _expires_at end,
      coalesce(nullif(trim(_timezone), ''), 'Africa/Nairobi'),
      coalesce(_never_expires, false),
      coalesce(_audience, array['everyone']::text[]),
      nullif(trim(coalesce(_target_ministry, '')), ''),
      v_target_community,
      v_community_audience,
      nullif(trim(coalesce(_image_key, '')), ''),
      coalesce(_show_on_calendar, false),
      coalesce(nullif(trim(_notification_strategy), ''), 'none'),
      coalesce(nullif(trim(_category), ''), 'general'),
      coalesce(_featured, false)
    )
    returning id into v_id;
  else
    update public.announcements
    set
      title = trim(_title),
      content = trim(_content),
      is_published = v_is_published,
      published_at = case
        when v_is_published then coalesce(published_at, v_publish_at, now())
        else null
      end,
      archived_at = null,
      publish_at = v_publish_at,
      expires_at = case
        when coalesce(_never_expires, false) then null
        else _expires_at
      end,
      timezone = coalesce(nullif(trim(_timezone), ''), 'Africa/Nairobi'),
      never_expires = coalesce(_never_expires, false),
      audience = coalesce(_audience, array['everyone']::text[]),
      target_ministry = nullif(trim(coalesce(_target_ministry, '')), ''),
      target_community = v_target_community,
      community_audience = v_community_audience,
      image_key = nullif(trim(coalesce(_image_key, '')), ''),
      show_on_calendar = coalesce(_show_on_calendar, false),
      notification_strategy = coalesce(nullif(trim(_notification_strategy), ''), 'none'),
      category = coalesce(nullif(trim(_category), ''), 'general'),
      featured = coalesce(_featured, false)
    where id = _announcement_id
      and church_id = _church_id
    returning id into v_id;
  end if;

  if v_id is null then
    raise exception 'Announcement was not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;

revoke all on function public.save_church_announcement(
  uuid,
  uuid,
  text,
  text,
  boolean,
  timestamptz,
  timestamptz,
  text,
  boolean,
  text[],
  text,
  text,
  boolean,
  text,
  text,
  boolean,
  text,
  text
)
from public, anon;

grant execute on function public.save_church_announcement(
  uuid,
  uuid,
  text,
  text,
  boolean,
  timestamptz,
  timestamptz,
  text,
  boolean,
  text[],
  text,
  text,
  boolean,
  text,
  text,
  boolean,
  text,
  text
)
to authenticated;

-- The portal RPC return shape changes because image_key is now returned.
drop function if exists public.get_portal_announcements(uuid, integer);
create or replace function public.get_portal_announcements(
  _church_id uuid,
  _limit integer default 50
)
returns table (
  id uuid,
  church_id uuid,
  title text,
  content text,
  is_published boolean,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz,
  status text,
  featured boolean,
  publish_at timestamptz,
  expires_at timestamptz,
  audience text[],
  category text,
  show_on_calendar boolean,
  image_key text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_email text;
begin
  if auth.uid() is null or _church_id is null then
    return;
  end if;

  select email
  into v_user_email
  from auth.users au
  where au.id = auth.uid();

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
            v_user_email is not null
            and m.email is not null
            and lower(trim(m.email)) = lower(trim(v_user_email))
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
    true as is_published,
    case
      when a.published_at is not null then a.published_at at time zone 'UTC'
      else a.publish_at
    end as published_at,
    a.created_by,
    a.created_at at time zone 'UTC' as created_at,
    a.updated_at,
    a.archived_at,
    case when a.featured then 'featured' else 'active' end as status,
    a.featured,
    a.publish_at,
    a.expires_at,
    a.audience,
    a.category,
    a.show_on_calendar,
    a.image_key
  from public.announcements a
  where a.church_id = _church_id
    and a.archived_at is null
    and (
      (
        a.is_published = true
        and a.status in ('active', 'featured')
      )
      or (
        a.is_published = false
        and a.status = 'scheduled'
        and a.publish_at is not null
        and a.publish_at <= now()
      )
    )
    and (a.publish_at is null or a.publish_at <= now())
    and (a.never_expires = true or a.expires_at is null or a.expires_at > now())

    and (
      'everyone' = any(a.audience)
      or 'members' = any(a.audience)
      or exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.church_id = a.church_id
          and lower(ur.role::text) = any(a.audience)
      )
    )

    and (
      nullif(trim(a.target_ministry), '') is null
      or exists (
        select 1
        from public.members m
        join public.member_ministries mm
          on mm.member_id = m.id
        join public.ministries ministry
          on ministry.id = mm.ministry_id
        where m.church_id = a.church_id
          and ministry.church_id = a.church_id
          and lower(trim(ministry.name)) = lower(trim(a.target_ministry))
          and (
            m.user_id = auth.uid()
            or (
              v_user_email is not null
              and m.email is not null
              and lower(trim(m.email)) = lower(trim(v_user_email))
            )
          )
      )
    )

    and (
      nullif(trim(a.target_community), '') is null

      or (
        coalesce(a.community_audience, 'all') = 'all'
        and exists (
          select 1
          from public.members m
          join public.member_communities mc
            on mc.member_id = m.id
          join public.communities community
            on community.id = mc.community_id
          where m.church_id = a.church_id
            and community.church_id = a.church_id
            and lower(trim(community.name)) = lower(trim(a.target_community))
            and (
              m.user_id = auth.uid()
              or (
                v_user_email is not null
                and m.email is not null
                and lower(trim(m.email)) = lower(trim(v_user_email))
              )
            )
        )
      )

      or (
        coalesce(a.community_audience, 'all') = 'leaders'
        and exists (
          select 1
          from public.members m
          join public.communities community
            on community.church_id = a.church_id
           and lower(trim(community.name)) = lower(trim(a.target_community))
          where m.church_id = a.church_id
            and (
              m.user_id = auth.uid()
              or (
                v_user_email is not null
                and m.email is not null
                and lower(trim(m.email)) = lower(trim(v_user_email))
              )
            )
            and (
              community.mwenyekiti_id = m.id
              or community.makamu_mwenyekiti_id = m.id
              or community.katibu_id = m.id
              or community.mweka_hazina_id = m.id
            )
        )
      )
    )

  order by
    a.featured desc,
    coalesce(
      a.publish_at,
      a.published_at at time zone 'UTC',
      a.created_at at time zone 'UTC'
    ) desc
  limit greatest(coalesce(_limit, 50), 1);
end;
$$;

revoke all on function public.get_portal_announcements(uuid, integer)
from public, anon;

grant execute on function public.get_portal_announcements(uuid, integer)
to authenticated;





