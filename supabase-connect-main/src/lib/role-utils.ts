export type AppRole =
  | "super_admin"
  | "church_admin"
  | "pastor"
  | "secretary"
  | "treasurer"
  | "member";

const ADMIN_ROLES: AppRole[] = ["church_admin", "pastor", "secretary", "treasurer"];

export function isAdminRole(role: AppRole | null | undefined) {
  return !!role && ADMIN_ROLES.includes(role);
}

export function getDefaultRouteForRole(role: AppRole | null | undefined, isSuperAdmin = false) {
  if (isSuperAdmin || role === "super_admin") return "/super-admin";
  if (role === "pastor") return "/pastoral";
  if (role === "treasurer") return "/finance";
  if (role === "church_admin" || role === "secretary") return "/church-admin";
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
