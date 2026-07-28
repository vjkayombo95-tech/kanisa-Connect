import type { WorkspaceNavigationGroup, WorkspaceNavigationItem } from "./framework";
import { NavigationGroups, type NavigationGroupId } from "./navigation-groups";

export const CANONICAL_FINANCE_ITEM_ORDER = [
  "finance-dashboard",
  "contributions",
  "qr-payments",
  "receipts",
  "exports",
  "finance-intelligence",
  "pledges",
  "reports",
] as const;

export const CANONICAL_OPERATIONS_ITEM_ORDER = [
  "calendar",
  "events",
  "event-requests",
  "announcements",
  "sermons",
  "operations",
  "audio-processing",
  "reports",
  "finance-summary",
] as const;

const CANONICAL_ITEM_ORDER: Partial<Record<NavigationGroupId, readonly string[]>> = {
  [NavigationGroups.FINANCE]: CANONICAL_FINANCE_ITEM_ORDER,
  [NavigationGroups.OPERATIONS]: CANONICAL_OPERATIONS_ITEM_ORDER,
};

function isSameNavigationItem(
  left: WorkspaceNavigationItem,
  right: WorkspaceNavigationItem,
) {
  if (left.id && right.id) return left.id === right.id;
  return left.to === right.to;
}

function sortItems(groupId: NavigationGroupId, items: WorkspaceNavigationItem[]) {
  const order = CANONICAL_ITEM_ORDER[groupId];
  if (!order) return items;

  const position = new Map(order.map((id, index) => [id, index]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftPosition = position.get(left.item.id) ?? Number.MAX_SAFE_INTEGER;
      const rightPosition = position.get(right.item.id) ?? Number.MAX_SAFE_INTEGER;
      return leftPosition - rightPosition || left.index - right.index;
    })
    .map(({ item }) => item);
}

/**
 * Deterministically combines role navigation without making authorization
 * decisions. Items retain their feature and route metadata; the shared
 * desktop/mobile visibility layer filters them through effective permissions.
 */
export function mergeNavigationGroups(
  groupCollections: readonly (readonly WorkspaceNavigationGroup[])[],
  coherentGroupIds: readonly NavigationGroupId[] = [NavigationGroups.PASTORAL_CARE],
) {
  const groups: WorkspaceNavigationGroup[] = [];
  const coherentGroups = new Set(coherentGroupIds);

  for (const collection of groupCollections) {
    for (const sourceGroup of collection) {
      if (coherentGroups.has(sourceGroup.id)) {
        for (const existingGroup of groups) {
          if (existingGroup.id === sourceGroup.id) continue;
          existingGroup.items = existingGroup.items.filter(
            (item) => !sourceGroup.items.some((sourceItem) => isSameNavigationItem(item, sourceItem)),
          );
        }
      }

      let targetGroup = groups.find((group) => group.id === sourceGroup.id);
      if (!targetGroup) {
        targetGroup = { ...sourceGroup, items: [] };
        groups.push(targetGroup);
      }

      for (const item of sourceGroup.items) {
        const duplicate = groups.some((group) => group.items.some(
          (candidate) => isSameNavigationItem(candidate, item),
        ));
        if (!duplicate) targetGroup.items.push(item);
      }
    }
  }

  return groups
    .filter((group) => group.items.length > 0)
    .map((group) => ({ ...group, items: sortItems(group.id, group.items) }));
}

export function filterVisibleNavigationGroups(
  groups: readonly WorkspaceNavigationGroup[],
  isVisible: (item: WorkspaceNavigationItem) => boolean,
) {
  return groups
    .map((group) => ({ ...group, items: group.items.filter(isVisible) }))
    .filter((group) => group.items.length > 0);
}
