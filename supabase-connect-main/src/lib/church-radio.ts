import { supabase } from "@/integrations/supabase/client";

export type RadioStation = {
  id: string;
  name: string;
  streamUrl: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  description: string | null;
  isActive: boolean;
  isApproved: boolean;
};

export type ChurchRadioStation = RadioStation & {
  selectionId: string;
  churchId: string;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
};

export type ChurchRadioCatalogueEntry = RadioStation & {
  selectionId: string | null;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
};

type StationRow = { id:string; name:string; stream_url:string; website_url:string|null; logo_url:string|null; description:string|null; is_active:boolean; is_approved:boolean };
type SelectionRow = { id:string; church_id:string; radio_station_id:string; enabled:boolean; is_default:boolean; sort_order:number; radio_stations?:StationRow|StationRow[]|null };
// New forward-only tables are intentionally isolated until generated types are refreshed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const stationColumns = "id,name,stream_url,website_url,logo_url,description,is_active,is_approved";

export function isSafeRadioUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host === "::1" || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false;
    const parts = host.split(".").map(Number);
    return !(parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
  } catch { return false; }
}

const normalize = (row: StationRow): RadioStation => ({
  id:row.id, name:row.name, streamUrl:row.stream_url, websiteUrl:row.website_url,
  logoUrl:row.logo_url, description:row.description, isActive:row.is_active, isApproved:row.is_approved,
});

export async function fetchMemberRadioStations(churchId: string) {
  const { data, error } = await db.from("church_radio_stations")
    .select(`id,church_id,radio_station_id,enabled,is_default,sort_order,radio_stations(${stationColumns})`)
    .eq("church_id", churchId).eq("enabled", true)
    .order("is_default", { ascending:false }).order("sort_order");
  if (error) throw error;
  return ((data ?? []) as SelectionRow[]).flatMap((selection): ChurchRadioStation[] => {
    const nested = Array.isArray(selection.radio_stations) ? selection.radio_stations[0] : selection.radio_stations;
    if (!nested || !nested.is_active || !nested.is_approved || !isSafeRadioUrl(nested.stream_url)) return [];
    return [{ ...normalize(nested), selectionId:selection.id, churchId:selection.church_id, enabled:selection.enabled, isDefault:selection.is_default, sortOrder:selection.sort_order }];
  });
}

export async function fetchChurchRadioCatalogue(churchId: string) {
  const [stations, selections] = await Promise.all([
    db.from("radio_stations").select(stationColumns).eq("is_active", true).eq("is_approved", true).order("name"),
    db.from("church_radio_stations").select("id,radio_station_id,enabled,is_default,sort_order").eq("church_id", churchId),
  ]);
  if (stations.error) throw stations.error;
  if (selections.error) throw selections.error;
  const selected = new Map(((selections.data ?? []) as SelectionRow[]).map((row) => [row.radio_station_id, row]));
  return ((stations.data ?? []) as StationRow[]).map((row): ChurchRadioCatalogueEntry => {
    const selection = selected.get(row.id);
    return { ...normalize(row), selectionId:selection?.id ?? null, enabled:selection?.enabled ?? false, isDefault:selection?.is_default ?? false, sortOrder:selection?.sort_order ?? 0 };
  });
}

export async function setChurchRadioSelection(churchId:string, stationId:string, enabled:boolean, isDefault:boolean, sortOrder:number) {
  const { error } = await db.rpc("set_church_radio_selection", { _church_id:churchId, _radio_station_id:stationId, _enabled:enabled, _is_default:isDefault, _sort_order:sortOrder });
  if (error) throw error;
}

export async function fetchRadioDirectory() {
  const { data, error } = await db.from("radio_stations").select(stationColumns).order("name");
  if (error) throw error;
  return ((data ?? []) as StationRow[]).map(normalize);
}

export async function saveRadioStation(station: Omit<RadioStation,"id"> & { id?:string }) {
  if (!station.name.trim() || !isSafeRadioUrl(station.streamUrl) || (station.websiteUrl && !isSafeRadioUrl(station.websiteUrl)) || (station.logoUrl && !isSafeRadioUrl(station.logoUrl))) throw new Error("Use public HTTPS URLs only.");
  const payload = { name:station.name.trim(), stream_url:station.streamUrl.trim(), website_url:station.websiteUrl || null, logo_url:station.logoUrl || null, description:station.description || null, is_active:station.isActive, is_approved:station.isApproved };
  const result = station.id ? await db.from("radio_stations").update(payload).eq("id", station.id) : await db.from("radio_stations").insert(payload);
  if (result.error) throw result.error;
}

export async function deleteRadioStation(id:string) {
  const { error } = await db.from("radio_stations").delete().eq("id", id);
  if (error) throw error;
}
