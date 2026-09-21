import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getParishDirectionsHref, getParishMapHref } from "@/lib/member-daily-life";

const readSrc = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");
const readRoot = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Wave 22A church location directions", () => {
  it("adds nullable church coordinate columns with bounded range checks", () => {
    const migration = readRoot("supabase/migrations/20260921120000_add_church_location_coordinates.sql");

    expect(migration).toContain("add column latitude double precision");
    expect(migration).toContain("add column longitude double precision");
    expect(migration).toContain("latitude is null or latitude between -90 and 90");
    expect(migration).toContain("longitude is null or longitude between -180 and 180");
    expect(migration).not.toMatch(/not null|postgis|geography|geometry|place_id|google_maps_url|map_url/i);
  });

  it("builds directions from coordinates before falling back to encoded address search", () => {
    expect(getParishDirectionsHref({ address: "St Joseph", latitude: -6.816, longitude: 39.289 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=-6.816,39.289",
    );
    expect(getParishDirectionsHref({ address: "Equator Parish", latitude: 0, longitude: 0 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=0,0",
    );
    expect(getParishDirectionsHref({ address: "St Joseph, Dar es Salaam", latitude: null, longitude: null })).toBe(
      "https://www.google.com/maps/search/?api=1&query=St%20Joseph%2C%20Dar%20es%20Salaam",
    );
    expect(getParishDirectionsHref({ address: null, latitude: 91, longitude: 39 })).toBeNull();
    expect(getParishMapHref("St Joseph\nDar es Salaam")).toBe(
      "https://www.google.com/maps/search/?api=1&query=St%20Joseph%20Dar%20es%20Salaam",
    );
  });

  it("keeps the member parish query tenant-scoped and selects coordinates in the existing request", () => {
    const helper = readSrc("lib/member-daily-life.ts");

    expect(helper).toContain('.select("id,name,logo_url,phone,email,address,latitude,longitude")');
    expect(helper).toContain('.eq("id", churchId)');
    expect(helper).toContain("data.id !== churchId");
    expect(helper).toContain("latitude: normalizeCoordinate(data.latitude, -90, 90)");
    expect(helper).toContain("longitude: normalizeCoordinate(data.longitude, -180, 180)");
  });

  it("updates member parish location UI without adding an embedded map", () => {
    const page = readSrc("pages/portal/MemberMyParishPage.tsx");

    expect(page).toContain("getParishDirectionsHref(parish.data)");
    expect(page).toContain("Pata Maelekezo");
    expect(page).toContain("Mahali pa parokia bado hapajawekwa.");
    expect(page).toContain("overflow-x-hidden");
    expect(page).not.toMatch(/<iframe|maps\/embed|google\.maps/i);
  });

  it("extends the existing settings save flow without a second Supabase write path", () => {
    const settings = readSrc("pages/church-admin/SettingsPage.tsx");
    const locationSectionStart = settings.indexOf("Mahali Kanisa Lilipo");
    const advancedStart = settings.indexOf("Mipangilio ya kina");
    const geolocationHandler = settings.slice(settings.indexOf("const useCurrentLocation"), settings.indexOf("const handleLogoUploaded"));

    expect(settings).toContain("Mahali Kanisa Lilipo");
    expect(settings).toContain("Weka eneo la kanisa ili waumini waweze kupata maelekezo ya kufika kanisani.");
    expect(settings).toContain("Tumia eneo nilipo sasa");
    expect(settings).toContain("Ukiwa kanisani, bonyeza kitufe hiki ili kuhifadhi eneo la kanisa.");
    expect(settings).toContain("Inatafuta eneo...");
    expect(settings).toContain("Anwani (hiari)");
    expect(settings).toContain("Mbezi Beach, Dar es Salaam");
    expect(settings).toContain("<details");
    expect(settings).toContain("<summary");
    expect(settings).toContain("Mipangilio ya kina");
    expect(settings).toContain("Tumia sehemu hii tu kama unajua coordinates za eneo la kanisa.");
    expect(settings.indexOf('htmlFor="church-latitude"')).toBeGreaterThan(advancedStart);
    expect(settings.indexOf('htmlFor="church-longitude"')).toBeGreaterThan(advancedStart);
    expect(settings.slice(locationSectionStart, advancedStart)).not.toContain("church-latitude");
    expect(settings.slice(locationSectionStart, advancedStart)).not.toContain("church-longitude");
    expect(settings).toContain("navigator.geolocation.getCurrentPosition");
    expect(settings).toContain("if (!trimmed) return null");
    expect(settings).toContain("hasSavedCoordinates(church.latitude, church.longitude)");
    expect(settings).toContain("Eneo la kanisa limehifadhiwa.");
    expect(settings).toContain("const parsedLatitude = parseOptionalCoordinate(latitude, \"Latitude\", -90, 90)");
    expect(settings).toContain("const parsedLongitude = parseOptionalCoordinate(longitude, \"Longitude\", -180, 180)");
    expect(settings).toContain("latitude: parsedLatitude");
    expect(settings).toContain("longitude: parsedLongitude");
    expect(settings).toContain("setLatitude(position.coords.latitude.toFixed(6))");
    expect(settings).toContain("setLongitude(position.coords.longitude.toFixed(6))");
    expect(settings).toContain("Eneo limepatikana. Bonyeza Hifadhi kuhifadhi mabadiliko.");
    expect(settings).toContain("Kifaa hiki hakiwezi kupata eneo lako.");
    expect(settings).toContain("Hatukuweza kupata eneo lako. Hakikisha umeruhusu Kanisa Connect kutumia Location kisha jaribu tena.");
    expect(geolocationHandler).not.toContain("supabase.from");
    expect(geolocationHandler).not.toContain(".update(");
    expect(settings.match(/from\("churches"\)\.select/g)).toHaveLength(1);
    expect(settings).not.toMatch(/from\("churches"\)\.insert|rpc\(/);
  });

  it("does not add another migration for the admin location UX simplification", () => {
    const wave22Migrations = readdirSync(join(process.cwd(), "supabase", "migrations")).filter((name) =>
      name.includes("church_location") || name.includes("location_coordinates"),
    );

    expect(wave22Migrations).toEqual(["20260921120000_add_church_location_coordinates.sql"]);
  });

  it("updates local church types for nullable coordinates", () => {
    const supabaseTypes = readSrc("integrations/supabase/types.ts");
    const churchType = readSrc("types/church.ts");

    expect(supabaseTypes).toContain("latitude: number | null");
    expect(supabaseTypes).toContain("longitude: number | null");
    expect(supabaseTypes).toContain("latitude?: number | null");
    expect(supabaseTypes).toContain("longitude?: number | null");
    expect(churchType).toContain("latitude: number | null");
    expect(churchType).toContain("longitude: number | null");
  });
});
