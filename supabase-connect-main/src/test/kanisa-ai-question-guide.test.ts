import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createKanisaAIContext, groupKanisaAIDiscovery, kanisaAIActionRegistry, resolveKanisaAIDiscovery } from "@/lib/ai";
import type { WorkspaceId } from "@/components/workspace";

function context(workspace: WorkspaceId, role: string, churchId: string | null = "church-1") {
  return createKanisaAIContext({ workspace, role, church: { id: churchId }, tenant: { id: churchId }, route: `/${workspace}/kanisa-ai` });
}

const labels = (workspace: WorkspaceId, role: string, churchId: string | null = "church-1") => resolveKanisaAIDiscovery(context(workspace, role, churchId)).map((item) => item.label);

describe("Kanisa AI question discovery registry", () => {
  it("maps every discovery entry to a controlled executable intent", () => {
    const controlled = new Set(["PENDING_INVITATIONS", "UPCOMING_EVENTS", "UNRESOLVED_PRAYER_REQUESTS", "CONTRIBUTION_SUMMARY", "MEMBER_COUNT", "NEW_MEMBERS", "OUTSTANDING_PLEDGES", "PENDING_MASS_INTENTIONS", "LIVE_MEDIA_STATUS", "ATTENTION_SUMMARY"]);
    for (const action of kanisaAIActionRegistry.filter((item) => item.discovery?.length)) expect(controlled.has(action.intent)).toBe(true);
  });

  it("has unique IDs and deterministic priority ordering", () => {
    const all = kanisaAIActionRegistry.flatMap((action) => action.discovery ?? []); expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    const first = resolveKanisaAIDiscovery(context("church_admin", "church_admin")); const second = resolveKanisaAIDiscovery(context("church_admin", "church_admin"));
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id)); expect(first.map((item) => item.priority)).toEqual([...first].map((item) => item.priority).sort((a, b) => a - b));
  });

  it("provides safe English and Kiswahili labels without operational data", () => {
    for (const item of kanisaAIActionRegistry.flatMap((action) => action.discovery ?? [])) { expect(item.labelEn.trim()).not.toBe(""); expect(item.labelSw.trim()).not.toBe(""); expect(item).not.toHaveProperty("count"); }
  });

  it("shows Church Admin finance, member, operations, pastoral, and live questions", () => {
    const result = labels("church_admin", "church_admin"); expect(result).toContain("How are contributions doing?"); expect(result).toContain("How many members do we have?"); expect(result).toContain("Show pending invitations"); expect(result).toContain("Any unresolved prayer requests?"); expect(result).toContain("Is anything live right now?");
  });

  it("keeps Treasurer discovery finance-focused and hides prayer", () => {
    const result = labels("finance", "treasurer"); expect(result).toContain("How are contributions doing?"); expect(result).toContain("Generate a contribution report"); expect(result).not.toContain("Any unresolved prayer requests?");
  });

  it("shows Pastor pastoral/event/live questions without private finance", () => {
    const result = labels("pastoral", "pastor"); expect(result).toContain("Any unresolved prayer requests?"); expect(result).toContain("How many Mass intentions are pending?"); expect(result).toContain("What events are coming up?"); expect(result).not.toContain("How are contributions doing?");
  });

  it("shows Secretary invitation, event, and member questions", () => {
    const result = labels("church_admin", "secretary"); expect(result).toContain("Show pending invitations"); expect(result).toContain("What events are coming up?"); expect(result).toContain("How many members do we have?");
  });

  it("shows members only their two supported non-staff questions", () => {
    const result = labels("member", "member"); expect(result).toEqual(["What events are coming up?", "Is anything live right now?", "Which radio stations are available?"]); expect(result).not.toContain("What needs my attention?"); expect(result).not.toContain("How many members do we have?");
  });

  it("fails closed for Community Leader and Super Admin without tenant context", () => {
    expect(labels("church_admin", "community_leader")).toEqual([]); expect(labels("super_admin", "super_admin", null)).toEqual([]);
  });

  it("hides empty categories", () => {
    const groups = groupKanisaAIDiscovery(resolveKanisaAIDiscovery(context("member", "member"))); expect(groups.every((group) => group.items.length > 0)).toBe(true); expect(groups.map((group) => group.category)).toEqual(["operations", "live"]);
  });

  it("uses the same registry for quick actions, desktop groups, and mobile More", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/ai/KanisaAIHome.tsx"), "utf8");
    expect(source).toContain("discoveryQuestions.slice(0, 4)"); expect(source).toContain("discoveryQuestions.slice(0, 3)"); expect(source).toContain("discoveryGroups.map");
    expect(source).not.toContain("ai.explore_assistants"); expect(source).not.toContain("ai.recent_commands"); expect(source).toContain("min-h-11");
  });

  it("submits known intents through the controlled conversation path and reuses report selection", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/ai/KanisaAIHome.tsx"), "utf8");
    expect(source).toContain("submitQuestion(question.label, question.intent)"); expect(source).toContain("createKanisaUserMessage(question.label)"); expect(source).toContain("appendAssistantResponse(periodSelectionResponse())");
  });
});
