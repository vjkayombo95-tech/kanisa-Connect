drop policy if exists "Users can view accessible chat channels" on public.chat_channels;
drop policy if exists "Admins and community leaders can create chat channels" on public.chat_channels;
drop policy if exists "Channel members can view memberships" on public.chat_channel_members;
drop policy if exists "Channel owners can add memberships" on public.chat_channel_members;
drop policy if exists "Users can view channel messages" on public.chat_messages;
drop policy if exists "Users can send channel messages" on public.chat_messages;

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
