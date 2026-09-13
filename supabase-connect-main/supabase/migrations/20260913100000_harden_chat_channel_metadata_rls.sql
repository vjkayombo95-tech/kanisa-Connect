-- Prevent ordinary same-church members from discovering private channel
-- metadata unless they satisfy the explicit channel access policy.
drop policy if exists "chat channels same church"
on public.chat_channels;
