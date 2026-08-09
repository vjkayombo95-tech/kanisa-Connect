import type { ChurchPermissionAction } from "@/hooks/use-church-permission";

export const PERMISSION_CLASSIFICATIONS = {
  CONFIGURABLE: "CONFIGURABLE",
  RESTRICTED: "RESTRICTED",
  SYSTEM_PROTECTED: "SYSTEM_PROTECTED",
} as const;

export type PermissionClassification =
  (typeof PERMISSION_CLASSIFICATIONS)[keyof typeof PERMISSION_CLASSIFICATIONS];

export type PermissionRecordScope = "own" | "assigned" | "church" | "platform" | "none";

export type PermissionConstraint = {
  feature_key: string;
  action: ChurchPermissionAction;
  classification: PermissionClassification;
  record_scope: PermissionRecordScope;
  reason: string;
};

export type PermissionDraft = Record<string, Record<ChurchPermissionAction, boolean>>;

export const CHURCH_PERMISSION_ACTIONS: ChurchPermissionAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "publish",
  "manage",
];

const failSecureConstraint = (
  featureKey: string,
  action: ChurchPermissionAction,
): PermissionConstraint => ({
  feature_key: featureKey,
  action,
  classification: PERMISSION_CLASSIFICATIONS.SYSTEM_PROTECTED,
  record_scope: "none",
  reason: "The server did not return an applicable permission rule.",
});

export function indexPermissionConstraints(rows: PermissionConstraint[]) {
  return new Map(rows.map((row) => [`${row.feature_key}:${row.action}`, row]));
}

export function resolvePermissionConstraint(
  constraints: ReadonlyMap<string, PermissionConstraint>,
  featureKey: string,
  action: ChurchPermissionAction,
) {
  return constraints.get(`${featureKey}:${action}`) ?? failSecureConstraint(featureKey, action);
}

export function applyRecommendedPermissions(
  current: PermissionDraft,
  featureKeys: string[],
  constraints: ReadonlyMap<string, PermissionConstraint>,
  recommended: (featureKey: string, action: ChurchPermissionAction) => boolean,
) {
  const next: PermissionDraft = structuredClone(current);
  let skipped = 0;

  for (const featureKey of featureKeys) {
    next[featureKey] ??= Object.fromEntries(
      CHURCH_PERMISSION_ACTIONS.map((action) => [action, false]),
    ) as Record<ChurchPermissionAction, boolean>;

    for (const action of CHURCH_PERMISSION_ACTIONS) {
      const constraint = resolvePermissionConstraint(constraints, featureKey, action);
      if (constraint.classification !== PERMISSION_CLASSIFICATIONS.CONFIGURABLE) {
        skipped += 1;
        continue;
      }
      next[featureKey][action] = recommended(featureKey, action);
    }
  }

  return { draft: next, skipped };
}
