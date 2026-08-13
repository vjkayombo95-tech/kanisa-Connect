-- RC-2.7.7: Event audience targeting for parish calendar events.
-- Audience belongs to the parent event; recurring generated occurrences inherit
-- access from the authorized parent event and do not create duplicate rows.

alter table public.events
  add column if not exists audience_mode text not null default 'everyone';

alter table public.events
  drop constraint if exists events_audience_mode_check,
  add constraint events_audience_mode_check
    check (audience_mode in ('everyone', 'all_members', 'specific_groups'));

create table if not exists public.event_audience_targets (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  ministry_id uuid references public.ministries(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_audience_targets_one_target_check
    check (
      (ministry_id is not null and community_id is null)
      or (ministry_id is null and community_id is not null)
    )
);

create unique index if not exists event_audience_targets_ministry_unique
  on public.event_audience_targets(event_id, ministry_id)
  where ministry_id is not null;

create unique index if not exists event_audience_targets_community_unique
  on public.event_audience_targets(event_id, community_id)
  where community_id is not null;

create index if not exists idx_event_audience_targets_event
  on public.event_audience_targets(event_id);

create index if not exists idx_event_audience_targets_church_ministry
  on public.event_audience_targets(church_id, ministry_id)
  where ministry_id is not null;

create index if not exists idx_event_audience_targets_church_community
  on public.event_audience_targets(church_id, community_id)
  where community_id is not null;

create or replace function public.validate_event_audience_target_church()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.events e
    where e.id = new.event_id
      and e.church_id = new.church_id
  ) then
    raise exception 'Event audience target must belong to the same church as the event'
      using errcode = '23514';
  end if;

  if new.ministry_id is not null and not exists (
    select 1
    from public.ministries m
    where m.id = new.ministry_id
      and m.church_id = new.church_id
  ) then
    raise exception 'Event audience ministry must belong to the same church as the event'
      using errcode = '23514';
  end if;

  if new.community_id is not null and not exists (
    select 1
    from public.communities c
    where c.id = new.community_id
      and c.church_id = new.church_id
  ) then
    raise exception 'Event audience community must belong to the same church as the event'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_event_audience_target_church on public.event_audience_targets;
create trigger validate_event_audience_target_church
before insert or update on public.event_audience_targets
for each row execute function public.validate_event_audience_target_church();

create or replace function public.can_view_event(_user_id uuid, _event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with event_row as (
    select e.*
    from public.events e
    where e.id = _event_id
      and e.archived_at is null
  ),
  current_members as (
    select m.*
    from public.members m
    join event_row e on e.church_id = m.church_id
    where coalesce(m.status, 'active') = 'active'
      and (
        m.user_id = _user_id
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
  select exists (
    select 1
    from event_row e
    where public.can_manage_church_roles(_user_id, e.church_id)
      or public.can_manage_church_workspace(_user_id, e.church_id)
      or public.is_platform_super_admin(_user_id)
      or public.is_super_admin(_user_id)
      or exists (
        select 1
        from current_members m
        where e.visibility in ('public', 'member')
          and (
            coalesce(e.audience_mode, 'everyone') in ('everyone', 'all_members')
            or (
              coalesce(e.audience_mode, 'everyone') = 'specific_groups'
              and exists (
                select 1
                from public.event_audience_targets eat
                where eat.event_id = e.id
                  and eat.church_id = e.church_id
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

alter table public.event_audience_targets enable row level security;

drop policy if exists "Event audience targets visible with event access" on public.event_audience_targets;
create policy "Event audience targets visible with event access"
on public.event_audience_targets
for select
to authenticated
using (
  public.can_view_event(auth.uid(), event_id)
);

drop policy if exists "Church managers manage event audience targets" on public.event_audience_targets;
create policy "Church managers manage event audience targets"
on public.event_audience_targets
for all
to authenticated
using (
  public.can_manage_church_roles(auth.uid(), church_id)
  or public.can_manage_church_workspace(auth.uid(), church_id)
  or public.is_platform_super_admin(auth.uid())
  or public.is_super_admin(auth.uid())
)
with check (
  public.can_manage_church_roles(auth.uid(), church_id)
  or public.can_manage_church_workspace(auth.uid(), church_id)
  or public.is_platform_super_admin(auth.uid())
  or public.is_super_admin(auth.uid())
);

drop policy if exists "events same church" on public.events;
drop policy if exists "Church managers can select events" on public.events;
drop policy if exists "Authorized users can select targeted events" on public.events;
create policy "Authorized users can select targeted events"
on public.events
for select
to authenticated
using (
  public.can_view_event(auth.uid(), id)
);

grant execute on function public.can_view_event(uuid, uuid) to authenticated;
grant select, insert, update, delete on public.event_audience_targets to authenticated;
