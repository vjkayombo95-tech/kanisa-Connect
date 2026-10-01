import type { LucideIcon } from "lucide-react";
import {
  Activity, BarChart3, Bell, BookOpen, Building2, CalendarDays, Church, ClipboardList,
  CreditCard, FileText, HandCoins, HeartHandshake, Landmark, ListChecks, Megaphone,
  Receipt, Settings, Shield, Target, UserCheck, Users, Radio,
} from "lucide-react";
import type { StaffMobileWorkspace } from "./staff-mobile-role";

export type StaffService = {
  id: string;
  label: string;
  labelKey: string;
  route: string;
  group: string;
  groupKey: string;
  icon: LucideIcon;
  featureKey?: string;
  primary?: boolean;
  livestreamPermission?: boolean;
  radioPermission?: boolean;
};

export type StaffMobileConfig = {
  workspace: Exclude<StaffMobileWorkspace, "member"> | "community";
  home: string;
  workLabel: string;
  workLabelKey: string;
  workRoute: string;
  servicesRoute: string;
  services: StaffService[];
};

export function getCommunityMobileConfig(communityId: string): StaffMobileConfig {
  const base = `/community/${communityId}`;
  return {
    workspace: "community",
    home: `${base}/dashboard`,
    workLabel: "Wanachama",
    workLabelKey: "staff_services.members.label",
    workRoute: `${base}/members`,
    servicesRoute: `${base}/services`,
    services: [
      { id: "members", label: "Wanachama", labelKey: "staff_services.members.label", route: `${base}/members`, group: "Jumuiya", groupKey: "staff_service_groups.community", icon: Users, primary: true },
      { id: "contributions", label: "Michango", labelKey: "staff_services.contributions.label", route: `${base}/contributions`, group: "Fedha", groupKey: "staff_service_groups.finance", icon: HandCoins, primary: true },
      { id: "pledges", label: "Ahadi", labelKey: "staff_services.pledges.label", route: `${base}/pledges`, group: "Fedha", groupKey: "staff_service_groups.finance", icon: Target, primary: true },
      { id: "reports", label: "Ripoti", labelKey: "staff_services.reports.label", route: `${base}/reports`, group: "Uendeshaji", groupKey: "staff_service_groups.operations", icon: BarChart3, primary: true },
      { id: "leadership", label: "Viongozi", labelKey: "staff_services.leadership.label", route: `${base}/leadership`, group: "Jumuiya", groupKey: "staff_service_groups.community", icon: UserCheck },
      { id: "channels", label: "Mawasiliano", labelKey: "staff_services.channels.label", route: `${base}/channels`, group: "Mawasiliano", groupKey: "staff_service_groups.communication", icon: Megaphone },
    ],
  };
}

