create or replace function public.can_upload_chat_attachment(target_channel_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.can_manage_chat_channel(target_channel_id);
$$;

grant execute on function public.can_upload_chat_attachment(uuid) to authenticated;

drop policy if exists "Users can send channel messages" on public.chat_messages;

create policy "Users can send channel messages"
on public.chat_messages
for insert
with check (
  sender_user_id = auth.uid()
  and public.can_access_chat_channel(channel_id)
  and (
    attachment_url is null
    or public.can_upload_chat_attachment(channel_id)
  )
);

create table if not exists public.chat_message_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists idx_chat_message_reactions_message_id
  on public.chat_message_reactions(message_id, created_at);

alter table public.chat_message_reactions enable row level security;

drop policy if exists "Users can view chat reactions" on public.chat_message_reactions;
drop policy if exists "Users can add chat reactions" on public.chat_message_reactions;
drop policy if exists "Users can update chat reactions" on public.chat_message_reactions;
drop policy if exists "Users can delete their chat reactions" on public.chat_message_reactions;

create policy "Users can view chat reactions"
on public.chat_message_reactions
for select
using (
  exists (
    select 1
    from public.chat_messages message_row
    where message_row.id = message_id
      and public.can_access_chat_channel(message_row.channel_id)
  )
);

create policy "Users can add chat reactions"
on public.chat_message_reactions
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.chat_messages message_row
    where message_row.id = message_id
      and public.can_access_chat_channel(message_row.channel_id)
  )
);

create policy "Users can update chat reactions"
on public.chat_message_reactions
for update
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.chat_messages message_row
    where message_row.id = message_id
      and public.can_access_chat_channel(message_row.channel_id)
  )
);

create policy "Users can delete their chat reactions"
on public.chat_message_reactions
for delete
using (
  user_id = auth.uid()
);
