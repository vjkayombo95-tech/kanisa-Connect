import type { TenantRegionalSettings } from "./types";

export const DEFAULT_TENANT_REGIONAL_SETTINGS: TenantRegionalSettings = {
  country: "TZ",
  language: "sw",
  timezone: "Africa/Dar_es_Salaam",
  currency: "TZS",
  dateFormat: "dd/MM/yyyy",
  liturgicalRegion: "TZ",
  localHolidayRegion: null,
};

export function buildTenantRegionalSettings(
  input: Partial<TenantRegionalSettings> = {},
): TenantRegionalSettings {
  return {
    ...DEFAULT_TENANT_REGIONAL_SETTINGS,
    ...input,
  };
}
