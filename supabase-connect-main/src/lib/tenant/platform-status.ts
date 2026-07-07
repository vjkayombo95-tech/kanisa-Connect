import { isBrandingComplete } from "./branding";
import { isTenantFeatureEnabled } from "./feature-flags";
import type { PlatformStatus, PlatformStatusCheck, Tenant } from "./types";

export type PlatformStatusSignals = {
  dailyReadingsLoaded?: boolean;
  bibleAvailable?: boolean;
  storageReady?: boolean;
};

function check(
  key: PlatformStatusCheck["key"],
  ok: boolean,
  label: string,
  detail: string,
  severity: PlatformStatusCheck["severity"] = ok ? "info" : "warning",
): PlatformStatusCheck {
  return { key, ok, label, detail, severity };
}

export function evaluatePlatformStatus(
  tenant: Tenant,
  signals: PlatformStatusSignals = {},
): PlatformStatus {
  const checks: PlatformStatusCheck[] = [
    check(
      "configuration_complete",
      Boolean(tenant.church.name && tenant.regional.timezone && tenant.regional.language && tenant.subscription.plan),
      "Configuration complete",
      "Church, regional, and subscription configuration are present.",
      "critical",
    ),
    check(
      "storage_ready",
      Boolean(signals.storageReady),
      "Storage ready",
      "Tenant storage folders and bucket policy mappings are prepared.",
    ),
    check(
      "branding_complete",
      isBrandingComplete(tenant.branding),
      "Branding complete",
      "Logo and color palette are configured.",
    ),
    check(
      "daily_readings_loaded",
      Boolean(signals.dailyReadingsLoaded),
      "Daily Readings loaded",
      "Daily Catholic content has been imported for the tenant region.",
    ),
    check(
      "bible_available",
      Boolean(signals.bibleAvailable) && isTenantFeatureEnabled(tenant.features, "bible"),
      "Bible available",
      "Bible feature is enabled and Bible content is available.",
    ),
    check(
      "notifications_configured",
      tenant.notifications.emailEnabled ||
        tenant.notifications.smsEnabled ||
        tenant.notifications.pushEnabled ||
        tenant.notifications.whatsappEnabled,
      "Notifications configured",
      "At least one tenant notification channel is configured.",
    ),
  ];

  const criticalFailures = checks.filter((item) => !item.ok && item.severity === "critical");
  const warningFailures = checks.filter((item) => !item.ok && item.severity === "warning");

  return {
    tenantId: tenant.id,
    readyForPilot: criticalFailures.length === 0,
    readyForProduction: criticalFailures.length === 0 && warningFailures.length === 0,
    checks,
  };
}
