import { assistantWorkspaceRoutes } from "./registry";
import type { AssistantPriority, AssistantTask, PersonalAssistantContext } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readNumber(source: unknown, path: string, fallback = 0) {
  const value = path.split(".").reduce<unknown>((current, key) => asRecord(current)[key], source);
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function task(id: string, title: string, detail: string, priority: AssistantPriority, to?: string): AssistantTask {
  return { id, title, detail, priority, to };
}

export function generateAssistantTasks(context: PersonalAssistantContext): AssistantTask[] {
  const data = context.dashboardContext;
  const routes = assistantWorkspaceRoutes[context.workspace];
  const tasks: AssistantTask[] = [];

  if (context.workspace === "member") {
    const prayers = readNumber(data, "prayers.totalCount");
    const intentions = readNumber(data, "massIntentions.totalCount");
    if (prayers > 0) tasks.push(task("member-prayers", `${prayers} prayer request${prayers === 1 ? "" : "s"} tracked`, "Check the latest status.", "medium", routes.prayerRequests));
    if (intentions > 0) tasks.push(task("member-intentions", `${intentions} Mass intention${intentions === 1 ? "" : "s"} active`, "Review scheduled and pending intentions.", "medium", routes.massIntentions));
    tasks.push(task("member-gospel", "Read today's Gospel", "Start with today's readings.", "low", routes.readings));
  } else if (context.workspace === "pastoral") {
    const prayerPending = readNumber(data, "summary.prayerRequests.pending");
    const intentionPending = readNumber(data, "summary.massIntentions.pending");
    if (prayerPending > 0) tasks.push(task("pastoral-prayers", `${prayerPending} prayer request${prayerPending === 1 ? "" : "s"} need review`, "Pastoral follow-up is waiting.", "high", routes.prayerRequests));
    if (intentionPending > 0) tasks.push(task("pastoral-intentions", `${intentionPending} Mass intention${intentionPending === 1 ? "" : "s"} need review`, "Review and schedule intentions.", "high", routes.massIntentions));
    tasks.push(task("pastoral-schedule", "Check today's schedule", "Prepare for ministry and celebrations.", "medium", routes.calendar));
  } else if (context.workspace === "church_admin") {
    const approvals = readNumber(data, "deferred.pendingMemberApprovals");
    const invitations = Array.isArray(asRecord(data).invitations) ? (asRecord(data).invitations as unknown[]).length : 0;
    if (approvals > 0) tasks.push(task("admin-members", `${approvals} member approval${approvals === 1 ? "" : "s"}`, "Review new member records.", "high", routes.members));
    if (invitations > 0) tasks.push(task("admin-invitations", `${invitations} invitation${invitations === 1 ? "" : "s"} to monitor`, "Check invitation status.", "medium", routes.invitations));
    tasks.push(task("admin-events", "Review parish calendar", "Keep upcoming events current.", "low", routes.calendar));
  } else if (context.workspace === "finance") {
    const pending = readNumber(data, "outstandingPledges");
    const recent = Array.isArray(asRecord(data).recentContributions) ? (asRecord(data).recentContributions as unknown[]).length : 0;
    if (pending > 0) tasks.push(task("finance-pledges", "Outstanding pledges need attention", "Review unpaid pledge balances.", "high", routes.pledges));
    if (recent > 0) tasks.push(task("finance-reconcile", `${recent} recent contribution${recent === 1 ? "" : "s"} available`, "Check payment references and receipts.", "medium", routes.contributions));
    tasks.push(task("finance-report", "Review finance report", "Open the latest contribution trend.", "low", routes.reports));
  } else {
    const alerts = readNumber(data, "activeAlertCount");
    const pendingChurches = readNumber(data, "pendingChurchCount");
    if (alerts > 0) tasks.push(task("platform-alerts", `${alerts} active platform alert${alerts === 1 ? "" : "s"}`, "Review system health.", "high", routes.health));
    if (pendingChurches > 0) tasks.push(task("platform-churches", `${pendingChurches} church approval${pendingChurches === 1 ? "" : "s"} pending`, "Review tenant readiness.", "medium", routes.churches));
    tasks.push(task("platform-imports", "Check recent imports", "Review import and automation status.", "low", routes.imports));
  }

  return tasks.slice(0, 4);
}