const adminServices: StaffService[] = [
  { id: "members", label: "Wanachama", labelKey: "staff_services.members.label", route: "/church-admin/members", group: "Watu", groupKey: "staff_service_groups.people", icon: Users, featureKey: "members", primary: true },
  { id: "roles", label: "Mialiko na majukumu", labelKey: "staff_services.roles.label", route: "/church-admin/roles", group: "Watu", groupKey: "staff_service_groups.people", icon: UserCheck, featureKey: "roles", primary: true },
  { id: "invite-members", label: "Alika Wanachama", labelKey: "staff_services.invite_members.label", route: "/church-admin/invite-members", group: "Watu", groupKey: "staff_service_groups.people", icon: UserCheck },
  { id: "announcements", label: "Matangazo", labelKey: "staff_services.announcements.label", route: "/church-admin/announcements", group: "Mawasiliano", groupKey: "staff_service_groups.communication", icon: Megaphone, featureKey: "announcements", primary: true },
  { id: "events", label: "Matukio", labelKey: "staff_services.events.label", route: "/church-admin/events", group: "Uendeshaji", groupKey: "staff_service_groups.operations", icon: CalendarDays, featureKey: "events", primary: true },
  { id: "event-requests", label: "Huduma za Ofisi", labelKey: "staff_services.event_requests.label", route: "/church-admin/event-requests", group: "Uendeshaji", groupKey: "staff_service_groups.operations", icon: ClipboardList, featureKey: "event_requests" },
  { id: "calendar", label: "Kalenda ya Parokia", labelKey: "staff_services.calendar.label", route: "/church-admin/calendar", group: "Uendeshaji", groupKey: "staff_service_groups.operations", icon: CalendarDays, featureKey: "events" },
  { id: "communities", label: "Jumuiya", labelKey: "staff_services.communities.label", route: "/church-admin/communities", group: "Watu", groupKey: "staff_service_groups.people", icon: Church, featureKey: "communities" },
  { id: "families", label: "Familia", labelKey: "staff_services.families.label", route: "/church-admin/families", group: "Watu", groupKey: "staff_service_groups.people", icon: Users, featureKey: "families" },
  { id: "ministries", label: "Huduma", labelKey: "staff_services.ministries.label", route: "/church-admin/ministries", group: "Watu", groupKey: "staff_service_groups.people", icon: HeartHandshake, featureKey: "ministries" },
  { id: "contributions", label: "Michango", labelKey: "staff_services.contributions.label", route: "/church-admin/contributions", group: "Fedha", groupKey: "staff_service_groups.finance", icon: HandCoins, featureKey: "contributions" },
  { id: "pledges", label: "Ahadi", labelKey: "staff_services.pledges.label", route: "/church-admin/pledges", group: "Fedha", groupKey: "staff_service_groups.finance", icon: Target, featureKey: "pledges" },
  { id: "reports", label: "Ripoti", labelKey: "staff_services.reports.label", route: "/church-admin/reports", group: "Fedha", groupKey: "staff_service_groups.finance", icon: BarChart3, featureKey: "reports" },
  { id: "qr-payments", label: "Malipo ya QR", labelKey: "staff_services.qr_payments.label", route: "/church-admin/qr-payments", group: "Fedha", groupKey: "staff_service_groups.finance", icon: Receipt },
  { id: "mass-intentions", label: "Nia za Misa", labelKey: "staff_services.mass_intentions.label", route: "/church-admin/mass-intentions", group: "Kichungaji", groupKey: "staff_service_groups.pastoral", icon: ClipboardList, featureKey: "mass_intentions" },
  { id: "prayer-requests", label: "Maombi", labelKey: "staff_services.prayer_requests.label", route: "/church-admin/prayer-requests", group: "Kichungaji", groupKey: "staff_service_groups.pastoral", icon: HeartHandshake, featureKey: "prayer_requests" },
  { id: "mass-timetable", label: "Ratiba za Misa", labelKey: "staff_services.mass_timetable.label", route: "/church-admin/mass-timetable", group: "Kichungaji", groupKey: "staff_service_groups.pastoral", icon: CalendarDays, featureKey: "events" },
  { id: "sermons", label: "Mahubiri", labelKey: "staff_services.sermons.label", route: "/church-admin/sermons", group: "Kichungaji", groupKey: "staff_service_groups.pastoral", icon: BookOpen, featureKey: "sermons" },
  { id: "livestreams", label: "Matangazo Mubashara", labelKey: "staff_services.livestreams.label", route: "/church-admin/livestreams", group: "Kichungaji", groupKey: "staff_service_groups.pastoral", icon: Activity, featureKey: "livestream", livestreamPermission: true },
  { id: "radio", label: "Radio", labelKey: "staff_services.radio.label", route: "/church-admin/radio", group: "Mawasiliano", groupKey: "staff_service_groups.communication", icon: Radio, featureKey: "radio", radioPermission: true },
  { id: "notifications", label: "Arifa", labelKey: "staff_services.notifications.label", route: "/church-admin/notifications", group: "Mawasiliano", groupKey: "staff_service_groups.communication", icon: Bell, featureKey: "notifications" },
  { id: "settings", label: "Mipangilio", labelKey: "staff_services.settings.label", route: "/church-admin/settings", group: "Usimamizi", groupKey: "staff_service_groups.management", icon: Settings },
  { id: "billing", label: "Malipo ya kanisa", labelKey: "staff_services.billing.label", route: "/church-admin/billing", group: "Usimamizi", groupKey: "staff_service_groups.management", icon: CreditCard },
];

