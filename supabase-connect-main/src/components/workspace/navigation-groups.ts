export const NavigationGroups = {
  MEMBER_HOME: "member-home",
  MEMBER_LITURGY: "member-liturgy",
  MEMBER_COMMUNITY: "member-community",
  MEMBER_FINANCE: "member-finance",
  PASTORAL_HOME: "pastoral-home",
  PASTORAL_CARE: "pastoral-care",
  PASTORAL_LITURGY: "pastoral-liturgy",
  OPERATIONS: "operations",
  ADMIN_HOME: "admin-home",
  ADMIN_PEOPLE: "admin-people",
  ADMIN_LITURGY: "admin-liturgy",
  FINANCE: "finance",
  ADMIN_ADMINISTRATION: "admin-administration",
  FINANCE_HOME: "finance-home",
  FINANCE_PARISH: "finance-parish",
  FINANCE_ADMINISTRATION: "finance-administration",
  PLATFORM_HOME: "platform-home",
  PLATFORM_TENANTS: "platform-tenants",
  PLATFORM_FINANCE: "platform-finance",
  PLATFORM_CONTENT: "platform-content",
  PLATFORM_ADMINISTRATION: "platform-administration",
} as const;

export type NavigationGroupId = typeof NavigationGroups[keyof typeof NavigationGroups];

type NavigationGroupRegistration = {
  id: NavigationGroupId;
  labelKey?: string;
};

export type DuplicateNavigationGroupRegistration = {
  translationKey: string;
  registeredIds: NavigationGroupId[];
};

export function findDuplicateNavigationGroupTranslationKeys(
  groups: readonly NavigationGroupRegistration[],
): DuplicateNavigationGroupRegistration[] {
  const registrations = new Map<string, Set<NavigationGroupId>>();

  for (const group of groups) {
    if (!group.labelKey) continue;
    const ids = registrations.get(group.labelKey) ?? new Set<NavigationGroupId>();
    ids.add(group.id);
    registrations.set(group.labelKey, ids);
  }

  return [...registrations.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([translationKey, ids]) => ({ translationKey, registeredIds: [...ids].sort() }));
}

export function warnAboutDuplicateNavigationGroupTranslationKeys(
  groups: readonly NavigationGroupRegistration[],
) {
  if (!import.meta.env.DEV) return;

  for (const duplicate of findDuplicateNavigationGroupTranslationKeys(groups)) {
    console.warn(
      `Navigation configuration warning:\n\nTranslation key:\n${duplicate.translationKey}\n\nRegistered IDs:\n${duplicate.registeredIds.join("\n")}\n\nThis is likely an unintended duplicate semantic group.`,
    );
  }
}
