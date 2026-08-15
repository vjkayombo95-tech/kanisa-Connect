import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSafeRadioUrl } from "@/lib/church-radio";

const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
const migration=read("supabase/migrations/20260814120000_production_radio.sql");
const memberRoutes=read("src/routes/MemberRoutes.tsx");
const adminRoutes=read("src/routes/AdminRoutes.tsx");
const superRoutes=read("src/routes/SuperAdminRoutes.tsx");

describe("Wave 5A production Radio contract",()=>{
  it("creates only the central directory and tenant selection tables",()=>{
    expect(migration).toContain("create table public.radio_stations");
    expect(migration).toContain("create table public.church_radio_stations");
    expect(migration).not.toMatch(/church_memberships|audio_jobs|whatsapp|sermon/i);
  });
  it("is default disabled for every existing church",()=>{
    expect(migration).toMatch(/select c\.id, f\.id, false/);
    expect(migration).not.toMatch(/set enabled = true|values \([^)]*'radio'[^)]*true\)/i);
  });
  it("grants management only to church admins and view to members",()=>{
    expect(migration).toContain("r.role = 'church_admin'");
    expect(migration).toContain("r.role in ('church_admin','member')");
    expect(migration).not.toMatch(/r\.role in \('church_admin','pastor'\)/);
    expect(migration).toContain("Radio management permission required");
  });
  it("enforces selected active approved own-church reads and anonymous denial",()=>{
    expect(migration).toContain("selection.enabled");
    expect(migration).toContain("is_active and is_approved");
    expect(migration).toContain("public.has_radio_permission(auth.uid(), selection.church_id, 'view')");
    expect(migration).toContain("revoke all on table public.radio_stations, public.church_radio_stations from public, anon, authenticated");
    expect(migration).toContain("public.has_radio_permission(auth.uid(), church_id, 'manage')");
    expect(migration).toContain("grant select on public.church_radio_stations to authenticated");
    expect(migration).not.toContain("grant select, insert, update, delete on public.church_radio_stations");
  });
  it("keeps central approval under super-admin control",()=>{
    expect(migration).toContain('policy "Super admins manage radio directory"');
    expect(migration).toContain("public.is_super_admin(auth.uid())");
  });
  it("registers only the approved routes",()=>{
    expect(memberRoutes).toContain('path="radio"');
    expect(adminRoutes).toContain('path="radio"');
    expect(superRoutes).toContain('path="radio"');
  });
  it("rejects unsafe stream targets before database submission",()=>{
    expect(isSafeRadioUrl("https://radio.example.org/live.mp3")).toBe(true);
    for(const value of ["http://radio.example.org/live","https://localhost/live","https://127.0.0.1/live","https://10.0.0.1/live","https://user:pass@example.org/live","not-a-url"])expect(isSafeRadioUrl(value)).toBe(false);
  });
});
