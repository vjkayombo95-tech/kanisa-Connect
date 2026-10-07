export const DIOCESE_STATUSES = ["active", "inactive", "archived"] as const;
export const DIOCESE_STAFF_ROLES = [
  "diocese_admin",
  "bishop",
  "diocese_secretary",
  "diocese_finance",
  "diocese_staff",
] as const;
export const DIOCESE_STAFF_STATUSES = ["active", "inactive", "suspended", "revoked"] as const;
export const DIOCESE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type DioceseStatus = (typeof DIOCESE_STATUSES)[number];
export type DioceseStaffRole = (typeof DIOCESE_STAFF_ROLES)[number];
export type DioceseStaffStatus = (typeof DIOCESE_STAFF_STATUSES)[number];

export type DioceseAssignmentSummary = {
  church_id: string;
  diocese_id: string;
  status: "active" | "inactive" | "ended";
};

export type DioceseNameSummary = {
  id: string;
  name: string;
};

export type ChurchNameSummary = {
  id: string;
  name: string;
};

export function makeDioceseSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function isValidDioceseRole(role: string): role is DioceseStaffRole {
  return DIOCESE_STAFF_ROLES.includes(role as DioceseStaffRole);
}

export function getActiveAssignment(assignments: ReadonlyArray<DioceseAssignmentSummary>, churchId: string) {
  return assignments.find((assignment) => assignment.church_id === churchId && assignment.status === "active") ?? null;
}

export function isParishAlreadyActiveElsewhere(
  assignments: ReadonlyArray<DioceseAssignmentSummary>,
  churchId: string,
  dioceseId: string,
) {
  const assignment = getActiveAssignment(assignments, churchId);
  return Boolean(assignment && assignment.diocese_id !== dioceseId);
}

export function describeParishAssignment(
  church: ChurchNameSummary,
  assignments: ReadonlyArray<DioceseAssignmentSummary>,
  dioceses: ReadonlyArray<DioceseNameSummary>,
) {
  const activeAssignment = getActiveAssignment(assignments, church.id);
  if (!activeAssignment) return "Not assigned";
  const diocese = dioceses.find((item) => item.id === activeAssignment.diocese_id);
  return diocese ? `Assigned to ${diocese.name}` : "Already assigned";
}

export function buildDeactivateParishPatch() {
  return { status: "ended" as const, ended_at: new Date().toISOString() };
}

export function buildDeactivateStaffPatch() {
  return { status: "revoked" as const };
}
