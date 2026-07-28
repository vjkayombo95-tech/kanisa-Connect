import type { ReactNode } from "react";
import {
  Archive,
  Bookmark,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit,
  ExternalLink,
  Eye,
  FileText,
  Highlighter,
  Megaphone,
  MessageSquare,
  NotebookPen,
  Pin,
  Plus,
  Reply,
  Share2,
} from "lucide-react";

import type { WorkspaceConfig, WorkspaceId, WorkspaceNavigationGroup, WorkspaceNavigationItem } from "./framework";
import type { FeatureState } from "@/hooks/use-feature-access";
import type { AppRole } from "@/lib/role-utils";

export type WorkspacePagePermission =
  | "read"
  | "create"
  | "edit"
  | "archive"
  | "publish"
  | "review"
  | "assign"
  | "respond"
  | "complete"
  | "schedule"
  | "export"
  | "manage"
  | "cms"
  | "payment_status";

export const ALL_WORKSPACE_PAGE_PERMISSIONS: WorkspacePagePermission[] = [
  "read",
  "create",
  "edit",
  "archive",
  "publish",
  "review",
  "assign",
  "respond",
  "complete",
  "schedule",
  "export",
  "manage",
  "cms",
  "payment_status",
];

export type WorkspacePageAction = {
  id: string;
  label: string;
  icon?: (props: { className?: string }) => ReactNode;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  hidden?: boolean;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  permission?: WorkspacePagePermission;
};

export type WorkspacePageBranding = {
  title: string;
  description?: string;
  badge: string;
  icon?: WorkspaceConfig["icon"];
};

export type WorkspacePageContext = {
  workspace: WorkspaceConfig;
  workspaceId: WorkspaceId;
  role: AppRole | "priest" | "finance" | null;
  permissions: Set<WorkspacePagePermission>;
  featureFlags: {
    getFeatureState: (key: string) => FeatureState;
    isFeatureVisible: (key: string) => boolean;
    isFeatureLocked: (key: string) => boolean;
    isFeatureEnabled: (key: string) => boolean;
  };
  navigation: WorkspaceNavigationGroup[];
  branding: WorkspacePageBranding;
  quickActions: WorkspaceNavigationItem[];
};

export const WORKSPACE_PAGE_PERMISSIONS: Record<WorkspaceId, WorkspacePagePermission[]> = {
  member: ["read", "create"],
  pastoral: ["read", "review", "assign", "respond", "complete", "schedule"],
  church_admin: ["read", "create", "edit", "archive", "publish", "export", "manage", "cms"],
  finance: ["read", "payment_status"],
  super_admin: ["read", "create", "edit", "archive", "publish", "review", "assign", "respond", "complete", "schedule", "export", "manage", "cms", "payment_status"],
};

export function resolveWorkspacePagePermissions(
  workspaceId: WorkspaceId,
  hasAuthoritativeRoutePermission: boolean,
  decisions: Partial<Record<WorkspacePagePermission, boolean>> = {},
) {
  const candidates = hasAuthoritativeRoutePermission
    ? ALL_WORKSPACE_PAGE_PERMISSIONS
    : (WORKSPACE_PAGE_PERMISSIONS[workspaceId] ?? []);

  return new Set(candidates.filter((permission) => !hasAuthoritativeRoutePermission || decisions[permission] === true));
}

export type WorkspacePageKind =
  | "daily_readings"
  | "announcements"
  | "prayer_requests"
  | "mass_intentions"
  | "calendar"
  | "saints"
  | "bible";

type WorkspacePageActionHandlers = Record<string, () => void>;

function bindHandlers(actions: WorkspacePageAction[], handlers: WorkspacePageActionHandlers = {}) {
  return actions.map((action) => ({
    ...action,
    onClick: action.onClick ?? handlers[action.id],
  }));
}

