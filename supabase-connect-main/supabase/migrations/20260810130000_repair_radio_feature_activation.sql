-- One-time rollout repair for Radio rows left disabled by feature provisioning.
-- Future churches already enable plan-backed features in
-- provision_church_feature_permissions(); do not turn this into a persistent
-- override of later administrator choices.

update public.church_features cf
set
  enabled = true,
  enabled_at = coalesce(cf.enabled_at, now()),
  updated_at = now()
from public.platform_features pf
where cf.feature_id = pf.id
  and pf.key = 'radio'
  and cf.enabled is distinct from true;
