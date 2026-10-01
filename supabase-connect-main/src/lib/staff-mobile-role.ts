export type ProductionUserRole =
  | "super_admin"
  | "church_admin"
  | "secretary"
  | "pastor"
  | "priest"
  | "treasurer"
  | "finance"
  | "member";

export type StaffMobileWorkspace = "super_admin" | "admin" | "pastoral" | "finance" | "member";

const ROLE_PRIORITY: ReadonlyArray<{ workspace: StaffMobileWorkspace; roles: ProductionUserRole[] }> = [
  { workspace: "super_admin", roles: ["super_admin"] },
  { workspace: "admin", roles: ["church_admin", "secretary"] },
  { workspace: "pastoral", roles: ["pastor", "priest"] },
  { workspace: "finance", roles: ["treasurer", "finance"] },
  { workspace: "member", roles: ["member"] },
];

export function normalizeProductionRoles(roles: readonly unknown[]): ProductionUserRole[] {
  return [...new Set(roles
    .filter((role): role is string => typeof role === "string")
    .map((role) => role.trim().toLowerCase())
    .filter((role): role is ProductionUserRole => ROLE_PRIORITY.some((entry) => entry.roles.includes(role as ProductionUserRole))))]
    .sort();
}

export function hasUnsupportedProductionRole(roles: readonly unknown[]) {
  return roles.some((role) => typeof role !== "string" || normalizeProductionRoles([role]).length === 0);
}

export function resolveStaffMobileWorkspace(
  roles: readonly unknown[],
  isSuperAdmin = false,
): StaffMobileWorkspace | null {
  const normalized = normalizeProductionRoles(roles);
  if (isSuperAdmin && !normalized.includes("super_admin")) normalized.push("super_admin");
  for (const entry of ROLE_PRIORITY) {
    if (entry.roles.some((role) => normalized.includes(role))) return entry.workspace;
  }
  return roles.length === 0 ? "member" : null;
}

export function roleLabel(workspace: StaffMobileWorkspace) {
  return {
    super_admin: "Usimamizi wa mfumo",
    admin: "Uendeshaji wa parokia",
    pastoral: "Huduma ya kichungaji",
    finance: "Usimamizi wa fedha",
    member: "Mwanachama",
  }[workspace];
}