export function getWorkspacePageActions(
  kind: WorkspacePageKind,
  page: Pick<WorkspacePageContext, "workspaceId" | "permissions">,
  handlers: WorkspacePageActionHandlers = {},
): WorkspacePageAction[] {
  const readonlyAction = (label = "Read only"): WorkspacePageAction => ({
    id: "read",
    label,
    icon: Eye,
    permission: "read",
    disabled: true,
  });

  const actions: Record<WorkspacePageKind, Partial<Record<WorkspaceId, WorkspacePageAction[]>>> = {
    daily_readings: {
      member: [
        { id: "read_today", label: "Read Today's Readings", icon: BookOpen, permission: "read" },
        { id: "share", label: "Share", icon: Share2, permission: "read" },
      ],
      pastoral: [
        { id: "read_today", label: "Read Today's Readings", icon: BookOpen, permission: "read" },
        { id: "prepare_homily", label: "Prepare Homily", icon: NotebookPen, permission: "review", disabled: true },
        { id: "pastoral_notes", label: "Pastoral Notes", icon: FileText, permission: "review", disabled: true },
        { id: "mark_reviewed", label: "Mark Reviewed", icon: CheckCircle2, permission: "review", disabled: true },
      ],
      church_admin: [
        { id: "view", label: "View", icon: Eye, permission: "read" },
        { id: "publish_status", label: "Publish Status", icon: Megaphone, permission: "publish", disabled: true },
        { id: "open_cms", label: "Open CMS", icon: ExternalLink, permission: "cms", disabled: true },
      ],
      finance: [readonlyAction()],
    },
    announcements: {
      member: [readonlyAction()],
      pastoral: [
        { id: "read", label: "Read", icon: Eye, permission: "read" },
        { id: "pin", label: "Pin", icon: Pin, permission: "review", disabled: true },
        { id: "share_ministries", label: "Share to Ministries", icon: Share2, permission: "review", disabled: true },
      ],
      church_admin: [
        { id: "create", label: "Create", icon: Plus, permission: "create" },
        { id: "edit", label: "Edit", icon: Edit, permission: "edit", disabled: true },
        { id: "archive", label: "Archive", icon: Archive, permission: "archive", disabled: true },
        { id: "publish", label: "Publish", icon: Megaphone, permission: "publish", disabled: true },
      ],
      finance: [readonlyAction()],
    },
    prayer_requests: {
      member: [
        { id: "create", label: "Create", icon: Plus, permission: "create" },
        { id: "track_status", label: "Track Status", icon: ClipboardCheck, permission: "read" },
      ],
      pastoral: [
        { id: "review", label: "Review", icon: ClipboardCheck, permission: "review" },
        { id: "assign", label: "Assign", icon: MessageSquare, permission: "assign", disabled: true },
        { id: "respond", label: "Respond", icon: Reply, permission: "respond", disabled: true },
        { id: "complete", label: "Complete", icon: CheckCircle2, permission: "complete", disabled: true },
      ],
      church_admin: [
        { id: "view", label: "View", icon: Eye, permission: "read" },
        { id: "export", label: "Export", icon: Download, permission: "export", disabled: true },
      ],
      finance: [readonlyAction()],
    },
    mass_intentions: {
      member: [
        { id: "create", label: "Create", icon: Plus, permission: "create" },
        { id: "track", label: "Track", icon: ClipboardCheck, permission: "read" },
      ],
      pastoral: [
        { id: "review", label: "Review", icon: ClipboardCheck, permission: "review" },
        { id: "schedule", label: "Schedule", icon: CalendarDays, permission: "schedule" },
        { id: "assign_mass", label: "Assign Mass", icon: BookOpen, permission: "assign", disabled: true },
        { id: "complete", label: "Complete", icon: CheckCircle2, permission: "complete" },
      ],
      church_admin: [{ id: "oversight", label: "Oversight", icon: Eye, permission: "manage" }],
      finance: [{ id: "payment_status", label: "Payment Status", icon: ClipboardCheck, permission: "payment_status" }],
    },
    calendar: {
      member: [
        { id: "view", label: "View", icon: Eye, permission: "read" },
        { id: "rsvp", label: "RSVP", icon: CheckCircle2, permission: "create", disabled: true },
      ],
      pastoral: [{ id: "manage_pastoral_schedule", label: "Manage Pastoral Schedule", icon: CalendarDays, permission: "schedule" }],
      church_admin: [{ id: "manage_parish_calendar", label: "Manage Parish Calendar", icon: CalendarDays, permission: "manage" }],
      finance: [{ id: "financial_events", label: "Financial Events Only", icon: CalendarDays, permission: "payment_status" }],
    },
    saints: {
      member: [
        { id: "read", label: "Read", icon: Eye, permission: "read" },
        { id: "bookmark", label: "Bookmark", icon: Bookmark, permission: "read", disabled: true },
      ],
      pastoral: [
        { id: "read", label: "Read", icon: Eye, permission: "read" },
        { id: "pastoral_notes", label: "Pastoral Notes", icon: NotebookPen, permission: "review", disabled: true },
      ],
      church_admin: [{ id: "edit_cms", label: "Edit in CMS", icon: ExternalLink, permission: "cms", disabled: true }],
      finance: [readonlyAction()],
    },
    bible: {
      member: [
        { id: "read", label: "Read", icon: BookOpen, permission: "read" },
        { id: "highlight", label: "Highlight", icon: Highlighter, permission: "read", disabled: true },
        { id: "bookmark", label: "Bookmark", icon: Bookmark, permission: "read", disabled: true },
      ],
      pastoral: [
        { id: "read", label: "Read", icon: BookOpen, permission: "read" },
        { id: "homily_notes", label: "Homily Notes", icon: NotebookPen, permission: "review", disabled: true },
        { id: "study_mode", label: "Study Mode", icon: FileText, permission: "review", disabled: true },
      ],
      church_admin: [{ id: "read", label: "Read", icon: BookOpen, permission: "read" }],
      finance: [{ id: "read", label: "Read", icon: BookOpen, permission: "read" }],
    },
  };

  return bindHandlers(actions[kind][page.workspaceId] ?? [], handlers);
}
