import { describe, expect, it } from "vitest";

import {
  createKanisaAIContext,
  decideKanisaAIRoute,
  resolveKanisaAIExperience,
  routeKanisaAIRequest,
} from "@/lib/ai";
import type { WorkspaceId } from "@/components/workspace";

function context(workspace: WorkspaceId, role = "member") {
  return createKanisaAIContext({
    workspace,
    role: role as never,
    church: { id: "church-1" },
    tenant: { id: "church-1" },
    route: `/${workspace}`,
  });
}

describe("Kanisa AI workspace isolation", () => {
  it("resolves member assistants without admin or finance capabilities", () => {
    const experience = resolveKanisaAIExperience(context("member"));
    const assistantIds = experience.assistants.map((assistant) => assistant.id);
    const capabilityIds = experience.capabilities.map((capability) => capability.id);

    expect(assistantIds).toContain("my-faith-assistant");
    expect(assistantIds).toContain("parish-life-assistant");
    expect(assistantIds).not.toContain("finance-intelligence");
    expect(assistantIds).not.toContain("parish-operations-assistant");
    expect(capabilityIds).toContain("my-mass-intentions");
    expect(capabilityIds).toContain("my-contributions");
    expect(capabilityIds).not.toContain("giving-trends");
    expect(capabilityIds).not.toContain("manage-announcements");
    expect(capabilityIds).not.toContain("system-jobs");
  });

  it("allows member personal contributions but blocks parish-wide finance analytics", () => {
    const myGiving = decideKanisaAIRoute({ input: "show my contributions", context: context("member") });
    const trends = routeKanisaAIRequest({ input: "show church giving trends", context: context("member") });

    expect(myGiving.allowed).toBe(true);
    expect(myGiving.targetRoute).toBe("/portal/contribution-history");
    expect(trends.type).toBe("permission_denied");
  });

  it("keeps finance workspace focused on finance capabilities", () => {
    const experience = resolveKanisaAIExperience(context("finance", "finance"));
    const capabilityIds = experience.capabilities.map((capability) => capability.id);

    expect(experience.assistants.map((assistant) => assistant.id)).toContain("finance-intelligence");
    expect(capabilityIds).toContain("giving-trends");
    expect(capabilityIds).not.toContain("prayer-requests");
    expect(capabilityIds).not.toContain("system-jobs");
  });

  it("keeps pastoral workspace out of finance and platform capabilities", () => {
    const experience = resolveKanisaAIExperience(context("pastoral", "pastor"));
    const capabilityIds = experience.capabilities.map((capability) => capability.id);

    expect(capabilityIds).toContain("prayer-requests");
    expect(capabilityIds).toContain("mass-intentions");
    expect(capabilityIds).not.toContain("giving-trends");
    expect(capabilityIds).not.toContain("audit-logs");
  });

  it("uses platform-owned routes for super admin capabilities", () => {
    const experience = resolveKanisaAIExperience(context("super_admin", "super_admin"));
    const routes = experience.allowedNavigationTargets;

    expect(experience.assistants.map((assistant) => assistant.id)).toContain("platform-operations-assistant");
    expect(routes).toContain("/super-admin/jobs");
    expect(routes).toContain("/super-admin/catholic-content");
    expect(routes.some((route) => route.startsWith("/church-admin"))).toBe(false);
  });

  it("preview member experience resolves as member even for an admin role", () => {
    const experience = resolveKanisaAIExperience(context("member", "admin"));
    const capabilityIds = experience.capabilities.map((capability) => capability.id);

    expect(experience.workspace).toBe("member");
    expect(capabilityIds).toContain("my-contributions");
    expect(capabilityIds).not.toContain("members");
    expect(capabilityIds).not.toContain("giving-trends");
  });
});