const pastoralIds = new Set(["mass-intentions", "prayer-requests", "mass-timetable", "calendar", "events", "announcements", "sermons", "livestreams"]);
const financeIds = new Set(["contributions", "pledges", "reports"]);
const pastoralHiddenRoutes = ["/church-admin/mass-schedule"];

const pastoralServices: StaffService[] = adminServices
  .filter((item) => pastoralIds.has(item.id))
  .map((item, index) => ({ ...item, primary: index < 3 }));
pastoralServices.splice(2, 0, { id: "community-help", label: "Msaada wa jamii", labelKey: "staff_services.community_help.label", route: "/church-admin/community-help", group: "Kichungaji", groupKey: "staff_service_groups.pastoral", icon: HeartHandshake, featureKey: "community_help", primary: true });
pastoralServices.push({ id: "bible-verses", label: "Mistari ya Biblia", labelKey: "staff_services.bible_verses.label", route: "/church-admin/bible-verses", group: "Kichungaji", groupKey: "staff_service_groups.pastoral", icon: BookOpen, featureKey: "bible_verses" });

const financeServices: StaffService[] = [
  ...adminServices.filter((item) => financeIds.has(item.id)).map((item) => ({ ...item, primary: true })),
  { id: "analytics", label: "Uchambuzi", labelKey: "staff_services.analytics.label", route: "/church-admin/analytics", group: "Fedha", groupKey: "staff_service_groups.finance", icon: BarChart3, featureKey: "reports", primary: true },
  { id: "qr-payments", label: "Malipo ya QR", labelKey: "staff_services.qr_payments.label", route: "/church-admin/qr-payments", group: "Fedha", groupKey: "staff_service_groups.finance", icon: Receipt },
  { id: "community-help", label: "Msaada wa jamii", labelKey: "staff_services.community_help.label", route: "/church-admin/community-help", group: "Parokia", groupKey: "staff_service_groups.parish", icon: HeartHandshake, featureKey: "community_help" },
];

const superAdminServices: StaffService[] = [
  { id: "churches", label: "Makanisa", labelKey: "staff_services.churches.label", route: "/super-admin/churches", group: "Makanisa", groupKey: "staff_service_groups.churches", icon: Building2, primary: true },
  { id: "subscriptions", label: "Usajili", labelKey: "staff_services.subscriptions.label", route: "/super-admin/subscriptions", group: "Fedha", groupKey: "staff_service_groups.finance", icon: CreditCard, primary: true },
  { id: "system-health", label: "Afya ya mfumo", labelKey: "staff_services.system_health.label", route: "/super-admin/system-health", group: "Mfumo", groupKey: "staff_service_groups.system", icon: Activity, primary: true },
  { id: "features", label: "Vipengele", labelKey: "staff_services.features.label", route: "/super-admin/features", group: "Mfumo", groupKey: "staff_service_groups.system", icon: ListChecks, primary: true },
  { id: "radio", label: "Radio", labelKey: "staff_services.radio.label", route: "/super-admin/radio", group: "Mfumo", groupKey: "staff_service_groups.system", icon: Radio },
  { id: "billing-verification", label: "Uhakiki wa malipo", labelKey: "staff_services.billing_verification.label", route: "/super-admin/billing-verification", group: "Fedha", groupKey: "staff_service_groups.finance", icon: Receipt },
  { id: "record-preservation", label: "Uhifadhi wa rekodi", labelKey: "staff_services.record_preservation.label", route: "/super-admin/record-preservation", group: "Fedha", groupKey: "staff_service_groups.finance", icon: FileText },
  { id: "revenue", label: "Mapato", labelKey: "staff_services.revenue.label", route: "/super-admin/revenue", group: "Fedha", groupKey: "staff_service_groups.finance", icon: Landmark },
  { id: "system-jobs", label: "Kazi za mfumo", labelKey: "staff_services.system_jobs.label", route: "/super-admin/system-jobs", group: "Mfumo", groupKey: "staff_service_groups.system", icon: ListChecks },
  { id: "system-logs", label: "Hitilafu za mfumo", labelKey: "staff_services.system_logs.label", route: "/super-admin/system-logs", group: "Mfumo", groupKey: "staff_service_groups.system", icon: Shield },
  { id: "audit-logs", label: "Kumbukumbu za ukaguzi", labelKey: "staff_services.audit_logs.label", route: "/super-admin/audit-logs", group: "Mfumo", groupKey: "staff_service_groups.system", icon: Shield },
  { id: "activity", label: "Shughuli za watumiaji", labelKey: "staff_services.activity.label", route: "/super-admin/activity", group: "Mfumo", groupKey: "staff_service_groups.system", icon: Activity },
  { id: "settings", label: "Mipangilio", labelKey: "staff_services.settings.label", route: "/super-admin/settings", group: "Mfumo", groupKey: "staff_service_groups.system", icon: Settings },
];

