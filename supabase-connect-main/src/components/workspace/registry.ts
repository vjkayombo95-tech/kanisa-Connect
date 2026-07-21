import {
  Award,
  AudioLines,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Church,
  ClipboardList,
  CreditCard,
  Eye,
  FileText,
  HandCoins,
  HeartHandshake,
  HelpCircle,
  Import,
  Lock,
  Megaphone,
  Receipt,
  Settings,
  Shield,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";

import { dashboardConfigs } from "@/components/portal/dashboard";

import type { WorkspaceConfig, WorkspaceId } from "./framework";

export const workspaceRegistry = {
  member: {
    id: "member",
    title: "Member Workspace",
    description: "Personal faith, giving, and parish life.",
    icon: Church,
    roles: ["member"],
    dashboard: dashboardConfigs.member,
    navigation: [
      {
        id: "member-home",
        label: "Home",
        items: [
          { id: "dashboard", label: "Dashboard", to: "/portal", icon: Church },
          { id: "my-parish", label: "My Parish", to: "/portal/my-parish", icon: Church },
          { id: "kanisa-ai", label: "Kanisa AI", to: "/portal/kanisa-ai", icon: Sparkles, featureFlag: "kanisa_ai" },
        ],
      },
      {
        id: "member-liturgy",
        label: "Liturgy",
        items: [
          { id: "bible", label: "Bible", to: "/portal/bible", icon: BookOpen, featureFlag: "bible_verses" },
          { id: "daily-readings", label: "Daily Readings", to: "/portal/daily-readings", icon: BookOpen, featureFlag: "catholic_content" },
          { id: "prayer-library", label: "Maktaba ya Sala", to: "/portal/prayers", icon: HeartHandshake, featureFlag: "catholic_content" },
          { id: "saints", label: "Saints", to: "/portal/library", icon: Sparkles, featureFlag: "catholic_content" },
          { id: "liturgical-calendar", label: "Liturgical Calendar", to: "/portal/liturgical-calendar", icon: CalendarDays, featureFlag: "catholic_content" },
          { id: "prayer", label: "Prayer Requests", to: "/portal/prayer-requests", icon: HeartHandshake, featureFlag: "prayer_requests" },
          { id: "reflection", label: "Reflection", to: "/portal/reflections", icon: BookOpen, featureFlag: "catholic_content" },
          { id: "mass-intentions", label: "Mass Intentions", to: "/portal/mass-intentions", icon: ClipboardList, featureFlag: "mass_intentions" },
        ],
      },
      {
        id: "member-community",
        label: "Community",
        items: [
          { id: "calendar", label: "Parish Calendar", to: "/portal/calendar", icon: CalendarDays, featureFlag: "events" },
          { id: "events", label: "Events", to: "/portal/events", icon: CalendarDays, featureFlag: "events" },
          { id: "event-requests", label: "Event Requests", to: "/portal/event-requests", icon: CalendarDays, featureFlag: "event_requests" },
          { id: "announcements", label: "Announcements", to: "/portal/announcements", icon: Megaphone, featureFlag: "announcements" },
          { id: "ministries", label: "Ministries", to: "/portal/ministries", icon: Users, featureFlag: "ministries" },
          { id: "community-help", label: "Community Help", to: "/portal/community-help", icon: HelpCircle, featureFlag: "community_help" },
          { id: "channels", label: "Communities", to: "/portal/channels", icon: Users, featureFlag: "channels" },
        ],
      },
      {
        id: "member-finance",
        label: "Giving",
        items: [
          { id: "giving", label: "Giving", to: "/portal/give", icon: HandCoins, featureFlag: "give" },
          { id: "contribution-history", label: "Contribution History", to: "/portal/contribution-history", icon: Receipt, featureFlag: "contributions" },
          { id: "pledges", label: "Pledges", to: "/portal/pledges", icon: ClipboardList, featureFlag: "pledges" },
          { id: "giving-mass-intentions", label: "Mass Intentions", to: "/portal/mass-intentions", icon: ClipboardList, featureFlag: "mass_intentions" },
        ],
      },
    ],
    quickActions: [
      { id: "give", label: "Give Now", to: "/portal/give", icon: HandCoins, featureFlag: "give" },
      { id: "kanisa-ai", label: "Kanisa AI", to: "/portal/kanisa-ai", icon: Sparkles, featureFlag: "kanisa_ai" },
      { id: "bible", label: "Bible", to: "/portal/bible", icon: BookOpen, featureFlag: "bible_verses" },
      { id: "prayer", label: "Prayer", to: "/portal/prayer-requests", icon: HeartHandshake, featureFlag: "prayer_requests" },
      { id: "ministries", label: "Ministries", to: "/portal/ministries", icon: Users, featureFlag: "ministries" },
      { id: "events", label: "Events", to: "/portal/events", icon: CalendarDays, featureFlag: "events" },
    ],
  },
  pastoral: {
    id: "pastoral",
    title: "Pastoral Workspace",
    description: "Daily ministry and pastoral care.",
    icon: HeartHandshake,
    roles: ["pastor", "priest"],
    dashboard: dashboardConfigs.priest,
    navigation: [
      {
        id: "pastoral-home",
        label: "Home",
        items: [
          { id: "dashboard", label: "Dashboard", to: "/pastoral", icon: HeartHandshake },
          { id: "kanisa-ai", label: "Kanisa AI", to: "/pastoral/kanisa-ai", icon: Sparkles, featureFlag: "kanisa_ai" },
          { id: "todays-ministry", label: "Today's Ministry", to: "/pastoral", icon: BookOpen, featureFlag: "catholic_content" },
        ],
      },
      {
        id: "pastoral-care",
        label: "Pastoral Care",
        items: [
          { id: "mass-intentions", label: "Mass Intentions", to: "/pastoral/mass-intentions", icon: ClipboardList, featureFlag: "mass_intentions" },
          { id: "prayer-requests", label: "Prayer Requests", to: "/pastoral/prayer-requests", icon: HeartHandshake, featureFlag: "prayer_requests" },
          { id: "community-help", label: "Community Help", to: "/pastoral/community-help", icon: HelpCircle, featureFlag: "community_help" },
          { id: "mass-schedule", label: "Mass Schedule", to: "/pastoral/mass-schedule", icon: CalendarDays, featureFlag: "events" },
          { id: "sacraments", label: "Sacraments", to: "/pastoral/sacraments", icon: Award, featureFlag: "sacraments" },
        ],
      },
      {
        id: "pastoral-liturgy",
        label: "Liturgy",
        items: [
          { id: "bible", label: "Bible", to: "/pastoral/bible", icon: BookOpen, featureFlag: "bible_verses" },
          { id: "daily-readings", label: "Daily Readings", to: "/pastoral/daily-readings", icon: BookOpen, featureFlag: "catholic_content" },
          { id: "saints", label: "Saints", to: "/pastoral/saints", icon: Sparkles, featureFlag: "catholic_content" },
          { id: "liturgical-calendar", label: "Liturgical Calendar", to: "/pastoral/liturgical-calendar", icon: CalendarDays, featureFlag: "catholic_content" },
        ],
      },
      {
        id: "pastoral-operations",
        label: "Operations",
        items: [
          { id: "calendar", label: "Parish Calendar", to: "/pastoral/calendar", icon: CalendarDays, featureFlag: "events" },
          { id: "events", label: "Events", to: "/pastoral/events", icon: CalendarDays, featureFlag: "events" },
          { id: "announcements", label: "Announcements", to: "/pastoral/announcements", icon: Megaphone, featureFlag: "announcements" },
          { id: "finance-summary", label: "Finance Summary", to: "/pastoral/contributions", icon: Wallet, featureFlag: "contributions" },
        ],
      },
    ],
    quickActions: [
      { id: "prayer-requests", label: "Review Prayer Requests", to: "/pastoral/prayer-requests", icon: HeartHandshake, featureFlag: "prayer_requests" },
      { id: "kanisa-ai", label: "Kanisa AI", to: "/pastoral/kanisa-ai", icon: Sparkles, featureFlag: "kanisa_ai" },
      { id: "mass-intentions", label: "Review Mass Intentions", to: "/pastoral/mass-intentions", icon: ClipboardList, featureFlag: "mass_intentions" },
      { id: "sacraments", label: "Sacraments", to: "/pastoral/sacraments", icon: Award, featureFlag: "sacraments" },
      { id: "announcements", label: "Announcements", to: "/pastoral/announcements", icon: Megaphone, featureFlag: "announcements" },
      { id: "finance-summary", label: "Finance Summary", to: "/pastoral/contributions", icon: Wallet, featureFlag: "contributions" },
    ],
  },
  church_admin: {
    id: "church_admin",
    title: "Church Admin Workspace",
    description: "Parish operations and administration.",
    icon: Building2,
    roles: ["church_admin", "pastor", "secretary"],
    dashboard: dashboardConfigs.church_admin,
    navigation: [
      {
        id: "admin-home",
        label: "Home",
        items: [
          { id: "dashboard", label: "Dashboard", to: "/church-admin", icon: Building2 },
          { id: "kanisa-ai", label: "Kanisa AI", to: "/church-admin/kanisa-ai", icon: Sparkles, featureFlag: "kanisa_ai" },
        ],
      },
      {
        id: "admin-people",
        label: "People",
        items: [
          { id: "members", label: "Members", to: "/church-admin/members", icon: Users, featureFlag: "members" },
          { id: "roles", label: "Invitations & Roles", to: "/church-admin/roles", icon: UserCheck, featureFlag: "roles" },
          { id: "attendance", label: "Attendance", to: "/church-admin/mass-schedule", icon: ClipboardList, featureFlag: "events" },
          { id: "families", label: "Families", to: "/church-admin/families", icon: Users, featureFlag: "families" },
          { id: "communities", label: "Communities", to: "/church-admin/communities", icon: Users, featureFlag: "communities" },
          { id: "ministries", label: "Ministries", to: "/church-admin/ministries", icon: Users, featureFlag: "ministries" },
          { id: "community-help", label: "Community Help", to: "/church-admin/community-help", icon: HelpCircle, featureFlag: "community_help" },
        ],
      },
      {
        id: "admin-liturgy",
        label: "Liturgy",
        items: [
          { id: "bible", label: "Bible", to: "/church-admin/bible", icon: BookOpen, featureFlag: "bible_verses" },
          { id: "daily-readings", label: "Daily Readings", to: "/church-admin/daily-readings", icon: BookOpen, featureFlag: "catholic_content" },
          { id: "prayer-library", label: "Prayer Library", to: "/church-admin/prayers", icon: HeartHandshake, featureFlag: "catholic_content" },
          { id: "saints", label: "Saints", to: "/church-admin/saints", icon: Sparkles, featureFlag: "catholic_content" },
          { id: "prayer-requests", label: "Prayer Requests", to: "/church-admin/prayer-requests", icon: HeartHandshake, featureFlag: "prayer_requests" },
          { id: "mass-intentions", label: "Mass Intentions", to: "/church-admin/mass-intentions", icon: ClipboardList, featureFlag: "mass_intentions" },
          { id: "mass-timetable", label: "Mass Timetable", to: "/church-admin/mass-timetable", icon: CalendarDays, featureFlag: "mass_intentions" },
        ],
      },
      {
        id: "admin-operations",
        label: "Operations",
        items: [
          { id: "calendar", label: "Parish Calendar", to: "/church-admin/calendar", icon: CalendarDays, featureFlag: "events" },
          { id: "events", label: "Events", to: "/church-admin/events", icon: CalendarDays, featureFlag: "events" },
          { id: "event-requests", label: "Event Requests", to: "/church-admin/event-requests", icon: CalendarDays, featureFlag: "event_requests" },
          { id: "announcements", label: "Announcements", to: "/church-admin/announcements", icon: Megaphone, featureFlag: "announcements" },
          { id: "sermons", label: "Sermons", to: "/church-admin/sermons", icon: BookOpen, featureFlag: "sermons" },
          { id: "operations", label: "Operations", to: "/church-admin/operations", icon: Bell, featureFlag: "operations", requireFeatureEnabled: true },
          { id: "audio-processing", label: "Audio Processing", to: "/church-admin/audio", icon: AudioLines, featureFlag: "audio_processing", requireFeatureEnabled: true },
          { id: "reports", label: "Reports", to: "/church-admin/reports", icon: BarChart3, featureFlag: "reports" },
        ],
      },
      {
        id: "admin-finance",
        label: "Finance",
        items: [
          { id: "finance-dashboard", label: "Finance Dashboard", to: "/church-admin/finance", icon: Wallet, featureFlag: "contributions" },
          { id: "contributions", label: "Contributions", to: "/church-admin/contributions", icon: HandCoins, featureFlag: "contributions" },
          { id: "pledges", label: "Pledges", to: "/church-admin/pledges", icon: ClipboardList, featureFlag: "pledges" },
          { id: "qr-payments", label: "QR Payments", to: "/church-admin/qr-payments", icon: Receipt, featureFlag: "give" },
          { id: "finance-intelligence", label: "Finance Intelligence", to: "/church-admin/finance-intelligence", icon: BarChart3, featureFlag: "finance_intelligence" },
        ],
      },
      {
        id: "admin-administration",
        label: "Administration",
        items: [
          { id: "notifications", label: "Notifications", to: "/church-admin/notifications", icon: Bell, featureFlag: "notifications" },
          { id: "channels", label: "Channels", to: "/church-admin/channels", icon: Users, featureFlag: "channels" },
          { id: "data-import", label: "Imports", to: "/church-admin/data-import", icon: Import },
          { id: "audit-logs", label: "Audit Logs", to: "/church-admin/audit-logs", icon: Shield },
          { id: "preview-member", label: "Preview Member Experience", to: "/church-admin/preview-member", icon: Eye },
          { id: "billing", label: "Billing", to: "/church-admin/billing", icon: CreditCard },
          { id: "settings", label: "Settings", to: "/church-admin/settings", icon: Settings },
          { id: "features-permissions", label: "Features & Permissions", to: "/church-admin/settings/features-permissions", icon: Shield, featureFlag: "roles", requireFeatureEnabled: true },
        ],
      },
    ],
    quickActions: [
      { id: "invite-member", label: "Invite Member", to: "/church-admin/roles", icon: Users, featureFlag: "roles" },
      { id: "kanisa-ai", label: "Kanisa AI", to: "/church-admin/kanisa-ai", icon: Sparkles, featureFlag: "kanisa_ai" },
      { id: "approve-members", label: "Approve Members", to: "/church-admin/members", icon: Users, featureFlag: "members" },
      { id: "create-event", label: "Create Event", to: "/church-admin/events", icon: CalendarDays, featureFlag: "events" },
      { id: "ministries", label: "Ministries", to: "/church-admin/ministries", icon: Users, featureFlag: "ministries" },
      { id: "post-announcement", label: "Post Announcement", to: "/church-admin/announcements", icon: Megaphone, featureFlag: "announcements" },
      { id: "attendance", label: "Attendance", to: "/church-admin/mass-schedule", icon: ClipboardList, featureFlag: "events" },
      { id: "view-reports", label: "View Reports", to: "/church-admin/reports", icon: BarChart3, featureFlag: "reports" },
      { id: "church-settings", label: "Church Settings", to: "/church-admin/settings", icon: Settings },
    ],
  },
  finance: {
    id: "finance",
    title: "Finance Workspace",
    description: "Giving, receipts, pledges, and reports.",
    icon: Wallet,
    roles: ["treasurer", "finance", "church_admin"],
    dashboard: dashboardConfigs.finance,
    navigation: [
      {
        id: "finance-home",
        label: "Home",
        items: [
          { id: "dashboard", label: "Dashboard", to: "/finance", icon: Wallet },
          { id: "kanisa-ai", label: "Kanisa AI", to: "/finance/kanisa-ai", icon: Sparkles, featureFlag: "kanisa_ai" },
        ],
      },
      {
        id: "finance-finance",
        label: "Finance",
        items: [
          { id: "contributions", label: "Contributions", to: "/finance/contributions", icon: HandCoins, featureFlag: "contributions" },
          { id: "receipts", label: "Receipts", to: "/finance/receipts", icon: Receipt, featureFlag: "contributions" },
          { id: "pledges", label: "Pledges", to: "/finance/pledges", icon: ClipboardList, featureFlag: "pledges" },
          { id: "finance-intelligence", label: "Finance Intelligence", to: "/finance/finance-intelligence", icon: BarChart3, featureFlag: "finance_intelligence" },
          { id: "reports", label: "Reports", to: "/finance/reports", icon: BarChart3, featureFlag: "reports" },
          { id: "exports", label: "Exports", to: "/finance/exports", icon: FileText, featureFlag: "reports" },
        ],
      },
      {
        id: "finance-parish",
        label: "Parish",
        items: [
          { id: "community-help", label: "Community Help", to: "/finance/community-help", icon: HelpCircle, featureFlag: "community_help" },
          { id: "calendar", label: "Parish Calendar", to: "/finance/calendar", icon: CalendarDays, featureFlag: "events" },
          { id: "daily-readings", label: "Daily Readings", to: "/finance/daily-readings", icon: BookOpen, featureFlag: "catholic_content" },
          { id: "saints", label: "Saints", to: "/finance/saints", icon: Sparkles, featureFlag: "catholic_content" },
          { id: "bible", label: "Bible", to: "/finance/bible", icon: BookOpen, featureFlag: "bible_verses" },
        ],
      },
      {
        id: "finance-administration",
        label: "Administration",
        items: [
          { id: "audit-logs", label: "Audit Logs", to: "/finance/audit-logs", icon: Shield },
          { id: "settings", label: "Settings", to: "/finance/settings", icon: Settings },
        ],
      },
    ],
    quickActions: [
      { id: "record-contribution", label: "Record Contribution", to: "/finance/contributions", icon: HandCoins, featureFlag: "contributions" },
      { id: "kanisa-ai", label: "Kanisa AI", to: "/finance/kanisa-ai", icon: Sparkles, featureFlag: "kanisa_ai" },
      { id: "view-receipts", label: "View Receipts", to: "/finance/receipts", icon: Receipt, featureFlag: "contributions" },
      { id: "export-report", label: "Export Report", to: "/finance/reports", icon: FileText, featureFlag: "reports" },
      { id: "community-help", label: "Community Help", to: "/finance/community-help", icon: HelpCircle, featureFlag: "community_help" },
      { id: "outstanding-pledges", label: "Outstanding Pledges", to: "/finance/pledges", icon: ClipboardList, featureFlag: "pledges" },
      { id: "monthly-report", label: "Monthly Report", to: "/finance/reports", icon: BarChart3, featureFlag: "reports" },
    ],
  },
  super_admin: {
    id: "super_admin",
    title: "Super Admin Workspace",
    description: "Platform operations and governance.",
    icon: Shield,
    roles: ["super_admin"],
    dashboard: dashboardConfigs.super_admin,
    navigation: [
      {
        id: "platform-home",
        label: "Home",
        items: [
          { id: "dashboard", label: "Dashboard", to: "/super-admin", icon: Shield },
          { id: "kanisa-ai", label: "Kanisa AI", to: "/super-admin/kanisa-ai", icon: Sparkles },
        ],
      },
      {
        id: "platform-tenants",
        label: "Tenants",
        items: [
          { id: "churches", label: "Churches", to: "/super-admin/churches", icon: Building2 },
          { id: "subscriptions", label: "Subscriptions", to: "/super-admin/subscriptions", icon: Receipt },
          { id: "billing-verification", label: "Billing Verification", to: "/super-admin/billing-verification", icon: CreditCard },
          { id: "record-preservation", label: "Record Preservation", to: "/super-admin/record-preservation", icon: FileText },
          { id: "features", label: "Features", to: "/super-admin/features", icon: Settings },
        ],
      },
      {
        id: "platform-finance",
        label: "Finance",
        items: [
          { id: "revenue", label: "Revenue", to: "/super-admin/revenue", icon: BarChart3 },
        ],
      },
      {
        id: "platform-content",
        label: "Catholic CMS",
        items: [
          { id: "cms", label: "Catholic CMS", to: "/super-admin/catholic-content", icon: BookOpen },
          { id: "bible-translations", label: "Bible Translations", to: "/super-admin/bible-translations", icon: BookOpen },
          { id: "saints-cms", label: "Saints", to: "/super-admin/catholic-content/saints", icon: Sparkles },
          { id: "daily-readings-cms", label: "Daily Readings", to: "/super-admin/catholic-content/daily-readings", icon: BookOpen },
          { id: "prayer-library", label: "Prayer Library", to: "/super-admin/catholic-content/prayer-library", icon: HeartHandshake },
          { id: "prayer-import", label: "Import Prayers", to: "/super-admin/catholic-content/prayer-library/import", icon: Import },
          { id: "prayer-import-history", label: "Import History", to: "/super-admin/catholic-content/prayer-library/import#history", icon: FileText },
          { id: "prayer-validation-reports", label: "Validation Reports", to: "/super-admin/catholic-content/prayer-library/import#validation", icon: ClipboardList },
          { id: "prayer-draft-review", label: "Draft Review", to: "/super-admin/catholic-content/prayer-library", icon: HeartHandshake },
          { id: "liturgical-calendar", label: "Liturgical Calendar", to: "/super-admin/catholic-content/liturgical-calendar", icon: CalendarDays },
          { id: "imports", label: "Imports", to: "/super-admin/catholic-content/import-center", icon: Import },
        ],
      },
      {
        id: "platform-administration",
        label: "Administration",
        items: [
          { id: "activity", label: "Activity", to: "/super-admin/activity", icon: Users },
          { id: "logs", label: "Logs", to: "/super-admin/logs", icon: FileText },
          { id: "security", label: "Audit Logs", to: "/super-admin/audit-logs", icon: Lock },
          { id: "system-logs", label: "System Logs", to: "/super-admin/system-logs", icon: FileText },
          { id: "system-health", label: "System Health", to: "/super-admin/system-health", icon: Bell },
          { id: "jobs", label: "System Jobs", to: "/super-admin/system-jobs", icon: ClipboardList },
          { id: "job-history", label: "Job History", to: "/super-admin/job-history", icon: FileText },
          { id: "platform-settings", label: "Platform Settings", to: "/super-admin/settings", icon: Settings },
        ],
      },
    ],
    quickActions: [
      { id: "churches", label: "Churches", to: "/super-admin/churches", icon: Building2 },
      { id: "kanisa-ai", label: "Kanisa AI", to: "/super-admin/kanisa-ai", icon: Sparkles },
      { id: "cms", label: "CMS", to: "/super-admin/catholic-content", icon: BookOpen },
      { id: "imports", label: "Imports", to: "/super-admin/catholic-content/import-center", icon: Import },
      { id: "monitoring", label: "Monitoring", to: "/super-admin/system-health", icon: Bell },
    ],
  },
} satisfies Record<WorkspaceId, WorkspaceConfig>;

export type WorkspaceRegistry = typeof workspaceRegistry;

export function getWorkspaceConfig(id: WorkspaceId) {
  return workspaceRegistry[id];
}

export function getWorkspaceNavigationItems(id: WorkspaceId) {
  return workspaceRegistry[id].navigation.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      category: group.label ?? "Navigation",
      workspace: id,
    })),
  );
}

export function getWorkspaceIdForRole(role: string | null | undefined, isSuperAdmin = false): WorkspaceId {
  if (isSuperAdmin || role === "super_admin") return "super_admin";
  if (role === "pastor" || role === "priest") return "pastoral";
  if (role === "treasurer" || role === "finance") return "finance";
  if (role === "church_admin" || role === "secretary") return "church_admin";
  return "member";
}

export function getWorkspaceConfigForRole(role: string | null | undefined, isSuperAdmin = false) {
  return getWorkspaceConfig(getWorkspaceIdForRole(role, isSuperAdmin));
}
