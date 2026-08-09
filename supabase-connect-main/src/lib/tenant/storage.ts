import type { TenantStorageConfiguration } from "./types";

function cleanPathSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildTenantStorageConfiguration(tenantId: string): TenantStorageConfiguration {
  const prefix = cleanPathSegment(tenantId) || "tenant";

  return {
    bucketPrefix: prefix,
    churchAssetsPath: `${prefix}/church-assets`,
    memberAssetsPath: `${prefix}/member-assets`,
    receiptsPath: `${prefix}/receipts`,
    importsPath: `${prefix}/imports`,
  };
}
