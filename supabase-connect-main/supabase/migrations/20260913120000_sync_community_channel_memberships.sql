-- Keep community-members chat channels synchronized with current Jumuiya membership.
--
-- Canonical audience:
--   1. members currently assigned through member_communities
--   2. current community leaders
--   3. the channel creator
--
-- chat_channel_members remains the materialized authorization set used by
-- channel/message/reaction RLS.

create or replace function public.sync_community_channel_memberships(
  p_community_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_community_id is null then
    return;
  end if;

  -- Add every currently eligible community member/leader to each
  -- community_members channel for this exact community and church.
  insert into public.chat_channel_members (
    channel_id,
    user_id,
    member_id
  )
  select
    cc.id,
    eligible.user_id,
    eligible.member_id
  from public.chat_channels cc
  join public.communities c
    on c.id = cc.community_id
   and c.id = p_community_id
   and c.church_id = cc.church_id
  cross join lateral (
    select distinct
      m.user_id,
      m.id as member_id
    from public.members m
    where m.church_id = c.church_id
      and m.user_id is not null
      and (
        exists (
          select 1
          from public.member_communities mc
          where mc.community_id = c.id
            and mc.member_id = m.id
        )
        or m.id = c.mwenyekiti_id
        or m.id = c.makamu_mwenyekiti_id
        or m.id = c.mweka_hazina_id
        or m.id = c.katibu_id
      )
  ) eligible
  where cc.audience_type = 'community_members'
  on conflict (channel_id, user_id)
  do update set member_id = excluded.member_id;

  -- Ensure the channel creator keeps direct membership. Message INSERT/SELECT
  -- policies rely on chat_channel_members even though channel visibility also
  -- recognizes created_by.
  insert into public.chat_channel_members (
    channel_id,
    user_id,
    member_id
  )
  select
    cc.id,
    cc.created_by,
    m.id
  from public.chat_channels cc
  join public.communities c
    on c.id = cc.community_id
   and c.id = p_community_id
   and c.church_id = cc.church_id
  left join public.members m
    on m.church_id = cc.church_id
   and m.user_id = cc.created_by
  where cc.audience_type = 'community_members'
    and cc.created_by is not null
  on conflict (channel_id, user_id)
  do update set member_id = coalesce(excluded.member_id, public.chat_channel_members.member_id);

  -- Remove stale snapshot recipients who are no longer members/leaders.
  -- The creator is intentionally preserved.
  delete from public.chat_channel_members ccm
  using public.chat_channels cc,
        public.communities c
  where ccm.channel_id = cc.id
    and cc.audience_type = 'community_members'
    and cc.community_id = p_community_id
    and c.id = cc.community_id
    and c.church_id = cc.church_id
    and ccm.user_id <> cc.created_by
    and not exists (
      select 1
      from public.members m
      where m.id = ccm.member_id
        and m.user_id = ccm.user_id
        and m.church_id = cc.church_id
        and (
          exists (
            select 1
            from public.member_communities mc
            where mc.community_id = c.id
              and mc.member_id = m.id
          )
          or m.id = c.mwenyekiti_id
          or m.id = c.makamu_mwenyekiti_id
          or m.id = c.mweka_hazina_id
          or m.id = c.katibu_id
        )
    );
end;
$$;

revoke all on function public.sync_community_channel_memberships(uuid) from public;
revoke all on function public.sync_community_channel_memberships(uuid) from anon;
revoke all on function public.sync_community_channel_memberships(uuid) from authenticated;

create or replace function public.sync_community_channel_memberships_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_community_channel_memberships(old.community_id);
    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.community_id is distinct from new.community_id then
    perform public.sync_community_channel_memberships(old.community_id);
  end if;

  perform public.sync_community_channel_memberships(new.community_id);
  return new;
end;
$$;

revoke all on function public.sync_community_channel_memberships_from_membership() from public;
revoke all on function public.sync_community_channel_memberships_from_membership() from anon;
revoke all on function public.sync_community_channel_memberships_from_membership() from authenticated;

drop trigger if exists sync_community_channel_memberships
  on public.member_communities;

create trigger sync_community_channel_memberships
after insert or update or delete
on public.member_communities
for each row
execute function public.sync_community_channel_memberships_from_membership();

-- Leadership is also part of the community_members audience in the existing
-- application recipient resolver, so keep materialized membership aligned when
-- leadership assignments change.
create or replace function public.sync_community_channel_memberships_from_community()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_community_channel_memberships(new.id);
  return new;
end;
$$;

revoke all on function public.sync_community_channel_memberships_from_community() from public;
revoke all on function public.sync_community_channel_memberships_from_community() from anon;
revoke all on function public.sync_community_channel_memberships_from_community() from authenticated;

drop trigger if exists sync_community_channel_leadership
  on public.communities;

create trigger sync_community_channel_leadership
after update of
  mwenyekiti_id,
  makamu_mwenyekiti_id,
  mweka_hazina_id,
  katibu_id
on public.communities
for each row
when (
  old.mwenyekiti_id is distinct from new.mwenyekiti_id
  or old.makamu_mwenyekiti_id is distinct from new.makamu_mwenyekiti_id
  or old.mweka_hazina_id is distinct from new.mweka_hazina_id
  or old.katibu_id is distinct from new.katibu_id
)
execute function public.sync_community_channel_memberships_from_community();

-- One-time reconciliation for channels that predate automatic synchronization.
do $$
declare
  v_community_id uuid;
begin
  for v_community_id in
    select distinct cc.community_id
    from public.chat_channels cc
    where cc.audience_type = 'community_members'
      and cc.community_id is not null
  loop
    perform public.sync_community_channel_memberships(v_community_id);
  end loop;
end;
$$;
