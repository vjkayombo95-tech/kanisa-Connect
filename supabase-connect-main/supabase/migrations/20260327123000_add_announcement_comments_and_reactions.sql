create table if not exists public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.announcement_reactions (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists idx_announcement_comments_announcement_id
  on public.announcement_comments(announcement_id, created_at);

create index if not exists idx_announcement_reactions_announcement_id
  on public.announcement_reactions(announcement_id, created_at);

alter table public.announcement_comments enable row level security;
alter table public.announcement_reactions enable row level security;

drop policy if exists "Users can view announcement comments" on public.announcement_comments;
drop policy if exists "Users can add announcement comments" on public.announcement_comments;
drop policy if exists "Users can delete own announcement comments" on public.announcement_comments;

create policy "Users can view announcement comments"
on public.announcement_comments
for select
using (
  exists (
    select 1
    from public.announcements a
    where a.id = announcement_id
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

create policy "Users can add announcement comments"
on public.announcement_comments
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.announcements a
    where a.id = announcement_id
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

create policy "Users can delete own announcement comments"
on public.announcement_comments
for delete
using (
  user_id = auth.uid()
);

drop policy if exists "Users can view announcement reactions" on public.announcement_reactions;
drop policy if exists "Users can add announcement reactions" on public.announcement_reactions;
drop policy if exists "Users can update own announcement reactions" on public.announcement_reactions;
drop policy if exists "Users can delete own announcement reactions" on public.announcement_reactions;

create policy "Users can view announcement reactions"
on public.announcement_reactions
for select
using (
  exists (
    select 1
    from public.announcements a
    where a.id = announcement_id
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

create policy "Users can add announcement reactions"
on public.announcement_reactions
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.announcements a
    where a.id = announcement_id
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

create policy "Users can update own announcement reactions"
on public.announcement_reactions
for update
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

create policy "Users can delete own announcement reactions"
on public.announcement_reactions
for delete
using (
  user_id = auth.uid()
);
