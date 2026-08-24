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
  route: string;
  group: string;
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
    workRoute: `${base}/members`,
    servicesRoute: `${base}/services`,
    services: [
      { id: "members", label: "Wanachama", route: `${base}/members`, group: "Jumuiya", icon: Users, primary: true },
      { id: "contributions", label: "Michango", route: `${base}/contributions`, group: "Fedha", icon: HandCoins, primary: true },
      { id: "pledges", label: "Ahadi", route: `${base}/pledges`, group: "Fedha", icon: Target, primary: true },
      { id: "reports", label: "Ripoti", route: `${base}/reports`, group: "Uendeshaji", icon: BarChart3, primary: true },
      { id: "leadership", label: "Viongozi", route: `${base}/leadership`, group: "Jumuiya", icon: UserCheck },
      { id: "channels", label: "Mawasiliano", route: `${base}/channels`, group: "Mawasiliano", icon: Megaphone },
    ],
  };
}

const adminServices: StaffService[] = [
  { id: "members", label: "Wanachama", route: "/church-admin/members", group: "Watu", icon: Users, featureKey: "members", primary: true },
  { id: "roles", label: "Mialiko na majukumu", route: "/church-admin/roles", group: "Watu", icon: UserCheck, featureKey: "roles", primary: true },
  { id: "announcements", label: "Matangazo", route: "/church-admin/announcements", group: "Mawasiliano", icon: Megaphone, featureKey: "announcements", primary: true },
  { id: "events", label: "Matukio", route: "/church-admin/events", group: "Uendeshaji", icon: CalendarDays, featureKey: "events", primary: true },
  { id: "calendar", label: "Kalenda ya Parokia", route: "/church-admin/calendar", group: "Uendeshaji", icon: CalendarDays, featureKey: "events" },
  { id: "communities", label: "Jumuiya", route: "/church-admin/communities", group: "Watu", icon: Church, featureKey: "communities" },
  { id: "families", label: "Familia", route: "/church-admin/families", group: "Watu", icon: Users, featureKey: "families" },
  { id: "ministries", label: "Huduma", route: "/church-admin/ministries", group: "Watu", icon: HeartHandshake, featureKey: "ministries" },
  { id: "contributions", label: "Michango", route: "/church-admin/contributions", group: "Fedha", icon: HandCoins, featureKey: "contributions" },
  { id: "pledges", label: "Ahadi", route: "/church-admin/pledges", group: "Fedha", icon: Target, featureKey: "pledges" },
  { id: "reports", label: "Ripoti", route: "/church-admin/reports", group: "Fedha", icon: BarChart3, featureKey: "reports" },
  { id: "mass-intentions", label: "Nia za Misa", route: "/church-admin/mass-intentions", group: "Kichungaji", icon: ClipboardList, featureKey: "mass_intentions" },
  { id: "prayer-requests", label: "Maombi", route: "/church-admin/prayer-requests", group: "Kichungaji", icon: HeartHandshake, featureKey: "prayer_requests" },
  { id: "mass-schedule", label: "Ratiba ya Misa", route: "/church-admin/mass-schedule", group: "Kichungaji", icon: CalendarDays, featureKey: "events" },
  { id: "mass-timetable", label: "Ratiba za Misa", route: "/church-admin/mass-timetable", group: "Kichungaji", icon: CalendarDays, featureKey: "events" },
  { id: "sermons", label: "Mahubiri", route: "/church-admin/sermons", group: "Kichungaji", icon: BookOpen, featureKey: "sermons" },
  { id: "livestreams", label: "Matangazo Mubashara", route: "/church-admin/livestreams", group: "Kichungaji", icon: Activity, featureKey: "livestream", livestreamPermission: true },
  { id: "radio", label: "Radio", route: "/church-admin/radio", group: "Mawasiliano", icon: Radio, featureKey: "radio", radioPermission: true },
  { id: "notifications", label: "Arifa", route: "/church-admin/notifications", group: "Mawasiliano", icon: Bell, featureKey: "notifications" },
  { id: "settings", label: "Mipangilio", route: "/church-admin/settings", group: "Usimamizi", icon: Settings },
  { id: "billing", label: "Malipo ya kanisa", route: "/church-admin/billing", group: "Usimamizi", icon: CreditCard },
];

