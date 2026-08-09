export type AuthorizationResolution = "loading" | "found" | "not_found" | "error";

export type AuthorizationResolutionState = {
  auth: AuthorizationResolution;
  profile: AuthorizationResolution;
  membership: AuthorizationResolution;
  roles: AuthorizationResolution;
  permissions: AuthorizationResolution;
  church: AuthorizationResolution;
};

const resolvedStates = new Set<AuthorizationResolution>(["found", "not_found"]);

export function createLoadingAuthorizationState(auth: AuthorizationResolution = "loading"): AuthorizationResolutionState {
  return {
    auth,
    profile: "loading",
    membership: "loading",
    roles: "loading",
    permissions: "loading",
    church: "loading",
  };
}

export function createAnonymousAuthorizationState(): AuthorizationResolutionState {
  return {
    auth: "not_found",
    profile: "not_found",
    membership: "not_found",
    roles: "not_found",
    permissions: "not_found",
    church: "not_found",
  };
}

export function createResolvedAuthorizationState(input: {
  profile: unknown;
  membership: unknown;
  roles: readonly string[];
  permissions: unknown;
  churchId: string | null;
}): AuthorizationResolutionState {
  return {
    auth: "found",
    profile: input.profile ? "found" : "not_found",
    membership: input.membership ? "found" : "not_found",
    roles: input.roles.length > 0 ? "found" : "not_found",
    permissions: input.permissions ? "found" : "not_found",
    church: input.churchId ? "found" : "not_found",
  };
}

export function createAuthorizationErrorState(): AuthorizationResolutionState {
  return {
    auth: "found",
    profile: "error",
    membership: "error",
    roles: "error",
    permissions: "error",
    church: "error",
  };
}

export function isAuthorizationReady(state: AuthorizationResolutionState) {
  return Object.values(state).every((value) => resolvedStates.has(value));
}

export function shouldRedirectToMemberOnboarding(input: {
  authorizationReady: boolean;
  authenticated: boolean;
  isSuperAdmin: boolean;
  churchId: string | null;
}) {
  return input.authorizationReady
    && input.authenticated
    && !input.isSuperAdmin
    && !input.churchId;
}
