type PrayerRouteWorkspace = "member" | "pastoral" | "church_admin" | "finance" | string;

type PrayerRouteRecord = {
  id: string;
  slug?: string | null;
};

export function getPrayerRoot(workspaceId: PrayerRouteWorkspace) {
  if (workspaceId === "pastoral") return "/pastoral/prayers";
  if (workspaceId === "church_admin") return "/church-admin/prayers";
  if (workspaceId === "finance") return "/finance/prayers";
  return "/portal/prayers";
}

export function getPrayerLibraryRoot(workspaceId: PrayerRouteWorkspace) {
  if (workspaceId === "pastoral") return "/pastoral/saints";
  if (workspaceId === "church_admin") return "/church-admin/saints";
  if (workspaceId === "finance") return "/finance/saints";
  return "/portal/library";
}

export function getPrayerRouteIdentifier(prayer: PrayerRouteRecord) {
  return prayer.slug || prayer.id;
}

export function getPrayerDetailPath(workspaceId: PrayerRouteWorkspace, prayer: PrayerRouteRecord) {
  return `${getPrayerRoot(workspaceId)}/${getPrayerRouteIdentifier(prayer)}`;
}
