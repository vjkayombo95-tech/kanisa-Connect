import type { ParishCalendarCategory, ParishCalendarEventType, ParishCalendarVisibility } from "@/components/calendar/types";

export type CatholicEventTaxonomyGroupId =
  | "liturgy"
  | "sacramental_life"
  | "formation"
  | "parish_life"
  | "ministry"
  | "community"
  | "other";

export type CatholicEventFormCapability =
  | "location"
  | "endTime"
  | "description"
  | "visibility"
  | "minister"
  | "ministry"
  | "community"
  | "recurrenceHint";

export type CatholicEventTaxonomyItem = {
  id: ParishCalendarEventType;
  labelKey: string;
  groupId: CatholicEventTaxonomyGroupId;
  calendarCategory: ParishCalendarCategory;
  suggestedService: string;
  defaultVisibility: ParishCalendarVisibility;
  memberDiscoverable: boolean;
  supportsRecurrence: boolean;
  sacramentalClassification?: "confession" | "baptism" | "marriage" | "confirmation" | "first_communion" | "anointing" | "funeral";
  aliases: string[];
  formCapabilities: CatholicEventFormCapability[];
};

export const catholicEventTaxonomyGroups: Array<{ id: CatholicEventTaxonomyGroupId; labelKey: string }> = [
  { id: "liturgy", labelKey: "church_admin.events.taxonomy.groups.liturgy" },
  { id: "sacramental_life", labelKey: "church_admin.events.taxonomy.groups.sacramental_life" },
  { id: "formation", labelKey: "church_admin.events.taxonomy.groups.formation" },
  { id: "parish_life", labelKey: "church_admin.events.taxonomy.groups.parish_life" },
  { id: "ministry", labelKey: "church_admin.events.taxonomy.groups.ministry" },
  { id: "community", labelKey: "church_admin.events.taxonomy.groups.community" },
  { id: "other", labelKey: "church_admin.events.taxonomy.groups.other" },
];

const sharedFields: CatholicEventFormCapability[] = ["location", "endTime", "description", "visibility"];
const sacramentalFields: CatholicEventFormCapability[] = [...sharedFields, "minister", "recurrenceHint"];

export const catholicEventTaxonomy: CatholicEventTaxonomyItem[] = [
  item("mass", "liturgy", "mass", "Liturgy", "public", true, true, ["mass", "misa", "eucharist"], ["location", "endTime", "description", "visibility", "minister", "recurrenceHint"]),
  item("adoration", "liturgy", "prayer", "Liturgy", "public", true, true, ["adoration", "eucharistic adoration"], sharedFields),
  item("benediction", "liturgy", "prayer", "Liturgy", "public", true, true, ["benediction"], sharedFields),
  item("stations_of_the_cross", "liturgy", "prayer", "Liturgy", "public", true, true, ["stations", "way of the cross"], sharedFields),
  item("rosary", "liturgy", "prayer", "Liturgy", "public", true, true, ["rosary", "rozari"], sharedFields),
  item("procession", "liturgy", "prayer", "Liturgy", "public", true, false, ["procession"], sharedFields),
  item("liturgical", "liturgy", "liturgical", "Liturgy", "public", true, false, ["liturgical celebration", "celebration", "sikukuu"], sharedFields),

  item("confession", "sacramental_life", "prayer", "Sacramental Life", "public", true, true, ["confession", "reconciliation", "maungamo"], sacramentalFields, "confession"),
  item("baptism", "sacramental_life", "prayer", "Sacramental Life", "public", true, true, ["baptism", "baptisms", "ubatizo"], sacramentalFields, "baptism"),
  item("wedding", "sacramental_life", "prayer", "Sacramental Life", "public", true, false, ["marriage", "wedding", "ndoa"], sacramentalFields, "marriage"),
  item("confirmation", "sacramental_life", "prayer", "Sacramental Life", "member", true, true, ["confirmation", "kipaimara"], sharedFields, "confirmation"),
  item("first_communion", "sacramental_life", "prayer", "Sacramental Life", "member", true, true, ["first communion", "komunyo"], sharedFields, "first_communion"),
  item("anointing_of_sick", "sacramental_life", "prayer", "Sacramental Life", "member", true, false, ["anointing", "sick", "mpako"], sacramentalFields, "anointing"),
  item("funeral", "sacramental_life", "prayer", "Sacramental Life", "public", true, false, ["funeral", "memorial", "mazishi"], sharedFields, "funeral"),

  item("bible_study", "formation", "ministry", "Formation", "member", true, true, ["bible study", "kujifunza biblia"], sharedFields),
  item("rcia", "formation", "ministry", "Formation", "member", true, true, ["rcia", "ocia", "catechumenate"], sharedFields),
  item("seminar", "formation", "ministry", "Formation", "member", true, true, ["seminar", "formation session"], sharedFields),
  item("training", "formation", "ministry", "Formation", "member", true, true, ["formation", "mafunzo"], sharedFields),
  item("catechism", "formation", "ministry", "Formation", "member", true, true, ["catechism", "katekisimu"], sharedFields),
  item("retreat", "formation", "prayer", "Formation", "member", true, false, ["retreat", "mafungo"], sharedFields),

  item("council_meeting", "parish_life", "meeting", "Parish Life", "member", true, true, ["meeting", "baraza", "parish meeting"], sharedFields),
  item("finance", "parish_life", "finance", "Finance", "member", true, false, ["fundraising", "harambee", "fundraiser"], sharedFields),
  item("public_event", "parish_life", "community", "Parish Life", "public", true, false, ["celebration", "parish event", "public event"], sharedFields),

  item("ministry_meeting", "ministry", "ministry", "Ministry", "member", true, true, ["ministry", "choir", "youth", "children", "huduma"], [...sharedFields, "ministry"]),
  item("community_meeting", "community", "community", "Community", "member", true, true, ["community", "jumuiya", "scc"], [...sharedFields, "community"]),
  item("custom", "other", "custom", "Parish Life", "member", true, false, ["custom", "other"], sharedFields),
];

function item(
  id: ParishCalendarEventType,
  groupId: CatholicEventTaxonomyGroupId,
  calendarCategory: ParishCalendarCategory,
  suggestedService: string,
  defaultVisibility: ParishCalendarVisibility,
  memberDiscoverable: boolean,
  supportsRecurrence: boolean,
  aliases: string[],
  formCapabilities: CatholicEventFormCapability[],
  sacramentalClassification?: CatholicEventTaxonomyItem["sacramentalClassification"],
): CatholicEventTaxonomyItem {
  return {
    id,
    groupId,
    calendarCategory,
    suggestedService,
    defaultVisibility,
    memberDiscoverable,
    supportsRecurrence,
    sacramentalClassification,
    aliases,
    formCapabilities,
    labelKey: `member_portal.parish_life.event_types.${id}`,
  };
}

export function findCatholicEventType(id: string | null | undefined) {
  if (!id) return catholicEventTaxonomy.find((item) => item.id === "custom");
  return catholicEventTaxonomy.find((item) => item.id === id) ?? catholicEventTaxonomy.find((item) => item.id === "custom");
}

export function applyCatholicEventDefaults(id: string | null | undefined) {
  const eventType = findCatholicEventType(id);
  return {
    eventType: eventType?.id ?? "custom",
    ministry: eventType?.suggestedService ?? "Parish Life",
    visibility: eventType?.defaultVisibility ?? "member",
  };
}

export function findCatholicEventTypeForPrompt(input: string) {
  const text = input.toLowerCase();
  return catholicEventTaxonomy.find((item) => item.aliases.some((alias) => text.includes(alias)));
}
