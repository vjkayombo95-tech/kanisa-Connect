import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

type UatMember = "choir" | "youth" | "general" | "multi";

const visibilityMatrix: Record<string, Record<UatMember, boolean>> = {
  "UAT Choir Rehearsal": { choir: true, youth: false, general: false, multi: true },
  "UAT Youth Retreat": { choir: false, youth: true, general: false, multi: true },
  "UAT Choir + Youth Meeting": { choir: true, youth: true, general: false, multi: true },
  "UAT Parish Meeting": { choir: true, youth: true, general: true, multi: true },
  "UAT Public Parish Event": { choir: true, youth: true, general: true, multi: true },
};

function visibleEventsFor(member: UatMember) {
  return Object.entries(visibilityMatrix)
    .filter(([, permissions]) => permissions[member])
    .map(([event]) => event);
}

function repoFile(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("RC-2.7.7 targeted event UAT preparation", () => {
  it("defines the expected member visibility matrix", () => {
    expect(visibleEventsFor("choir")).toEqual([
      "UAT Choir Rehearsal",
      "UAT Choir + Youth Meeting",
      "UAT Parish Meeting",
      "UAT Public Parish Event",
    ]);
    expect(visibleEventsFor("youth")).toEqual([
      "UAT Youth Retreat",
      "UAT Choir + Youth Meeting",
      "UAT Parish Meeting",
      "UAT Public Parish Event",
    ]);
    expect(visibleEventsFor("general")).toEqual(["UAT Parish Meeting", "UAT Public Parish Event"]);
    expect(visibleEventsFor("multi")).toEqual(Object.keys(visibilityMatrix));
  });

  it("keeps direct unauthorized event access out of authorized feed fixtures", () => {
    const generalFeed = visibleEventsFor("general");

    expect(generalFeed).not.toContain("UAT Choir Rehearsal");
    expect(generalFeed).not.toContain("UAT Youth Retreat");
    expect(generalFeed).not.toContain("UAT Choir + Youth Meeting");
  });

  it("seeds distinct UAT identities, ministries, memberships, and parent events idempotently", () => {
    const bootstrap = repoFile("scripts/bootstrap-staging.ts");

    for (const email of [
      "uat.choir.member@kanisaconnect.test",
      "uat.youth.member@kanisaconnect.test",
      "uat.general.member@kanisaconnect.test",
      "uat.multigroup.member@kanisaconnect.test",
    ]) {
      expect(bootstrap).toContain(email);
    }

    expect(bootstrap).toContain("SEEDED_TARGETED_MINISTRIES");
    expect(bootstrap).toContain("member_ministries");
    expect(bootstrap).toContain("UAT Choir Rehearsal");
    expect(bootstrap).toContain("recurrence_frequency: \"weekly\"");
    expect(bootstrap).toContain("event_audience_targets");
    expect(bootstrap).toContain("Targeted event ministry targets are correct");
  });

  it("keeps Choir and Youth member account provisioning symmetrical and fully health-checked", () => {
    const bootstrap = repoFile("scripts/bootstrap-staging.ts");

    expect(bootstrap).toContain('key: "choir_member"');
    expect(bootstrap).toContain('key: "youth_member"');
    expect(bootstrap).toContain('user_id: usersByRole.get("choir_member")');
    expect(bootstrap).toContain('user_id: usersByRole.get("youth_member")');
    expect(bootstrap).toContain("Choir Member");
    expect(bootstrap).toContain("Youth Member");
    expect(bootstrap).toContain("General Member");
    expect(bootstrap).toContain("Multi-Group Member");
    expect(bootstrap).toContain("full account fixture is linked");
    expect(bootstrap).toContain("member user_id mismatch");
    expect(bootstrap).toContain("member user_role missing");
    expect(bootstrap).toContain('["choir!=youth", !(await memberHasMinistry(choirMemberId, youthId))]');
    expect(bootstrap).toContain('["youth!=choir", !(await memberHasMinistry(youthMemberId, choirId))]');
  });

  it("allows staging reruns to pass both super_admins schema shapes before member seeding", () => {
    const bootstrap = repoFile("scripts/bootstrap-staging.ts");

    expect(bootstrap).toContain("seedSuperAdminMarker");
    expect(bootstrap).toContain('hasColumn("super_admins", "id")');
    expect(bootstrap).toContain('hasColumn("super_admins", "user_id")');
    expect(bootstrap).toContain('{ id: superAdminId }');
    expect(bootstrap).toContain('{ user_id: superAdminId }');
    expect(bootstrap).toContain('await seedRoles(churchId, usersByRole);');
    expect(bootstrap).toContain('const members = await seedMembers(churchId, usersByRole);');
  });

  it("keeps bootstrap reset scoped to bootstrap-owned event records", () => {
    const bootstrap = repoFile("scripts/bootstrap-staging.ts");

    expect(bootstrap).toContain(".in(\"title\", [...SEEDED_EVENT_TITLES, ...SEEDED_TARGETED_EVENT_TITLES])");
    expect(bootstrap).toContain(".in(\"event_id\", eventIds)");
    expect(bootstrap).not.toContain(".from(\"event_attendances\").select(\"id\").eq(\"church_id\", churchId)");
  });

  it("keeps RLS authorization anchored on can_view_event and same-church target validation", () => {
    const migration = repoFile("supabase/migrations/20260704131000_event_audience_targeting.sql");

    expect(migration).toContain("create or replace function public.can_view_event");
    expect(migration).toContain("public.member_ministries mm");
    expect(migration).toContain("lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))");
    expect(migration).toContain("create trigger validate_event_audience_target_church");
    expect(migration).toContain("public.can_view_event(auth.uid(), id)");
    expect(migration).toContain("public.can_manage_church_roles(auth.uid(), church_id)");
  });
});
