import type { TenantBranding } from "./types";

export const DEFAULT_TENANT_BRANDING: TenantBranding = {
  logoUrl: null,
  primaryColor: "#d99a00",
  secondaryColor: "#111827",
  accentColor: "#f5c542",
  parishBannerUrl: null,
  appIconUrl: null,
  whiteLabelName: null,
};

export function buildTenantBranding(input: Partial<TenantBranding> = {}): TenantBranding {
  return {
    ...DEFAULT_TENANT_BRANDING,
    ...input,
  };
}

export function isBrandingComplete(branding: TenantBranding) {
  return Boolean(branding.logoUrl && branding.primaryColor && branding.secondaryColor && branding.accentColor);
}