const pastoralIds = new Set(["mass-intentions", "prayer-requests", "mass-schedule", "mass-timetable", "calendar", "events", "announcements", "sermons", "livestreams"]);
const financeIds = new Set(["contributions", "pledges", "reports"]);

const pastoralServices: StaffService[] = adminServices
  .filter((item) => pastoralIds.has(item.id))
  .map((item, index) => ({ ...item, primary: index < 3 }));
pastoralServices.splice(2, 0, { id: "community-help", label: "Msaada wa jamii", route: "/church-admin/community-help", group: "Kichungaji", icon: HeartHandshake, featureKey: "community_help", primary: true });
pastoralServices.push({ id: "bible-verses", label: "Mistari ya Biblia", route: "/church-admin/bible-verses", group: "Kichungaji", icon: BookOpen, featureKey: "bible_verses" });

const financeServices: StaffService[] = [
  ...adminServices.filter((item) => financeIds.has(item.id)).map((item) => ({ ...item, primary: true })),
  { id: "analytics", label: "Uchambuzi", route: "/church-admin/analytics", group: "Fedha", icon: BarChart3, featureKey: "reports", primary: true },
  { id: "qr-payments", label: "Malipo ya QR", route: "/church-admin/qr-payments", group: "Fedha", icon: Receipt },
  { id: "community-help", label: "Msaada wa jamii", route: "/church-admin/community-help", group: "Parokia", icon: HeartHandshake, featureKey: "community_help" },
];

const superAdminServices: StaffService[] = [
  { id: "churches", label: "Makanisa", route: "/super-admin/churches", group: "Makanisa", icon: Building2, primary: true },
  { id: "subscriptions", label: "Usajili", route: "/super-admin/subscriptions", group: "Fedha", icon: CreditCard, primary: true },
  { id: "system-health", label: "Afya ya mfumo", route: "/super-admin/system-health", group: "Mfumo", icon: Activity, primary: true },
  { id: "features", label: "Vipengele", route: "/super-admin/features", group: "Mfumo", icon: ListChecks, primary: true },
  { id: "radio", label: "Radio", route: "/super-admin/radio", group: "Mfumo", icon: Radio },
  { id: "billing-verification", label: "Uhakiki wa malipo", route: "/super-admin/billing-verification", group: "Fedha", icon: Receipt },
  { id: "record-preservation", label: "Uhifadhi wa rekodi", route: "/super-admin/record-preservation", group: "Fedha", icon: FileText },
  { id: "revenue", label: "Mapato", route: "/super-admin/revenue", group: "Fedha", icon: Landmark },
  { id: "system-jobs", label: "Kazi za mfumo", route: "/super-admin/system-jobs", group: "Mfumo", icon: ListChecks },
  { id: "system-logs", label: "Hitilafu za mfumo", route: "/super-admin/system-logs", group: "Mfumo", icon: Shield },
  { id: "audit-logs", label: "Kumbukumbu za ukaguzi", route: "/super-admin/audit-logs", group: "Mfumo", icon: Shield },
  { id: "activity", label: "Shughuli za watumiaji", route: "/super-admin/activity", group: "Mfumo", icon: Activity },
  { id: "settings", label: "Mipangilio", route: "/super-admin/settings", group: "Mfumo", icon: Settings },
];

export const STAFF_MOBILE_CONFIGS: Record<Exclude<StaffMobileWorkspace, "member">, StaffMobileConfig> = {
  admin: { workspace: "admin", home: "/church-admin", workLabel: "Wanachama", workRoute: "/church-admin/members", servicesRoute: "/church-admin/services", services: adminServices },
  pastoral: { workspace: "pastoral", home: "/church-admin", workLabel: "Nia", workRoute: "/church-admin/mass-intentions", servicesRoute: "/church-admin/services", services: pastoralServices },
  finance: { workspace: "finance", home: "/church-admin", workLabel: "Michango", workRoute: "/church-admin/contributions", servicesRoute: "/church-admin/services", services: financeServices },
  super_admin: { workspace: "super_admin", home: "/super-admin", workLabel: "Makanisa", workRoute: "/super-admin/churches", servicesRoute: "/super-admin/services", services: superAdminServices },
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
  return normalized === config.home || normalized === config.servicesRoute || config.services.some((item) => normalized === item.route || normalized.startsWith(`${item.route}/`));
}

export function canSuperAdminEnterChurchWorkspace(churchId: string | null) {
  return typeof churchId === "string" && churchId.length > 0;
}
