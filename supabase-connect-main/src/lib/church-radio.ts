import { supabase } from "@/integrations/supabase/client";

export type PlatformRadioStation = {
  id: string;
  name: string;
  streamUrl: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  description: string | null;
  provider: string | null;
  streamFormat: string | null;
  isActive: boolean;
  isApproved: boolean;
  healthStatus: string | null;
  lastHealthCheckedAt: string | null;
};

export type PlatformRadioDirectoryStation = PlatformRadioStation & {
  metadataUrl: string | null;
};

export type ChurchRadioStation = PlatformRadioStation & {
  churchId: string;
  selectionId: string;
  enabled: boolean;
  isFeatured: boolean;
  sortOrder: number;
};

export type ChurchRadioCatalogueEntry = PlatformRadioStation & {
  selectionId: string | null;
  enabled: boolean;
  isFeatured: boolean;
  sortOrder: number;
};

type PlatformRow = {
  id: string; name: string; stream_url: string; website_url: string | null; logo_url: string | null;
  description: string | null; provider: string | null; stream_format: string | null; is_active: boolean;
  metadata_url?: string | null; is_approved: boolean; health_status: string | null; last_health_checked_at: string | null;
};
type SelectionRow = { id: string; church_id: string; radio_station_id: string; enabled: boolean; is_featured: boolean; sort_order: number; radio_stations?: PlatformRow | PlatformRow[] | null };

// These forward-only tables are intentionally accessed through a narrow adapter
// until the next generated Supabase type refresh includes the new schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = supabase as any;
export const radioDirectoryTable = () => client.from("radio_stations");
export const radioSelectionTable = () => client.from("church_radio_stations");

export function isSafeRadioStreamUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host === "::1" || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) return false;
    const parts = host.split(".").map(Number);
    if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
    if (/^(fc|fd|fe8)/i.test(host)) return false;
    return Boolean(host);
  } catch { return false; }
}

const platformColumns = "id,name,stream_url,website_url,logo_url,description,provider,stream_format,is_active,is_approved,health_status,last_health_checked_at";
function normalizePlatform(row: PlatformRow): PlatformRadioStation {
  return { id: row.id, name: row.name, streamUrl: row.stream_url, websiteUrl: row.website_url, logoUrl: row.logo_url, description: row.description, provider: row.provider, streamFormat: row.stream_format, isActive: row.is_active, isApproved: row.is_approved, healthStatus: row.health_status, lastHealthCheckedAt: row.last_health_checked_at };
}
function nestedStation(row: SelectionRow) {
  return Array.isArray(row.radio_stations) ? row.radio_stations[0] : row.radio_stations;
}

export async function fetchPlatformRadioStations() {
  const { data, error } = await client.rpc("get_platform_radio_stations");
  if (error) throw error;
  return ((data ?? []) as unknown as PlatformRow[]).map((row): PlatformRadioDirectoryStation => ({ ...normalizePlatform(row), metadataUrl: row.metadata_url ?? null })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchChurchRadioCatalogue(churchId: string) {
  const [directoryResult, selectionResult] = await Promise.all([
    radioDirectoryTable().select(platformColumns).eq("is_approved", true).order("name"),
    radioSelectionTable().select("id,church_id,radio_station_id,enabled,is_featured,sort_order").eq("church_id", churchId),
  ]);
  if (directoryResult.error) throw directoryResult.error;
  if (selectionResult.error) throw selectionResult.error;
  const selections = new Map(((selectionResult.data ?? []) as unknown as SelectionRow[]).map((row) => [row.radio_station_id, row]));
  return ((directoryResult.data ?? []) as unknown as PlatformRow[]).map((row): ChurchRadioCatalogueEntry => {
    const selection = selections.get(row.id);
    return { ...normalizePlatform(row), selectionId: selection?.id ?? null, enabled: selection?.enabled ?? false, isFeatured: selection?.is_featured ?? false, sortOrder: selection?.sort_order ?? 0 };
  }).sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function fetchMemberRadioStations(churchId: string) {
  const { data, error } = await radioSelectionTable()
    .select(`id,church_id,radio_station_id,enabled,is_featured,sort_order,radio_stations(${platformColumns})`)
    .eq("church_id", churchId).eq("enabled", true).order("is_featured", { ascending: false }).order("sort_order");
  if (error) throw error;
  return orderChurchRadioStations(((data ?? []) as unknown as SelectionRow[]).flatMap((row): ChurchRadioStation[] => {
    const station = nestedStation(row);
    if (!station || !station.is_active || !station.is_approved || !isSafeRadioStreamUrl(station.stream_url)) return [];
    return [{ ...normalizePlatform(station), churchId: row.church_id, selectionId: row.id, enabled: row.enabled, isFeatured: row.is_featured, sortOrder: row.sort_order }];
  }));
}

export function orderChurchRadioStations(stations: ChurchRadioStation[]) {
  return [...stations].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)
    || a.sortOrder - b.sortOrder
    || a.name.localeCompare(b.name)
    || a.id.localeCompare(b.id));
}

export async function setChurchRadioSelection(churchId: string, stationId: string, enabled: boolean, isFeatured: boolean, sortOrder: number) {
  const { error } = await client.rpc("set_church_radio_selection", { _church_id: churchId, _radio_station_id: stationId, _enabled: enabled, _is_featured: isFeatured, _sort_order: sortOrder });
  if (error) throw error;
}

export async function savePlatformRadioStation(station: Omit<PlatformRadioDirectoryStation, "id" | "healthStatus" | "lastHealthCheckedAt"> & { id?: string }) {
  if (!isSafeRadioStreamUrl(station.streamUrl) || (station.websiteUrl && !isSafeRadioStreamUrl(station.websiteUrl)) || (station.logoUrl && !isSafeRadioStreamUrl(station.logoUrl)) || (station.metadataUrl && !isSafeRadioStreamUrl(station.metadataUrl))) throw new Error("Use public HTTPS URLs only.");
  const payload = { name: station.name.trim(), stream_url: station.streamUrl.trim(), website_url: station.websiteUrl || null, logo_url: station.logoUrl || null, description: station.description || null, provider: station.provider || null, stream_format: station.streamFormat || null, metadata_url: station.metadataUrl || null, is_active: station.isActive, is_approved: station.isApproved };
  const query = station.id ? radioDirectoryTable().update(payload).eq("id", station.id) : radioDirectoryTable().insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function deletePlatformRadioStation(id: string) {
  const { error } = await radioDirectoryTable().delete().eq("id", id);
  if (error) throw error;
}
