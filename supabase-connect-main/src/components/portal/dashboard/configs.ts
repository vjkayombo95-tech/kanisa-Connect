import { BookOpen, CalendarDays, HandCoins, HeartHandshake, Megaphone, Settings, Users, Wallet } from "lucide-react";

import type { DashboardConfig, DashboardRole } from "./framework";

export const dashboardConfigs = {
  member: {
    role: "member",
    sections: [
      {
        id: "member-hero",
        title: "Parish Home",
        showHeader: false,
        widgets: [{ id: "hero" }, { id: "member-error" }],
      },
      {
        id: "member-today",
        title: "Today",
        icon: CalendarDays,
        showHeader: false,
        widgets: [{ id: "todays-mass" }, { id: "gospel-highlight" }],
      },
      {
        id: "member-parish-life",
        title: "Parish Life",
        icon: CalendarDays,
        showHeader: false,
        widgets: [{ id: "parish-life" }, { id: "ministry-life" }],
      },
      {
        id: "member-prayer-focus",
        title: "Prayer Focus",
        icon: BookOpen,
        showHeader: false,
        widgets: [{ id: "prayer-focus" }],
      },
      {
        id: "member-giving",
        title: "My Giving",
        icon: HandCoins,
        showHeader: false,
        widgets: [{ id: "giving-overview" }],
      },
      {
        id: "member-actions",
        title: "Quick Actions",
        icon: Megaphone,
        showHeader: false,
        widgets: [{ id: "quick-actions" }, { id: "footer" }],
      },
    ],
  },
  priest: {
    role: "priest",
    sections: [
      {
        id: "todays-ministry",
        title: "Today's Ministry",
        description: "Daily liturgy, saint, and prayer for pastoral preparation.",
        icon: BookOpen,
        widgets: [
          { id: "greeting" },
          { id: "todays-schedule" },
          { id: "todays-liturgy" },
          { id: "todays-saint" },
          { id: "todays-prayer" },
        ],
      },
      {
        id: "pastoral-care",
        title: "Pastoral Care",
        description: "Requests that need review, prayer, and pastoral follow-up.",
        icon: HeartHandshake,
        widgets: [{ id: "mass-intentions" }, { id: "sacraments" }, { id: "prayer-requests" }, { id: "community-help" }],
      },
      {
        id: "parish-health",
        title: "Parish Health",
        description: "Giving and attendance signals for the parish.",
        icon: Wallet,
        widgets: [{ id: "parish-finance-summary" }, { id: "upcoming-events" }],
      },
      {
        id: "communication",
        title: "Communication",
        description: "Recent announcements and fast pastoral actions.",
        icon: Megaphone,
        widgets: [{ id: "announcements" }],
      },
    ],
  },
  church_admin: {
    role: "church_admin",
    sections: [
      {
        id: "operations",
        title: "Operations",
        icon: Settings,
        widgets: [
          { id: "greeting" },
          { id: "action-required" },
          { id: "todays-schedule" },
          { id: "todays-attendance" },
          { id: "pending-member-approvals" },
          { id: "upcoming-events" },
          { id: "quick-actions" },
        ],
      },
      {
        id: "members",
        title: "Members",
        icon: Users,
        widgets: [
          { id: "total-members" },
          { id: "new-members-this-month" },
          { id: "birthdays" },
          { id: "recent-registrations" },
        ],
      },
      {
        id: "finance",
        title: "Finance",
        icon: Wallet,
        widgets: [
          { id: "todays-contributions" },
          { id: "this-month-contributions" },
          { id: "outstanding-pledges" },
          { id: "community-help-summary" },
        ],
      },
      {
        id: "communication",
        title: "Communication",
        icon: Megaphone,
        widgets: [{ id: "announcements" }, { id: "upcoming-events-communication" }, { id: "livestream-status" }],
      },
      {
        id: "administration",
        title: "Administration",
        icon: Settings,
        widgets: [{ id: "member-signup-qr" }, { id: "pending-invitations" }, { id: "church-settings" }, { id: "reports-shortcut" }],
      },
    ],
  },
  finance: {
    role: "finance",
    sections: [
      {
        id: "financial-overview",
        title: "Financial Overview",
        icon: Wallet,
        widgets: [
          { id: "todays-contributions" },
          { id: "todays-schedule" },
          { id: "this-month-contributions" },
          { id: "this-year-contributions" },
          { id: "outstanding-pledges" },
          { id: "community-help-summary" },
        ],
      },
      {
        id: "collections",
        title: "Collections",
        icon: HandCoins,
        widgets: [
          { id: "recent-contributions" },
          { id: "pending-payments" },
          { id: "recent-receipts" },
          { id: "quick-reconciliation-summary" },
          { id: "quick-actions" },
        ],
      },
      {
        id: "reports",
        title: "Reports",
        icon: BookOpen,
        widgets: [
          { id: "monthly-report" },
          { id: "contribution-trends" },
          { id: "top-contribution-types" },
          { id: "export-shortcuts" },
        ],
      },
      {
        id: "finance-administration",
        title: "Administration",
        icon: Settings,
        widgets: [{ id: "platform-fees-summary" }, { id: "audit-summary" }, { id: "finance-settings-shortcut" }],
      },
    ],
  },
  super_admin: {
    role: "super_admin",
    sections: [
      {
        id: "platform-overview",
        title: "Platform Overview",
        icon: Settings,
        widgets: [{ id: "greeting" }, { id: "giving-overview" }, { id: "announcements" }, { id: "quick-actions" }],
      },
    ],
  },
} satisfies Record<DashboardRole, DashboardConfig>;

export function getDashboardConfig(role: DashboardRole) {
  return dashboardConfigs[role];
}
