create table if not exists public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null,
  description text,
  owner_scope text not null check (owner_scope in ('church_admin', 'community_leader')),
  audience_type text not null check (audience_type in ('ministry', 'community_leaders', 'all_community_leaders', 'admin_roles', 'community_members')),
  community_id uuid references public.communities(id) on delete cascade,
  ministry_id uuid references public.ministries(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_channel_members (
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_member_id uuid references public.members(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_channels_church_id on public.chat_channels(church_id);
create index if not exists idx_chat_channels_community_id on public.chat_channels(community_id);
create index if not exists idx_chat_channel_members_user_id on public.chat_channel_members(user_id);
create index if not exists idx_chat_messages_channel_id on public.chat_messages(channel_id, created_at);

alter table public.chat_channels enable row level security;
alter table public.chat_channel_members enable row level security;
alter table public.chat_messages enable row level security;

drop function if exists public.can_access_chat_channel(uuid);
drop function if exists public.can_manage_chat_channel(uuid);

create function public.can_access_chat_channel(target_channel_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_channels c
    where c.id = target_channel_id
      and (
        c.created_by = auth.uid()
        or exists (
          select 1
          from public.chat_channel_members m
          where m.channel_id = c.id
            and m.user_id = auth.uid()
        )
        or c.church_id in (
          select ur.church_id
          from public.user_roles ur
          where ur.user_id = auth.uid()
            and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
        )
        or (
          c.community_id is not null
          and exists (
            select 1
            from public.members member_row
            join public.communities community
              on community.id = c.community_id
             and community.church_id = member_row.church_id
            where member_row.user_id = auth.uid()
              and (
                community.chairperson_id = member_row.id
                or community.vice_chairperson_id = member_row.id
                or community.treasurer_id = member_row.id
                or community.secretary_id = member_row.id
                or community.katibu_id = member_row.id
              )
          )
        )
      )
  );
$$;

create function public.can_manage_chat_channel(target_channel_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_channels c
    where c.id = target_channel_id
      and (
        c.created_by = auth.uid()
        or c.church_id in (
          select ur.church_id
          from public.user_roles ur
          where ur.user_id = auth.uid()
            and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
        )
        or (
          c.community_id is not null
          and exists (
            select 1
            from public.members member_row
            join public.communities community
              on community.id = c.community_id
             and community.church_id = member_row.church_id
            where member_row.user_id = auth.uid()
              and (
                community.chairperson_id = member_row.id
                or community.vice_chairperson_id = member_row.id
                or community.treasurer_id = member_row.id
                or community.secretary_id = member_row.id
                or community.katibu_id = member_row.id
              )
          )
        )
      )
  );
$$;

grant execute on function public.can_access_chat_channel(uuid) to authenticated;
grant execute on function public.can_manage_chat_channel(uuid) to authenticated;

create policy "Users can view accessible chat channels"
on public.chat_channels
for select
using (
  public.can_access_chat_channel(id)
);

create policy "Admins and community leaders can create chat channels"
on public.chat_channels
for insert
with check (
  (
    owner_scope = 'church_admin'
    and church_id in (
      select ur.church_id
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
    )
  )
  or (
    owner_scope = 'community_leader'
    and community_id is not null
    and exists (
      select 1
      from public.members member_row
      join public.communities community
        on community.id = community_id
       and community.church_id = member_row.church_id
      where member_row.user_id = auth.uid()
        and (
          community.chairperson_id = member_row.id
          or community.vice_chairperson_id = member_row.id
          or community.treasurer_id = member_row.id
          or community.secretary_id = member_row.id
          or community.katibu_id = member_row.id
        )
    )
  )
);

create policy "Channel members can view memberships"
on public.chat_channel_members
for select
using (
  user_id = auth.uid()
  or public.can_manage_chat_channel(channel_id)
);

create policy "Channel owners can add memberships"
on public.chat_channel_members
for insert
with check (
  public.can_manage_chat_channel(channel_id)
);

create policy "Users can view channel messages"
on public.chat_messages
for select
using (
  public.can_access_chat_channel(channel_id)
);

create policy "Users can send channel messages"
on public.chat_messages
for insert
with check (
  sender_user_id = auth.uid()
  and public.can_access_chat_channel(channel_id)
);
