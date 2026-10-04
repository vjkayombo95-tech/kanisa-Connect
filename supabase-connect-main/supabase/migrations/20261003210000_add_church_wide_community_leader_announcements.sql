-- Add church-wide community leader announcement targeting.
-- The audience token 'community_leaders' targets leaders in any community
-- belonging to the announcement church. Specific community leader targeting
-- continues to use target_community + community_audience = 'leaders'.

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
      or (
        'community_leaders' = any(a.audience)
        and exists (
          select 1
          from public.members m
          join public.communities community
            on community.church_id = a.church_id
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
