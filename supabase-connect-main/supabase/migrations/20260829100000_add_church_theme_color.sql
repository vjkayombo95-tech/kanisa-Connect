-- Add the church theme color expected by the church settings and theme provider UI.
-- Keep the column nullable for rollout safety while defaulting new churches to the standard Kanisa gold.

alter table public.churches
  add column if not exists theme_color text;

alter table public.churches
  alter column theme_color set default '#d4a017';

update public.churches
set theme_color = '#d4a017'
where theme_color is null;

alter table public.churches
  drop constraint if exists churches_theme_color_check,
  add constraint churches_theme_color_check
    check (theme_color is null or theme_color ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.churches.theme_color is
  'Church-wide primary theme color as a six-digit CSS hex color. Null falls back to the app default.';
