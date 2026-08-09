import type { QueryClient, QueryKey } from "@tanstack/react-query";

export type AuthorizationRealtimeSource =
  | "user_roles"
  | "members"
  | "profiles"
  | "church_role_permissions"
  | "church_features"
  | "subscriptions"
  | "platform_features";

export type AuthorizationRealtimeScope = {
  userId: string;
  churchId: string | null;
};

export type AuthorizationRealtimePayload = {
  eventType?: "INSERT" | "UPDATE" | "DELETE" | string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

export const AUTHORIZATION_REALTIME_DEPENDENCIES: Record<AuthorizationRealtimeSource, {
  scopeColumn: "user_id" | "id" | "church_id" | null;
  refreshUserContext: boolean;
}> = {
  user_roles: { scopeColumn: "user_id", refreshUserContext: true },
  members: { scopeColumn: "user_id", refreshUserContext: true },
  profiles: { scopeColumn: "id", refreshUserContext: true },
  church_role_permissions: { scopeColumn: "church_id", refreshUserContext: false },
  church_features: { scopeColumn: "church_id", refreshUserContext: false },
  subscriptions: { scopeColumn: "church_id", refreshUserContext: false },
  platform_features: { scopeColumn: null, refreshUserContext: false },
};

const churchPermissionKeys = (scope: AuthorizationRealtimeScope): QueryKey[] => [
  ["church-permission", scope.churchId],
  ["church-feature-permission-matrix", scope.churchId],
  ["church-permission-constraints", scope.churchId],
];

export function getAuthorizationInvalidationKeys(
  source: AuthorizationRealtimeSource,
  scope: AuthorizationRealtimeScope,
): QueryKey[] {
  const permissionKeys = churchPermissionKeys(scope);

  switch (source) {
    case "user_roles":
    case "members":
    case "profiles":
      return [
        ...permissionKeys,
        ["church-role-permissions", scope.churchId],
        ["portal-church-features", scope.churchId],
        ["feature-subscription-plan", scope.churchId],
      ];
    case "church_role_permissions":
      return [...permissionKeys, ["church-role-permissions", scope.churchId]];
    case "church_features":
      return [...permissionKeys, ["portal-church-features", scope.churchId]];
    case "subscriptions":
      return [...permissionKeys, ["feature-subscription-plan", scope.churchId]];
    case "platform_features":
      return [...permissionKeys, ["portal-platform-features"]];
  }
}

function payloadValues(payload: AuthorizationRealtimePayload, column: string) {
  return [payload.new?.[column], payload.old?.[column]].filter(
    (value): value is string => typeof value === "string",
  );
}

/**
 * Realtime is only a cache signal. Never apply payload data directly, and
 * discard events whose OLD/NEW tenant identity does not match this session.
 */
export function isAuthorizationEventInScope(
  source: AuthorizationRealtimeSource,
  payload: AuthorizationRealtimePayload,
  scope: AuthorizationRealtimeScope,
) {
  const dependency = AUTHORIZATION_REALTIME_DEPENDENCIES[source];
  if (!dependency.scopeColumn) return true;

  const expected = dependency.scopeColumn === "church_id" ? scope.churchId : scope.userId;
  if (!expected) return false;

  return payloadValues(payload, dependency.scopeColumn).includes(expected);
}

export async function invalidateAuthorizationQueries(
  queryClient: QueryClient,
  source: AuthorizationRealtimeSource,
  scope: AuthorizationRealtimeScope,
) {
  await Promise.all(getAuthorizationInvalidationKeys(source, scope).map((queryKey) =>
    queryClient.invalidateQueries({ queryKey }),
  ));
}

/** Remove privileged decisions immediately when the authoritative refresh path fails. */
export function removeAuthorizationQueries(queryClient: QueryClient, scope: AuthorizationRealtimeScope) {
  const allSources = Object.keys(AUTHORIZATION_REALTIME_DEPENDENCIES) as AuthorizationRealtimeSource[];
  const keys = allSources.flatMap((source) => getAuthorizationInvalidationKeys(source, scope));
  for (const queryKey of keys) queryClient.removeQueries({ queryKey });
}
