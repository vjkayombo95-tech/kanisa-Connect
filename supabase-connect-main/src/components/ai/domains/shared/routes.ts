import type { WorkspaceId } from "@/components/workspace";

export function financeIntelligenceRoute(workspace: WorkspaceId) {
  if (workspace === "finance") return "/finance/finance-intelligence";
  if (workspace === "church_admin") return "/church-admin/finance-intelligence";
  if (workspace === "super_admin") return "/super-admin/kanisa-ai";
  return null;
}

export function scriptureRoute(workspace: WorkspaceId) {
  if (workspace === "member") return "/portal/daily-readings";
  if (workspace === "pastoral") return "/pastoral/daily-readings";
  if (workspace === "church_admin") return "/church-admin/daily-readings";
  if (workspace === "finance") return "/finance/daily-readings";
  if (workspace === "super_admin") return "/super-admin/catholic-content";
  return null;
}

export function parishRoute(workspace: WorkspaceId) {
  if (workspace === "member") return "/portal/calendar";
  if (workspace === "pastoral") return "/pastoral/calendar";
  if (workspace === "church_admin") return "/church-admin/calendar";
  if (workspace === "finance") return "/finance/calendar";
  if (workspace === "super_admin") return "/super-admin";
  return null;
}

export function contentRoute(workspace: WorkspaceId) {
  if (workspace === "pastoral") return "/pastoral/announcements";
  if (workspace === "church_admin") return "/church-admin/announcements";
  if (workspace === "super_admin") return "/super-admin/catholic-content";
  return null;
}
