export type AppRole =
  | "super_admin"
  | "church_admin"
  | "pastor"
  | "secretary"
  | "treasurer"
  | "member"
  | (string & {});

export function isAdminRole(role: AppRole | null | undefined) {
  return !!role && role !== "member";
}

export function hasAnyRole(roles: readonly string[] | null | undefined, required: readonly string[]) {
  return required.some((role) => roles?.includes(role));
}

export function isAdminRoles(roles: readonly string[] | null | undefined) {
  return roles?.some((role) => role !== "member") === true;
}

export function getDefaultRouteForRole(role: AppRole | null | undefined, isSuperAdmin = false) {
  if (isSuperAdmin || role === "super_admin") return "/super-admin";
  if (role === "pastor") return "/pastoral";
  if (role === "treasurer") return "/finance";
  if (role && role !== "member") return "/church-admin";
  return "/portal";
}

export function getDefaultRouteForRoles(roles: readonly string[] | null | undefined, isSuperAdmin = false) {
  if (isSuperAdmin || roles?.includes("super_admin")) return "/super-admin";
  if (roles?.includes("church_admin") || roles?.includes("secretary")) return "/church-admin";
  if (roles?.includes("pastor")) return "/pastoral";
  if (roles?.includes("treasurer")) return "/finance";
  if (roles?.some((role) => role !== "member")) return "/church-admin";
  return "/portal";
}

export function canManageMembers(role: AppRole | null | undefined) {
  return isAdminRole(role) || role === "super_admin";
}

export function canManageGroups(role: AppRole | null | undefined) {
  return isAdminRole(role) || role === "super_admin";
}

export function canViewReports(role: AppRole | null | undefined) {
  return isAdminRole(role) || role === "super_admin";
}

export function canAccessFinancialFeatures(role: AppRole | null | undefined) {
  return isAdminRole(role) || role === "super_admin";
}
