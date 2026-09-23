import type { PortalFeatureKey } from "@/lib/portal-features";

export type MemberServiceGroup = "today" | "parish" | "worship" | "giving" | "community" | "media";
export type MemberServiceIconKey = "book" | "calendar" | "church" | "giving" | "intention" | "announcement" | "message" | "prayer" | "radio" | "users";

export type MemberServiceDefinition = {
  id: string;
  path: string;
  matchPrefixes?: string[];
  label: string;
  labelKey: string;
  description: string;
  descriptionKey: string;
  group: MemberServiceGroup;
  iconKey: MemberServiceIconKey;
  featureKey: PortalFeatureKey | null;
  ordinaryMemberAllowed: boolean;
  showInServices: boolean;
  backTitle?: string;
  backTitleKey?: string;
  requiresExistingFeature?: boolean;
  requiresExplicitChurchEnable?: boolean;
};

export const memberServiceGroups: Array<{ id: MemberServiceGroup; label: string; labelKey: string }> = [
  { id: "today", label: "Leo", labelKey: "member_service_groups.today" },
  { id: "parish", label: "Parokia", labelKey: "member_service_groups.parish" },
  { id: "worship", label: "Ibada", labelKey: "member_service_groups.worship" },
  { id: "giving", label: "Michango", labelKey: "member_service_groups.giving" },
  { id: "community", label: "Jumuiya na Huduma", labelKey: "member_service_groups.community" },
  { id: "media", label: "Media", labelKey: "member_service_groups.media" },
];

