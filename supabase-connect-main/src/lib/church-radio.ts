import { supabase } from "@/integrations/supabase/client";

export type ChurchRadioStation = {
  id: string; churchId: string; name: string; streamUrl: string; websiteUrl: string | null;
  logoUrl: string | null; description: string | null; isActive: boolean; isFeatured: boolean; sortOrder: number;
};

type RadioRow = { id: string; church_id: string; name: string; stream_url: string; website_url: string | null; logo_url: string | null; description: string | null; is_active: boolean; is_featured: boolean; sort_order: number };
const radioTable = () => (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> }).from("church_radio_stations");

export function isSafeRadioStreamUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host === "::1" || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) return false;
    const parts = host.split(".").map(Number);
    if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
    if (/^(fc|fd|fe8)/i.test(host)) return false;
    return !!host;
  } catch { return false; }
}

function normalize(row: RadioRow): ChurchRadioStation {
  return { id: row.id, churchId: row.church_id, name: row.name, streamUrl: row.stream_url, websiteUrl: row.website_url, logoUrl: row.logo_url, description: row.description, isActive: row.is_active, isFeatured: row.is_featured, sortOrder: row.sort_order };
}

export async function fetchMemberRadioStations(churchId: string) {
  const { data, error } = await radioTable().select("id,church_id,name,stream_url,website_url,logo_url,description,is_active,is_featured,sort_order").eq("church_id", churchId).eq("is_active", true).order("is_featured", { ascending: false }).order("sort_order").order("name");
  if (error) throw error;
  return ((data ?? []) as unknown as RadioRow[]).map(normalize).filter((station) => station.churchId === churchId && station.isActive && isSafeRadioStreamUrl(station.streamUrl));
}

export async function fetchAdminRadioStations(churchId: string) {
  const { data, error } = await radioTable().select("id,church_id,name,stream_url,website_url,logo_url,description,is_active,is_featured,sort_order").eq("church_id", churchId).order("is_featured", { ascending: false }).order("sort_order");
  if (error) throw error;
  return ((data ?? []) as unknown as RadioRow[]).map(normalize);
}

export { radioTable };
