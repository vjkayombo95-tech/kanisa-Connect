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
  | "channels"
  | "kanisa_ai"
  | "radio"
  | "livestream"
  | "ministries"
  | "notifications";

export const PORTAL_FEATURE_ROUTE_MAP: Array<{ prefix: string; featureKey: PortalFeatureKey }> = [
  { prefix: "/portal/events", featureKey: "events" },
  { prefix: "/portal/calendar", featureKey: "events" },
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
  { prefix: "/portal/kanisa-ai", featureKey: "kanisa_ai" },
  { prefix: "/portal/radio", featureKey: "radio" },
  { prefix: "/portal/live", featureKey: "livestream" },
  { prefix: "/portal/ministries", featureKey: "ministries" },
  { prefix: "/portal/notifications", featureKey: "notifications" },
];

export function getPortalFeatureForPath(pathname: string): PortalFeatureKey | null {
  const match = PORTAL_FEATURE_ROUTE_MAP.find((item) => pathname.startsWith(item.prefix));
  return match?.featureKey ?? null;
}
