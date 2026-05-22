export type ChurchAdminFeatureKey =
  | "members"
  | "contributions"
  | "pledges"
  | "communities"
  | "ministries"
  | "families"
  | "events"
  | "event_requests"
  | "announcements"
  | "sermons"
  | "bible_verses"
  | "prayer_requests"
  | "mass_intentions"
  | "community_help"
  | "reports"
  | "channels"
  | "notifications"
  | "roles";

export const CHURCH_ADMIN_FEATURE_ROUTE_MAP: Array<{ prefix: string; featureKey: ChurchAdminFeatureKey }> = [
  { prefix: "/church-admin/members", featureKey: "members" },
  { prefix: "/church-admin/contributions", featureKey: "contributions" },
  { prefix: "/church-admin/pledges", featureKey: "pledges" },
  { prefix: "/church-admin/communities", featureKey: "communities" },
  { prefix: "/church-admin/ministries", featureKey: "ministries" },
  { prefix: "/church-admin/families", featureKey: "families" },
  { prefix: "/church-admin/events", featureKey: "events" },
  { prefix: "/church-admin/event-requests", featureKey: "event_requests" },
  { prefix: "/church-admin/announcements", featureKey: "announcements" },
  { prefix: "/church-admin/sermons", featureKey: "sermons" },
  { prefix: "/church-admin/bible-verses", featureKey: "bible_verses" },
  { prefix: "/church-admin/prayer-requests", featureKey: "prayer_requests" },
  { prefix: "/church-admin/mass-intentions", featureKey: "mass_intentions" },
  { prefix: "/church-admin/community-help", featureKey: "community_help" },
  { prefix: "/church-admin/reports", featureKey: "reports" },
  { prefix: "/church-admin/channels", featureKey: "channels" },
  { prefix: "/church-admin/notifications", featureKey: "notifications" },
  { prefix: "/church-admin/roles", featureKey: "roles" },
];

export function getChurchAdminFeatureForPath(pathname: string): ChurchAdminFeatureKey | null {
  const match = CHURCH_ADMIN_FEATURE_ROUTE_MAP.find((item) => pathname.startsWith(item.prefix));
  return match?.featureKey ?? null;
}
