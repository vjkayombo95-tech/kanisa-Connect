export type PortalFeatureKey =
  | "events"
  | "event_requests"
  | "sermons"
  | "bible_verses"
  | "announcements"
  | "give"
  | "pledges"
  | "prayer_requests"
  | "mass_intentions"
  | "community_help"
  | "channels";

export const PORTAL_FEATURE_ROUTE_MAP: Array<{ prefix: string; featureKey: PortalFeatureKey }> = [
  { prefix: "/portal/events", featureKey: "events" },
  { prefix: "/portal/event-requests", featureKey: "event_requests" },
  { prefix: "/portal/sermons", featureKey: "sermons" },
  { prefix: "/portal/bible-verses", featureKey: "bible_verses" },
  { prefix: "/portal/announcements", featureKey: "announcements" },
  { prefix: "/portal/give", featureKey: "give" },
  { prefix: "/portal/pledges", featureKey: "pledges" },
  { prefix: "/portal/prayer-requests", featureKey: "prayer_requests" },
  { prefix: "/portal/mass-intentions", featureKey: "mass_intentions" },
  { prefix: "/portal/community-help", featureKey: "community_help" },
  { prefix: "/portal/channels", featureKey: "channels" },
];

export function getPortalFeatureForPath(pathname: string): PortalFeatureKey | null {
  const match = PORTAL_FEATURE_ROUTE_MAP.find((item) => pathname.startsWith(item.prefix));
  return match?.featureKey ?? null;
}
