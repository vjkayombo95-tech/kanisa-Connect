-- Distinguish a disabled optional workflow from church-wide WhatsApp disablement.
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_failure_category_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_failure_category_check check (
  failure_category is null or failure_category in (
    'retryable_provider','provider_auth','invalid_recipient','invalid_payload','template_rejected','service_window_closed',
    'church_disabled','feature_disabled','account_missing','tenant_mismatch','daily_limit','worker_failure','max_attempts'
  )
);