export const STAFF_MOBILE_CONFIGS: Record<Exclude<StaffMobileWorkspace, "member">, StaffMobileConfig> = {
  admin: { workspace: "admin", home: "/church-admin", workLabel: "Wanachama", workLabelKey: "staff_services.members.label", workRoute: "/church-admin/members", servicesRoute: "/church-admin/services", services: adminServices },
  pastoral: { workspace: "pastoral", home: "/church-admin", workLabel: "Nia", workLabelKey: "staff_services.mass_intentions.short_label", workRoute: "/church-admin/mass-intentions", servicesRoute: "/church-admin/services", services: pastoralServices },
  finance: { workspace: "finance", home: "/church-admin", workLabel: "Michango", workLabelKey: "staff_services.contributions.label", workRoute: "/church-admin/contributions", servicesRoute: "/church-admin/services", services: financeServices },
  super_admin: { workspace: "super_admin", home: "/super-admin", workLabel: "Makanisa", workLabelKey: "staff_services.churches.label", workRoute: "/super-admin/churches", servicesRoute: "/super-admin/services", services: superAdminServices },
};

export function getStaffMobileConfig(workspace: StaffMobileWorkspace | null): StaffMobileConfig | null {
  return workspace === "admin" || workspace === "pastoral" || workspace === "finance" || workspace === "super_admin"
    ? STAFF_MOBILE_CONFIGS[workspace]
    : null;
}

const exactPath = (pathname: string) => pathname.replace(/\/$/, "") || "/";

export function isStaffRouteAllowed(workspace: StaffMobileWorkspace | null, pathname: string) {
  if (workspace === "super_admin") return pathname === "/super-admin" || pathname.startsWith("/super-admin/");
  if (workspace === "admin") return pathname === "/church-admin" || pathname.startsWith("/church-admin/");
  if (workspace !== "pastoral" && workspace !== "finance") return false;
  const normalized = exactPath(pathname);
  const config = STAFF_MOBILE_CONFIGS[workspace];
  const hiddenRoutes = workspace === "pastoral" ? pastoralHiddenRoutes : [];
  return (
    normalized === config.home ||
    normalized === config.servicesRoute ||
    config.services.some((item) => normalized === item.route || normalized.startsWith(`${item.route}/`)) ||
    hiddenRoutes.some((route) => normalized === route || normalized.startsWith(`${route}/`))
  );
}

export function canSuperAdminEnterChurchWorkspace(churchId: string | null) {
  return typeof churchId === "string" && churchId.length > 0;
}

