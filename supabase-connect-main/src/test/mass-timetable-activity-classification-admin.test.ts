import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import {
  TIMETABLE_ACTIVITY_LABEL_KEYS,
  TIMETABLE_ACTIVITY_TYPES,
  type TimetableActivityType,
} from "@/lib/mass-timetable";

const source = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");
const page = source("pages/church-admin/MassTimetablePage.tsx");
const types = source("integrations/supabase/types.ts");
const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260927120000_add_timetable_activity_classification.sql"),
  "utf8",
);
const classificationRpcMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260927123000_classify_mass_schedule_activity_rpc.sql"),
  "utf8",
);
const sqlRegression = readFileSync(
  join(process.cwd(), "supabase/tests/timetable_activity_classification.sql"),
  "utf8",
);

describe("Mass Timetable admin activity classification", () => {
  it("exposes the approved activity types with English and Kiswahili labels", () => {
    expect(TIMETABLE_ACTIVITY_TYPES).toEqual(["mass", "confession", "adoration", "prayer", "other"]);

    for (const activityType of TIMETABLE_ACTIVITY_TYPES) {
      const key = TIMETABLE_ACTIVITY_LABEL_KEYS[activityType as TimetableActivityType].replace("mass_timetable_admin.", "");
      expect(en.mass_timetable_admin.activity_types).toHaveProperty(key.replace("activity_types.", ""));
      expect(sw.mass_timetable_admin.activity_types).toHaveProperty(key.replace("activity_types.", ""));
    }

    expect(sw.mass_timetable_admin.activity_types).toMatchObject({
      mass: "Misa",
      confession: "Maungamo",
      adoration: "Kuabudu Ekaristi",
      prayer: "Sala / Ibada",
      other: "Nyingine",
      unclassified: "Haijaainishwa",
    });
  });

  it("requires an explicit activity type for schedule create and edit saves", () => {
    expect(page).toContain('activity_type: "mass"');
    expect(page).toContain("if (!isActivityType(value.activity_type))");
    expect(page).toContain("activity_type,");
    expect(page).toContain('db.from("mass_schedules").insert({ ...scheduleFields, activity_type })');
    expect(page).toContain('db.from("mass_schedules").update(scheduleFields).eq("id", value.id).eq("church_id", churchId)');
    expect(page).not.toMatch(/name\.toLowerCase|row\.name\.includes|activity_type:\s*row\.name/i);
  });

  it("allows existing unclassified schedules to remain visibly unclassified until an admin chooses a type", () => {
    expect(page).toContain('activity_type: row.activity_type ?? ""');
    expect(page).toContain("TIMETABLE_ACTIVITY_LABEL_KEYS.unclassified");
    expect(page).toContain('variant={activityType ? "outline" : "destructive"}');
    expect(source("lib/mass-timetable.ts")).toContain('"mass_timetable_admin.activity_types.unclassified"');
    expect(en.mass_timetable_admin.activity_types.unclassified).toBe("Unclassified");
    expect(sw.mass_timetable_admin.activity_types.unclassified).toBe("Haijaainishwa");
  });

  it("uses the transactional classification RPC instead of direct occurrence updates", () => {
    expect(page).toContain('db.rpc("classify_mass_schedule_activity"');
    expect(page).toContain("p_church_id: churchId");
    expect(page).toContain("p_schedule_id: value.id");
    expect(page).toContain("p_activity_type: activity_type");
    expect(page).toContain("value.original_activity_type !== activity_type");
    expect(page).not.toMatch(/from\("mass_occurrences"\)[\s\S]*\.update\(\{ activity_type \}\)/);
    expect(page).not.toMatch(/delete\(\).*mass_occurrences|upsert\(.*mass_occurrences/i);
  });

  it("defines a database transaction boundary that locks and updates only eligible future occurrences", () => {
    expect(classificationRpcMigration).toContain("create or replace function public.classify_mass_schedule_activity");
    expect(classificationRpcMigration).toContain("security definer");
    expect(classificationRpcMigration).toContain("set search_path = public, pg_temp");
    expect(classificationRpcMigration).toContain("public.can_manage_church_workspace(v_actor, p_church_id)");
    expect(classificationRpcMigration).toContain("select *");
    expect(classificationRpcMigration).toContain("from public.mass_schedules");
    expect(classificationRpcMigration).toContain("for update");
    expect(classificationRpcMigration).toContain("pg_advisory_xact_lock(hashtextextended('mass_occurrence:' || o.id::text, 0))");
    expect(classificationRpcMigration).toContain("mass_schedule_id = p_schedule_id");
    expect(classificationRpcMigration).toContain("occurrence_date >= v_today");
    expect(classificationRpcMigration).toContain("status in ('scheduled', 'rescheduled')");
    expect(classificationRpcMigration).toContain("set activity_type = p_activity_type");
  });

  it("keeps generation and booking safety anchored in the Slice 2A database migration", () => {
    expect(page).toContain("generate_mass_occurrences");
    expect(migration).toContain("on conflict (mass_schedule_id, occurrence_date) where mass_schedule_id is not null do nothing");
    expect(migration).toContain("v_occ.activity_type is distinct from 'mass'");
    expect(migration).toContain("and o.activity_type = 'mass'");
  });

  it("blocks changes away from Mass when future reserving intentions exist and preserves rows", () => {
    expect(classificationRpcMigration).toContain("p_activity_type <> 'mass'");
    expect(classificationRpcMigration).toContain("join public.mass_intentions mi");
    expect(classificationRpcMigration).toContain("mi.status in ('pending', 'approved', 'scheduled', 'completed', 'archived')");
    expect(classificationRpcMigration).toContain("Cannot change this schedule away from Mass because future occurrences already have Mass intentions");
    expect(classificationRpcMigration).not.toMatch(/delete from public\.mass_occurrences|delete from public\.mass_intentions/i);
    expect(classificationRpcMigration).not.toMatch(/insert into public\.mass_occurrences|upsert/i);
  });

  it("uses the same occurrence-level advisory lock namespace as booking enforcement", () => {
    expect(classificationRpcMigration).toContain("pg_advisory_xact_lock(hashtextextended('mass_occurrence:' || o.id::text, 0))");
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('mass_occurrence:' || new.mass_occurrence_id::text, 0))");
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('mass_occurrence:' || p_mass_occurrence_id::text, 0))");
    expect(classificationRpcMigration).toContain("for update");
    expect(migration).toContain("for update");
  });

  it("covers successful, denied and rolled-back schedule classification in SQL regressions", () => {
    expect(sqlRegression).toContain("transactional schedule classification succeeds for authorized church admin");
    expect(sqlRegression).toContain("transactional schedule classification rejects cross-church access");
    expect(sqlRegression).toContain("transactional classification blocks changing a future booked Mass away from Mass");
    expect(sqlRegression).toContain("blocked classification leaves the schedule activity type unchanged");
    expect(sqlRegression).toContain("blocked classification leaves booked future occurrence activity type unchanged");
    expect(sqlRegression).toContain("transactional classification preserves occurrence ID and manual override fields");
    expect(sqlRegression).toContain("transactional classification does not rewrite historical occurrences");
  });

  it("exposes only authenticated execution for the classification RPC", () => {
    expect(classificationRpcMigration).toContain(
      "grant execute on function public.classify_mass_schedule_activity(uuid, uuid, text) to authenticated",
    );
    expect(classificationRpcMigration).toContain(
      "revoke all on function public.classify_mass_schedule_activity(uuid, uuid, text) from public, anon",
    );
    expect(types).toContain("classify_mass_schedule_activity");
  });

  it("updates frontend database types for the new nullable field and member-safe RPC return", () => {
    expect(types).toMatch(/mass_occurrences: \{[\s\S]*activity_type: string \| null[\s\S]*Insert: \{[\s\S]*activity_type\?: string \| null[\s\S]*Update: \{[\s\S]*activity_type\?: string \| null/);
    expect(types).toMatch(/mass_schedules: \{[\s\S]*activity_type: string \| null[\s\S]*Insert: \{[\s\S]*activity_type\?: string \| null[\s\S]*Update: \{[\s\S]*activity_type\?: string \| null/);
    expect(types).toContain("get_member_parish_schedule_masses");
    expect(types).toContain("activity_type: string | null");
  });
});
