import type { PortalFeatureKey } from "@/lib/portal-features";

export type MemberServiceGroup = "today" | "parish" | "worship" | "giving" | "community" | "media";
export type MemberServiceIconKey = "book" | "calendar" | "church" | "giving" | "intention" | "announcement" | "message" | "prayer" | "radio" | "users";

export type MemberServiceDefinition = {
  id: string;
  path: string;
  matchPrefixes?: string[];
  label: string;
  description: string;
  group: MemberServiceGroup;
  iconKey: MemberServiceIconKey;
  featureKey: PortalFeatureKey | null;
  ordinaryMemberAllowed: boolean;
  showInServices: boolean;
  backTitle?: string;
  requiresExistingFeature?: boolean;
  requiresExplicitChurchEnable?: boolean;
};

export const memberServiceGroups: Array<{ id: MemberServiceGroup; label: string }> = [
  { id: "today", label: "Leo" },
  { id: "parish", label: "Parokia" },
  { id: "worship", label: "Ibada" },
  { id: "giving", label: "Michango" },
  { id: "community", label: "Jumuiya na Huduma" },
  { id: "media", label: "Media" },
];

export const memberServiceRegistry: MemberServiceDefinition[] = [
  { id: "home", path: "/portal", label: "Nyumbani", description: "Nyumbani", group: "today", iconKey: "church", featureKey: null, ordinaryMemberAllowed: true, showInServices: false },
  { id: "services", path: "/portal/services", label: "Huduma", description: "Huduma zote", group: "today", iconKey: "church", featureKey: null, ordinaryMemberAllowed: true, showInServices: false },
  { id: "today", path: "/portal/today", label: "Leo", description: "Masomo, mtakatifu na maisha ya leo", group: "today", iconKey: "book", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Leo" },
  { id: "liturgical-calendar", path: "/portal/liturgical-calendar", label: "Kalenda ya Liturujia", description: "Sikukuu na majira ya Kanisa", group: "today", iconKey: "calendar", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Kalenda ya Liturujia" },
  { id: "bible", path: "/portal/bible", matchPrefixes: ["/portal/bible/"], label: "Biblia", description: "Soma Biblia", group: "today", iconKey: "book", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Biblia" },
  { id: "prayers", path: "/portal/prayers", matchPrefixes: ["/portal/prayers/"], label: "Sala", description: "Soma sala zilizochapishwa", group: "today", iconKey: "prayer", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Sala" },
  { id: "reflections", path: "/portal/reflections", matchPrefixes: ["/portal/reflections/"], label: "Tafakari", description: "Tafakari za masomo ya kila siku", group: "today", iconKey: "book", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Tafakari" },
  { id: "daily-readings", path: "/portal/daily-readings", label: "Masomo ya Leo", description: "Masomo kamili ya leo", group: "today", iconKey: "book", featureKey: null, ordinaryMemberAllowed: true, showInServices: false, backTitle: "Masomo ya Leo" },
  { id: "my-parish", path: "/portal/my-parish", label: "Parokia Yangu", description: "Misa, matukio na huduma za parokia", group: "parish", iconKey: "church", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Parokia Yangu" },
  { id: "announcements", path: "/portal/announcements", label: "Matangazo", description: "Taarifa mpya za parokia", group: "parish", iconKey: "announcement", featureKey: "announcements", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Matangazo" },
  { id: "events", path: "/portal/events", label: "Matukio", description: "Matukio yajayo ya parokia", group: "parish", iconKey: "calendar", featureKey: "events", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Matukio" },
  { id: "calendar", path: "/portal/calendar", label: "Kalenda ya Parokia", description: "Misa na ratiba ya parokia", group: "parish", iconKey: "calendar", featureKey: "events", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Kalenda ya Parokia" },
  { id: "sermons", path: "/portal/sermons", label: "Mahubiri", description: "Soma mahubiri ya parokia", group: "parish", iconKey: "church", featureKey: "sermons", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Mahubiri" },
  { id: "mass-intentions", path: "/portal/mass-intentions", label: "Nia za Misa", description: "Wasilisha au fuatilia nia", group: "worship", iconKey: "intention", featureKey: "mass_intentions", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Nia za Misa" },
  { id: "prayer-requests", path: "/portal/prayer-requests", label: "Ombi la Maombi", description: "Tuma na fuatilia ombi", group: "worship", iconKey: "prayer", featureKey: "prayer_requests", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Maombi" },
  { id: "livestream", path: "/portal/live", matchPrefixes: ["/portal/live/"], label: "Misa Live", description: "Tazama Misa mubashara", group: "worship", iconKey: "church", featureKey: "livestream", ordinaryMemberAllowed: true, showInServices: false, backTitle: "Misa Mubashara", requiresExistingFeature: true },
  { id: "give", path: "/portal/give", label: "Toa Mchango", description: "Changia parokia yako", group: "giving", iconKey: "giving", featureKey: "give", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Michango" },
  { id: "contribution-history", path: "/portal/contribution-history", matchPrefixes: ["/portal/contribution-receipt/"], label: "Historia ya Michango", description: "Angalia michango na risiti", group: "giving", iconKey: "giving", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Historia ya Michango" },
  { id: "pledges", path: "/portal/pledges", label: "Ahadi za Michango", description: "Angalia ahadi zako", group: "giving", iconKey: "giving", featureKey: "pledges", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Ahadi za Michango" },
  { id: "ministries", path: "/portal/ministries", matchPrefixes: ["/portal/ministries/"], label: "Huduma za Parokia", description: "Jiunge na huduma ya parokia", group: "community", iconKey: "users", featureKey: "ministries", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Huduma za Parokia", requiresExistingFeature: true },
  { id: "kanisa-ai", path: "/portal/kanisa-ai", label: "Uliza Kanisa", description: "Uliza kuhusu huduma za kanisa lako", group: "community", iconKey: "message", featureKey: "kanisa_ai", ordinaryMemberAllowed: true, showInServices: true, requiresExplicitChurchEnable: true },
  { id: "radio", path: "/portal/radio", label: "Radio", description: "Sikiliza radio ya parokia", group: "media", iconKey: "radio", featureKey: "radio", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Radio" },
  { id: "library", path: "/portal/library", matchPrefixes: ["/portal/library/", "/portal/saints/", "/member/library"], label: "Watakatifu", description: "Maktaba ya imani", group: "today", iconKey: "book", featureKey: null, ordinaryMemberAllowed: true, showInServices: false, backTitle: "Watakatifu" },
  { id: "dashboard", path: "/portal/dashboard", label: "Historia Yangu", description: "Historia na wasifu", group: "giving", iconKey: "giving", featureKey: null, ordinaryMemberAllowed: true, showInServices: false, backTitle: "Historia Yangu" },
];

function pathMatches(pathname: string, path: string) {
  return pathname === path || (path !== "/portal" && pathname.startsWith(`${path}/`));
}

export function getMemberServiceForPath(pathname: string) {
  return memberServiceRegistry.find((service) =>
    pathMatches(pathname, service.path) || service.matchPrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(prefix)),
  ) ?? null;
}

export function isOrdinaryMemberPathAllowed(pathname: string) {
  return getMemberServiceForPath(pathname)?.ordinaryMemberAllowed === true;
}

export function getMemberBackTitle(pathname: string) {
  return getMemberServiceForPath(pathname)?.backTitle;
}
