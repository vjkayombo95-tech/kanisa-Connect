-- RC-2.9.1: fix Church Admin Events SELECT regression after audience targeting.
--
-- 20260704131000 replaced the direct Church Admin SELECT policy with a policy
-- that calls can_view_event(auth.uid(), id). That helper reads public.events
-- again, which is unsafe as the events table's own RLS predicate and can surface
-- as a PostgREST 403. Keep the same authorization model, but evaluate the
-- current events row directly from the policy.

create or replace function public.can_view_event_for_row(
  _user_id uuid,
  _event_id uuid,
  _church_id uuid,
  _visibility text,
  _audience_mode text,
  _archived_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null
    and _event_id is not null
    and _church_id is not null
    and _archived_at is null
    and (
      public.can_manage_church_roles(_user_id, _church_id)
      or public.can_manage_church_workspace(_user_id, _church_id)
      or public.is_platform_super_admin(_user_id)
      or public.is_super_admin(_user_id)
      or exists (
        select 1
        from public.members m
        where m.church_id = _church_id
          and coalesce(m.status, 'active') = 'active'
          and (
            m.user_id = _user_id
            or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
          and coalesce(_visibility, 'public') in ('public', 'member')
          and (
            coalesce(_audience_mode, 'everyone') in ('everyone', 'all_members')
            or (
              coalesce(_audience_mode, 'everyone') = 'specific_groups'
              and exists (
                select 1
                from public.event_audience_targets eat
                where eat.event_id = _event_id
                  and eat.church_id = _church_id
                  and (
                    (
                      eat.ministry_id is not null
                      and (
                        m.ministry_id = eat.ministry_id
                        or exists (
                          select 1
                          from public.member_ministries mm
                          where mm.member_id = m.id
                            and mm.ministry_id = eat.ministry_id
                        )
                      )
                    )
                    or (
                      eat.community_id is not null
                      and (
                        m.community_id = eat.community_id
                        or m.jumuiya_id = eat.community_id
                        or exists (
                          select 1
                          from public.member_communities mc
                          where mc.member_id = m.id
                            and mc.community_id = eat.community_id
                        )
                      )
                    )
                  )
              )
            )
          )
      )
    );
$$;

create or replace function public.can_view_event(_user_id uuid, _event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = _event_id
      and public.can_view_event_for_row(
        _user_id,
        e.id,
        e.church_id,
        e.visibility,
        e.audience_mode,
        e.archived_at
      )
  );
$$;

drop policy if exists "Authorized users can select targeted events" on public.events;
create policy "Authorized users can select targeted events"
on public.events
for select
to authenticated
using (
  public.can_view_event_for_row(
    auth.uid(),
    id,
    church_id,
    visibility,
    audience_mode,
    archived_at
  )
);

drop policy if exists "Event audience targets visible with event access" on public.event_audience_targets;
create policy "Event audience targets visible to authorized members"
on public.event_audience_targets
for select
to authenticated
using (
  public.can_manage_church_roles(auth.uid(), church_id)
  or public.can_manage_church_workspace(auth.uid(), church_id)
  or public.is_platform_super_admin(auth.uid())
  or public.is_super_admin(auth.uid())
  or exists (
    select 1
    from public.members m
    where m.church_id = event_audience_targets.church_id
      and coalesce(m.status, 'active') = 'active'
      and (
        m.user_id = auth.uid()
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      and (
        (
          event_audience_targets.ministry_id is not null
          and (
            m.ministry_id = event_audience_targets.ministry_id
            or exists (
              select 1
              from public.member_ministries mm
              where mm.member_id = m.id
                and mm.ministry_id = event_audience_targets.ministry_id
            )
          )
        )
        or (
          event_audience_targets.community_id is not null
          and (
            m.community_id = event_audience_targets.community_id
            or m.jumuiya_id = event_audience_targets.community_id
            or exists (
              select 1
              from public.member_communities mc
              where mc.member_id = m.id
                and mc.community_id = event_audience_targets.community_id
            )
          )
        )
      )
  )
);

grant execute on function public.can_view_event_for_row(uuid, uuid, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.can_view_event(uuid, uuid) to authenticated;
