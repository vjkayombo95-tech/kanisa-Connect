import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isSafeRadioStreamUrl } from "@/lib/church-radio";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260810120000_add_church_live_radio.sql");
const provider = read("src/contexts/RadioPlayerContext.tsx");
const memberPage = read("src/pages/portal/MemberRadioPage.tsx");
const adminPage = read("src/pages/church-admin/RadioStationsPage.tsx");
const hook = read("src/hooks/use-church-radio.ts");
const app = read("src/App.tsx");

describe("church live radio", () => {
  it("uses a multi-station tenant model separate from video livestreams", () => {
    expect(migration).toContain("create table public.church_radio_stations");
    expect(migration).toContain("church_id uuid not null references public.churches");
    expect(migration).toContain("is_featured boolean");
    expect(migration).not.toContain("insert into public.church_radio_stations");
  });

  it("limits members to active same-church feature-authorized rows", () => {
    expect(migration).toContain("is_active\n  and public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'view')");
    expect(hook).toContain("fetchMemberRadioStations(churchId!)");
    expect(read("src/lib/church-radio.ts")).toContain('.eq("church_id", churchId).eq("is_active", true)');
  });

  it("requires explicit own-church admin manage permission", () => {
    expect(migration.match(/'radio', 'manage'/g)?.length).toBeGreaterThanOrEqual(4);
    expect(adminPage).toContain('useChurchPermission("radio", "manage")');
  });

  it("rejects unsafe stream URLs without requiring a file extension", () => {
    expect(isSafeRadioStreamUrl("https://dreamsiteradiocp2.com/proxy/rmtanzania2?mp=/stream")).toBe(true);
    for (const value of ["http://example.com/live", "javascript:alert(1)", "data:audio/mpeg,x", "file:///tmp/a", "https://localhost/live", "https://127.0.0.1/live", "https://10.0.0.2/live", "https://192.168.1.2/live", "https://172.16.0.1/live"]) expect(isSafeRadioStreamUrl(value)).toBe(false);
  });

  it("never autoplays and connects Audio directly to the configured provider", () => {
    expect(provider).toContain("new Audio(next.streamUrl)");
    expect(provider).toContain('audio.preload = "none"');
    expect(provider).not.toContain("autoplay");
    expect(migration).toContain("audio bytes flow directly from provider to member browser");
  });

  it("provides play, pause, retry, volume, and safe failure UX", () => {
    expect(memberPage).toContain("Sikiliza LIVE");
    expect(memberPage).toContain("player.pause()");
    expect(memberPage).toContain("player.retry()");
    expect(memberPage).toContain('type="range"');
    expect(memberPage).toContain("Hatujaweza kuunganisha radio kwa sasa.");
  });

  it("owns one audio element and replaces the old stream", () => {
    expect(provider).toContain("audioRef.current?.pause()");
    expect(provider).toContain("audioRef.current = audio");
  });

  it("persists above routes and stops on logout or church changes", () => {
    expect(app).toContain("<RadioPlayerProvider>");
    expect(provider).toContain("next.churchId !== scopeRef.current.churchId");
    expect(provider).toContain("!next.userId");
    expect(provider).toContain('window.dispatchEvent(new PopStateEvent("popstate"))');
    expect(provider).toContain('document.addEventListener("click", keepPlaybackOnPortalNavigation, true)');
  });

  it("keeps the mobile mini-player above navigation and desktop compact", () => {
    expect(provider).toContain("bottom-[calc(4.75rem+env(safe-area-inset-bottom))]");
    expect(provider).toContain("lg:bottom-4 lg:right-4 lg:w-96");
  });

  it("keeps the Radio Maria development endpoint configurable", () => {
    expect(migration).not.toContain("dreamsiteradiocp2.com");
    expect(memberPage).not.toContain("Radio Maria");
    expect(adminPage).toContain("Stream URL");
  });
});
