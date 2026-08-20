import type { StaffMobileWorkspace } from "@/lib/staff-mobile-role";
import { isStaffRouteAllowed } from "@/lib/staff-mobile-registry";

export type PendingCounts = {
  events: number;
  massIntentions: number;
  prayerRequests: number;
  communityHelp: number;
  invitations: number;
  announcements: number;
  payments: number;
  memberships: number;
  volunteers: number;
  total: number;
};

export type FinancialSummary = {
  totalReceived: number;
  thisMonthReceived: number;
  transactionCount: number;
  contributionTotal: number;
  pledgePaymentTotal: number;
  eventRegistrationTotal: number;
};

export const EMPTY_PENDING_COUNTS: PendingCounts = {
  events: 0,
  massIntentions: 0,
  prayerRequests: 0,
  communityHelp: 0,
  invitations: 0,
  announcements: 0,
  payments: 0,
  memberships: 0,
  volunteers: 0,
  total: 0,
};

export const EMPTY_FINANCIAL_SUMMARY: FinancialSummary = {
  totalReceived: 0,
  thisMonthReceived: 0,
  transactionCount: 0,
  contributionTotal: 0,
  pledgePaymentTotal: 0,
  eventRegistrationTotal: 0,
};

const actionDefinitions = [
  { key: "events", label: "Event approvals", route: "/church-admin/event-requests" },
  { key: "massIntentions", label: "Mass intentions", route: "/church-admin/mass-intentions" },
  { key: "prayerRequests", label: "Prayer requests", route: "/church-admin/prayer-requests" },
  { key: "communityHelp", label: "Community help", route: "/church-admin/community-help" },
  { key: "invitations", label: "Invitations and roles", route: "/church-admin/roles" },
  { key: "announcements", label: "Draft announcements", route: "/church-admin/announcements" },
  { key: "payments", label: "Payment verification", route: "/church-admin/qr-payments" },
  { key: "memberships", label: "Community requests", route: "/church-admin/communities" },
  { key: "volunteers", label: "Ministry volunteers", route: "/church-admin/ministries" },
] as const;

const readNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export function normalizePendingCounts(value: unknown): PendingCounts {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const counts = {
    events: readNumber(record.events),
    massIntentions: readNumber(record.massIntentions),
    prayerRequests: readNumber(record.prayerRequests),
    communityHelp: readNumber(record.communityHelp),
    invitations: readNumber(record.invitations),
    announcements: readNumber(record.announcements),
    payments: readNumber(record.payments),
    memberships: readNumber(record.memberships),
    volunteers: readNumber(record.volunteers),
  };
  return { ...counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
}

export function normalizeFinancialSummary(value: unknown): FinancialSummary {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    totalReceived: readNumber(record.total_received),
    thisMonthReceived: readNumber(record.this_month_received),
    transactionCount: readNumber(record.transaction_count),
    contributionTotal: readNumber(record.contribution_total),
    pledgePaymentTotal: readNumber(record.pledge_payment_total),
    eventRegistrationTotal: readNumber(record.event_registration_total),
  };
}

export function canRequestPendingCounts(workspace: StaffMobileWorkspace | null) {
  return workspace === "admin" || workspace === "pastoral" || workspace === "finance";
}

export function canRequestFinancialSummary(role: string | null, isSuperAdmin = false) {
  return isSuperAdmin || role === "church_admin" || role === "treasurer";
}

export function visiblePendingActions(counts: PendingCounts, workspace: StaffMobileWorkspace | null) {
  if (!canRequestPendingCounts(workspace)) return [];
  return actionDefinitions
    .filter((item) => counts[item.key] > 0 && isStaffRouteAllowed(workspace, item.route))
    .map((item) => ({ ...item, count: counts[item.key] }));
}
