create table if not exists public.help_comment_reactions (
  comment_id uuid not null references public.help_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.prayer_request_comment_reactions (
  comment_id uuid not null references public.prayer_request_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.announcement_comment_reactions (
  comment_id uuid not null references public.announcement_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists idx_help_comment_reactions_comment_id
  on public.help_comment_reactions(comment_id, created_at);

create index if not exists idx_prayer_request_comment_reactions_comment_id
  on public.prayer_request_comment_reactions(comment_id, created_at);

create index if not exists idx_announcement_comment_reactions_comment_id
  on public.announcement_comment_reactions(comment_id, created_at);

alter table public.help_comment_reactions enable row level security;
alter table public.prayer_request_comment_reactions enable row level security;
alter table public.announcement_comment_reactions enable row level security;

drop policy if exists "View help comment reactions" on public.help_comment_reactions;
drop policy if exists "Create help comment reactions" on public.help_comment_reactions;
drop policy if exists "Update own help comment reactions" on public.help_comment_reactions;
drop policy if exists "Delete own help comment reactions" on public.help_comment_reactions;

create policy "View help comment reactions"
on public.help_comment_reactions
for select
using (
  exists (
    select 1
    from public.help_comments hc
    join public.community_help_requests h on h.id = hc.help_request_id
    where hc.id = help_comment_reactions.comment_id
      and (
        h.church_id in (
          select ur.church_id
          from public.user_roles ur
          where ur.user_id = auth.uid()
        )
        or h.church_id in (
          select m.church_id
          from public.members m
          where m.user_id = auth.uid()
        )
      )
  )
);

create policy "Create help comment reactions"
on public.help_comment_reactions
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.help_comments hc
    join public.community_help_requests h on h.id = hc.help_request_id
    where hc.id = help_comment_reactions.comment_id
      and (
        h.church_id in (
          select ur.church_id
          from public.user_roles ur
          where ur.user_id = auth.uid()
        )
        or h.church_id in (
          select m.church_id
          from public.members m
          where m.user_id = auth.uid()
        )
      )
  )
);

create policy "Update own help comment reactions"
on public.help_comment_reactions
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Delete own help comment reactions"
on public.help_comment_reactions
for delete
using (user_id = auth.uid());

drop policy if exists "View prayer request comment reactions" on public.prayer_request_comment_reactions;
drop policy if exists "Create prayer request comment reactions" on public.prayer_request_comment_reactions;
drop policy if exists "Update own prayer request comment reactions" on public.prayer_request_comment_reactions;
drop policy if exists "Delete own prayer request comment reactions" on public.prayer_request_comment_reactions;

create policy "View prayer request comment reactions"
on public.prayer_request_comment_reactions
for select
using (
  exists (
    select 1
    from public.prayer_request_comments prc
    where prc.id = prayer_request_comment_reactions.comment_id
      and (
        exists (
          select 1
          from public.members m
          where m.user_id = auth.uid()
            and m.church_id = prc.church_id
        )
        or exists (
          select 1
          from public.user_roles ur
          where ur.user_id = auth.uid()
            and ur.church_id = prc.church_id
        )
      )
  )
);

create policy "Create prayer request comment reactions"
on public.prayer_request_comment_reactions
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.prayer_request_comments prc
    where prc.id = prayer_request_comment_reactions.comment_id
      and (
        exists (
          select 1
          from public.members m
          where m.user_id = auth.uid()
            and m.church_id = prc.church_id
        )
        or exists (
          select 1
          from public.user_roles ur
          where ur.user_id = auth.uid()
            and ur.church_id = prc.church_id
        )
      )
  )
);

create policy "Update own prayer request comment reactions"
on public.prayer_request_comment_reactions
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Delete own prayer request comment reactions"
on public.prayer_request_comment_reactions
for delete
using (user_id = auth.uid());

drop policy if exists "Users can view announcement comment reactions" on public.announcement_comment_reactions;
drop policy if exists "Users can add announcement comment reactions" on public.announcement_comment_reactions;
drop policy if exists "Users can update own announcement comment reactions" on public.announcement_comment_reactions;
drop policy if exists "Users can delete own announcement comment reactions" on public.announcement_comment_reactions;

create policy "Users can view announcement comment reactions"
on public.announcement_comment_reactions
for select
using (
  exists (
    select 1
    from public.announcement_comments ac
    join public.announcements a on a.id = ac.announcement_id
    where ac.id = announcement_comment_reactions.comment_id
      and (
        (
          a.is_published = true
          and a.archived_at is null
          and (
            exists (
              select 1
              from public.members m
              where m.user_id = auth.uid()
                and m.church_id = a.church_id
            )
            or exists (
              select 1
              from public.user_roles ur
              where ur.user_id = auth.uid()
                and ur.church_id = a.church_id
            )
          )
        )
        or exists (
          select 1
          from public.user_roles ur
          where ur.user_id = auth.uid()
            and ur.church_id = a.church_id
            and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
        )
      )
  )
);

create policy "Users can add announcement comment reactions"
on public.announcement_comment_reactions
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.announcement_comments ac
    join public.announcements a on a.id = ac.announcement_id
    where ac.id = announcement_comment_reactions.comment_id
      and a.is_published = true
      and a.archived_at is null
      and (
        exists (
          select 1
          from public.members m
          where m.user_id = auth.uid()
            and m.church_id = a.church_id
        )
        or exists (
          select 1
          from public.user_roles ur
          where ur.user_id = auth.uid()
            and ur.church_id = a.church_id
        )
      )
  )
);

create policy "Users can update own announcement comment reactions"
on public.announcement_comment_reactions
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own announcement comment reactions"
on public.announcement_comment_reactions
for delete
using (user_id = auth.uid());
