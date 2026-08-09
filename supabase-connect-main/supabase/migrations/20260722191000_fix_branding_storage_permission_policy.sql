-- Avoid relying on churches SELECT visibility while evaluating storage RLS.
-- Branding paths are tenant-prefixed: <church-uuid>/(logos|banners)/<file>.

do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "Church settings permission can upload branding" on storage.objects;
    create policy "Church settings permission can upload branding"
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'church-assets'
      and coalesce((storage.foldername(name))[2], '') in ('logos', 'banners')
      and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.has_church_feature_permission(
        auth.uid(), ((storage.foldername(name))[1])::uuid, 'feature_permissions_admin', 'manage'
      )
    );

    drop policy if exists "Church settings permission can update branding" on storage.objects;
    create policy "Church settings permission can update branding"
    on storage.objects for update to authenticated
    using (
      bucket_id = 'church-assets'
      and coalesce((storage.foldername(name))[2], '') in ('logos', 'banners')
      and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.has_church_feature_permission(
        auth.uid(), ((storage.foldername(name))[1])::uuid, 'feature_permissions_admin', 'manage'
      )
    )
    with check (
      bucket_id = 'church-assets'
      and coalesce((storage.foldername(name))[2], '') in ('logos', 'banners')
      and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.has_church_feature_permission(
        auth.uid(), ((storage.foldername(name))[1])::uuid, 'feature_permissions_admin', 'manage'
      )
    );

    drop policy if exists "Church settings permission can delete branding" on storage.objects;
    create policy "Church settings permission can delete branding"
    on storage.objects for delete to authenticated
    using (
      bucket_id = 'church-assets'
      and coalesce((storage.foldername(name))[2], '') in ('logos', 'banners')
      and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.has_church_feature_permission(
        auth.uid(), ((storage.foldername(name))[1])::uuid, 'feature_permissions_admin', 'manage'
      )
    );

    drop policy if exists "church settings guard asset insert" on storage.objects;
    create policy "church settings guard asset insert"
    on storage.objects as restrictive for insert to authenticated
    with check (
      bucket_id <> 'church-assets'
      or coalesce((storage.foldername(name))[2], '') not in ('logos', 'banners')
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and public.has_church_feature_permission(
          auth.uid(), ((storage.foldername(name))[1])::uuid, 'feature_permissions_admin', 'manage'
        )
      )
    );

    drop policy if exists "church settings guard asset update" on storage.objects;
    create policy "church settings guard asset update"
    on storage.objects as restrictive for update to authenticated
    using (
      bucket_id <> 'church-assets'
      or coalesce((storage.foldername(name))[2], '') not in ('logos', 'banners')
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and public.has_church_feature_permission(
          auth.uid(), ((storage.foldername(name))[1])::uuid, 'feature_permissions_admin', 'manage'
        )
      )
    )
    with check (
      bucket_id <> 'church-assets'
      or coalesce((storage.foldername(name))[2], '') not in ('logos', 'banners')
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and public.has_church_feature_permission(
          auth.uid(), ((storage.foldername(name))[1])::uuid, 'feature_permissions_admin', 'manage'
        )
      )
    );

    drop policy if exists "church settings guard asset delete" on storage.objects;
    create policy "church settings guard asset delete"
    on storage.objects as restrictive for delete to authenticated
    using (
      bucket_id <> 'church-assets'
      or coalesce((storage.foldername(name))[2], '') not in ('logos', 'banners')
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and public.has_church_feature_permission(
          auth.uid(), ((storage.foldername(name))[1])::uuid, 'feature_permissions_admin', 'manage'
        )
      )
    );
  end if;
end $$;