export const memberServiceRegistry: MemberServiceDefinition[] = [
  { id: "home", path: "/portal", label: "Nyumbani", labelKey: "member_services.home.label", description: "Nyumbani", descriptionKey: "member_services.home.description", group: "today", iconKey: "church", featureKey: null, ordinaryMemberAllowed: true, showInServices: false },
  { id: "services", path: "/portal/services", label: "Huduma", labelKey: "member_services.services.label", description: "Huduma zote", descriptionKey: "member_services.services.description", group: "today", iconKey: "church", featureKey: null, ordinaryMemberAllowed: true, showInServices: false },
  { id: "today", path: "/portal/today", label: "Leo", labelKey: "member_services.today.label", description: "Masomo, mtakatifu na maisha ya leo", descriptionKey: "member_services.today.description", group: "today", iconKey: "book", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Leo", backTitleKey: "member_services.today.back_title" },
  { id: "liturgical-calendar", path: "/portal/liturgical-calendar", label: "Kalenda ya Liturujia", labelKey: "member_services.liturgical_calendar.label", description: "Sikukuu na majira ya Kanisa", descriptionKey: "member_services.liturgical_calendar.description", group: "today", iconKey: "calendar", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Kalenda ya Liturujia", backTitleKey: "member_services.liturgical_calendar.back_title" },
  { id: "bible", path: "/portal/bible", matchPrefixes: ["/portal/bible/"], label: "Biblia", labelKey: "member_services.bible.label", description: "Soma Biblia", descriptionKey: "member_services.bible.description", group: "today", iconKey: "book", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Biblia", backTitleKey: "member_services.bible.back_title" },
  { id: "prayers", path: "/portal/prayers", matchPrefixes: ["/portal/prayers/"], label: "Sala", labelKey: "member_services.prayers.label", description: "Soma sala zilizochapishwa", descriptionKey: "member_services.prayers.description", group: "today", iconKey: "prayer", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Sala", backTitleKey: "member_services.prayers.back_title" },
  { id: "reflections", path: "/portal/reflections", matchPrefixes: ["/portal/reflections/"], label: "Tafakari", labelKey: "member_services.reflections.label", description: "Tafakari za masomo ya kila siku", descriptionKey: "member_services.reflections.description", group: "today", iconKey: "book", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Tafakari", backTitleKey: "member_services.reflections.back_title" },
  { id: "daily-readings", path: "/portal/daily-readings", label: "Masomo ya Leo", labelKey: "member_services.daily_readings.label", description: "Masomo kamili ya leo", descriptionKey: "member_services.daily_readings.description", group: "today", iconKey: "book", featureKey: null, ordinaryMemberAllowed: true, showInServices: false, backTitle: "Masomo ya Leo", backTitleKey: "member_services.daily_readings.back_title" },
  { id: "my-parish", path: "/portal/my-parish", label: "Parokia Yangu", labelKey: "member_services.my_parish.label", description: "Misa, matukio na huduma za parokia", descriptionKey: "member_services.my_parish.description", group: "parish", iconKey: "church", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Parokia Yangu", backTitleKey: "member_services.my_parish.back_title" },
  { id: "jumuiya", path: "/portal/jumuiya", label: "Jumuiya Yangu", labelKey: "member_services.jumuiya.label", description: "Angalia Jumuiya ya parokia uliyopewa", descriptionKey: "member_services.jumuiya.description", group: "community", iconKey: "users", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Jumuiya Yangu", backTitleKey: "member_services.jumuiya.back_title" },
  { id: "notifications", path: "/portal/notifications", label: "Arifa", labelKey: "member_services.notifications.label", description: "Taarifa na vikumbusho vyako", descriptionKey: "member_services.notifications.description", group: "parish", iconKey: "announcement", featureKey: "notifications", ordinaryMemberAllowed: true, showInServices: false, backTitle: "Arifa", backTitleKey: "member_services.notifications.back_title", requiresExistingFeature: true },
  { id: "announcements", path: "/portal/announcements", label: "Matangazo", labelKey: "member_services.announcements.label", description: "Taarifa mpya za parokia", descriptionKey: "member_services.announcements.description", group: "parish", iconKey: "announcement", featureKey: "announcements", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Matangazo", backTitleKey: "member_services.announcements.back_title" },
  { id: "channels", path: "/portal/channels", label: "Mawasiliano", labelKey: "member_services.channels.label", description: "Soma na jibu ujumbe wa vikundi vyako", descriptionKey: "member_services.channels.description", group: "parish", iconKey: "message", featureKey: "channels", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Njia za Mawasiliano", backTitleKey: "member_services.channels.back_title", requiresExistingFeature: true },
  { id: "events", path: "/portal/events", label: "Matukio", labelKey: "member_services.events.label", description: "Matukio yajayo ya parokia", descriptionKey: "member_services.events.description", group: "parish", iconKey: "calendar", featureKey: "events", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Matukio", backTitleKey: "member_services.events.back_title" },
  { id: "event-requests", path: "/portal/event-requests", label: "Huduma za Ofisi", labelKey: "member_services.event_requests.label", description: "Omba huduma na fuatilia maombi yako", descriptionKey: "member_services.event_requests.description", group: "parish", iconKey: "calendar", featureKey: "event_requests", ordinaryMemberAllowed: true, showInServices: false, backTitle: "Huduma za Ofisi", backTitleKey: "member_services.event_requests.back_title" },
  { id: "calendar", path: "/portal/calendar", label: "Ratiba ya Parokia", labelKey: "member_services.calendar.label", description: "Misa na matukio yajayo ya parokia", descriptionKey: "member_services.calendar.description", group: "parish", iconKey: "calendar", featureKey: "events", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Ratiba", backTitleKey: "member_services.calendar.back_title" },
  { id: "sermons", path: "/portal/sermons", label: "Mahubiri", labelKey: "member_services.sermons.label", description: "Soma mahubiri ya parokia", descriptionKey: "member_services.sermons.description", group: "parish", iconKey: "church", featureKey: "sermons", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Mahubiri", backTitleKey: "member_services.sermons.back_title" },
  { id: "mass-intentions", path: "/portal/mass-intentions", label: "Nia za Misa", labelKey: "member_services.mass_intentions.label", description: "Wasilisha au fuatilia nia", descriptionKey: "member_services.mass_intentions.description", group: "worship", iconKey: "intention", featureKey: "mass_intentions", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Nia za Misa", backTitleKey: "member_services.mass_intentions.back_title" },
  { id: "prayer-requests", path: "/portal/prayer-requests", label: "Ombi la Maombi", labelKey: "member_services.prayer_requests.label", description: "Tuma na fuatilia ombi", descriptionKey: "member_services.prayer_requests.description", group: "worship", iconKey: "prayer", featureKey: "prayer_requests", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Maombi", backTitleKey: "member_services.prayer_requests.back_title" },
  { id: "livestream", path: "/portal/live", matchPrefixes: ["/portal/live/"], label: "Misa Mubashara", labelKey: "member_services.livestream.label", description: "Tazama Misa mubashara", descriptionKey: "member_services.livestream.description", group: "worship", iconKey: "church", featureKey: "livestream", ordinaryMemberAllowed: true, showInServices: false, backTitle: "Misa Mubashara", backTitleKey: "member_services.livestream.back_title", requiresExistingFeature: true },
  { id: "give", path: "/portal/give", label: "Toa Mchango", labelKey: "member_services.give.label", description: "Changia parokia yako", descriptionKey: "member_services.give.description", group: "giving", iconKey: "giving", featureKey: "give", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Michango", backTitleKey: "member_services.give.back_title" },
  { id: "contribution-history", path: "/portal/contribution-history", matchPrefixes: ["/portal/contribution-receipt/"], label: "Historia ya Michango", labelKey: "member_services.contribution_history.label", description: "Angalia michango na risiti", descriptionKey: "member_services.contribution_history.description", group: "giving", iconKey: "giving", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Historia ya Michango", backTitleKey: "member_services.contribution_history.back_title" },
  { id: "pledges", path: "/portal/pledges", label: "Ahadi za Michango", labelKey: "member_services.pledges.label", description: "Angalia ahadi zako", descriptionKey: "member_services.pledges.description", group: "giving", iconKey: "giving", featureKey: "pledges", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Ahadi za Michango", backTitleKey: "member_services.pledges.back_title" },
  { id: "ministries", path: "/portal/ministries", matchPrefixes: ["/portal/ministries/"], label: "Huduma za Parokia", labelKey: "member_services.ministries.label", description: "Omba kujiunga na huduma ya parokia", descriptionKey: "member_services.ministries.description", group: "community", iconKey: "users", featureKey: "ministries", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Huduma za Parokia", backTitleKey: "member_services.ministries.back_title", requiresExistingFeature: true },
  { id: "kanisa-ai", path: "/portal/kanisa-ai", label: "Uliza Kanisa", labelKey: "member_services.kanisa_ai.label", description: "Uliza kuhusu huduma za kanisa lako", descriptionKey: "member_services.kanisa_ai.description", group: "community", iconKey: "message", featureKey: "kanisa_ai", ordinaryMemberAllowed: true, showInServices: true, requiresExplicitChurchEnable: true },
  { id: "radio", path: "/portal/radio", label: "Radio", labelKey: "member_services.radio.label", description: "Sikiliza radio ya parokia", descriptionKey: "member_services.radio.description", group: "media", iconKey: "radio", featureKey: "radio", ordinaryMemberAllowed: true, showInServices: true, backTitle: "Radio", backTitleKey: "member_services.radio.back_title" },
  { id: "library", path: "/portal/library", matchPrefixes: ["/portal/library/", "/portal/saints/", "/member/library"], label: "Watakatifu", labelKey: "member_services.library.label", description: "Maktaba ya imani", descriptionKey: "member_services.library.description", group: "today", iconKey: "book", featureKey: null, ordinaryMemberAllowed: true, showInServices: true, backTitle: "Watakatifu", backTitleKey: "member_services.library.back_title" },
  { id: "dashboard", path: "/portal/dashboard", label: "Historia Yangu", labelKey: "member_services.dashboard.label", description: "Historia na wasifu", descriptionKey: "member_services.dashboard.description", group: "giving", iconKey: "giving", featureKey: null, ordinaryMemberAllowed: true, showInServices: false, backTitle: "Historia Yangu", backTitleKey: "member_services.dashboard.back_title" },
];

function normalizeMemberServicePath(pathname: string) {
  return (pathname.replace(/\/$/, "") || "/").replace(/^\/member(?=\/|$)/, "/portal");
}

function pathMatches(pathname: string, path: string) {
  return pathname === path || (path !== "/portal" && pathname.startsWith(`${path}/`));
}

export function getMemberServiceForPath(pathname: string) {
  const normalizedPathname = normalizeMemberServicePath(pathname);
  return memberServiceRegistry.find((service) =>
    pathMatches(normalizedPathname, service.path) ||
    service.matchPrefixes?.some((prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(prefix)),
  ) ?? null;
}

export function isOrdinaryMemberPathAllowed(pathname: string) {
  return getMemberServiceForPath(pathname)?.ordinaryMemberAllowed === true;
}

export function getMemberBackTitle(pathname: string) {
  return getMemberServiceForPath(pathname)?.backTitle;
}

export function getMemberBackTitleKey(pathname: string) {
  const service = getMemberServiceForPath(pathname);
  return service?.backTitleKey ?? service?.labelKey;
}
