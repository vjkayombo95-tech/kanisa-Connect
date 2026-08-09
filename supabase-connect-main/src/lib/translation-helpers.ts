import type { TFunction } from "i18next";

const massIntentionKeyMap: Record<string, string> = {
  thanksgiving: "mass_intentions_labels.thanksgiving",
  healing: "mass_intentions_labels.healing",
  remembrance: "mass_intentions_labels.remembrance",
  special: "mass_intentions_labels.special",
  special_intention: "mass_intentions_labels.special",
  departed: "mass_intentions_labels.departed",
  for_the_departed: "mass_intentions_labels.departed",
  peace: "mass_intentions_labels.peace",
  for_peace: "mass_intentions_labels.peace",
};

const eventRequestKeyMap: Record<string, string> = {
  wedding: "event_request.wedding",
  baptism: "event_request.baptism",
  funeral: "event_request.funeral",
  other: "event_request.other",
};

const statusKeyMap: Record<string, string> = {
  pending: "common.pending",
  approved: "common.approved",
  rejected: "common.rejected",
  reviewed: "common.reviewed",
  completed: "common.completed",
};

const contributionCategoryKeyMap: Record<string, string> = {
  tithe: "contributions.tithe",
  offering: "contributions.offering",
  building_fund: "contributions.building_fund",
  donation: "contributions.donation",
  donations: "contributions.donation",
  "building fund": "contributions.building_fund",
};

const contributionCategoryFullKeyMap: Record<string, string> = {
  tithe: "contributions.tithe_full",
  offering: "contributions.offering_full",
  building_fund: "contributions.building_fund_full",
  donation: "contributions.donation_full",
  donations: "contributions.donation_full",
  "building fund": "contributions.building_fund_full",
};

function startCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function translateMassIntentionType(t: TFunction, value: string | null | undefined) {
  if (!value) return "";
  return t(massIntentionKeyMap[value] ?? "", { defaultValue: startCase(value) });
}

export function translateEventRequestType(t: TFunction, value: string | null | undefined) {
  if (!value) return "";
  return t(eventRequestKeyMap[value] ?? "", { defaultValue: startCase(value) });
}

export function translateStatus(t: TFunction, value: string | null | undefined) {
  if (!value) return "";
  return t(statusKeyMap[value] ?? "", { defaultValue: startCase(value) });
}

export function normalizeContributionCategoryKey(value: string | null | undefined) {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function translateContributionCategory(
  t: TFunction,
  value: string | null | undefined,
  mode: "short" | "full" = "short",
) {
  if (!value) return "";
  const normalized = normalizeContributionCategoryKey(value);
  const keyMap = mode === "full" ? contributionCategoryFullKeyMap : contributionCategoryKeyMap;
  return t(keyMap[normalized] ?? "", { defaultValue: startCase(normalized) });
}
