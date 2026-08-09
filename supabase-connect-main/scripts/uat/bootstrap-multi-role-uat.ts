import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const KNOWN_STAGING_PROJECT_REF = "nunfrjcuimaytydnaqtt";
export const UAT_FIXTURE_MARKER = "kanisa-connect-multi-role-uat-v1";
export const UAT_EMAIL_DOMAIN = "@kanisaconnect.test";
export const CREDENTIALS_PATH = "evaluation/uat/.uat-credentials.local.json";
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type Role = "church_admin" | "pastor" | "secretary" | "treasurer" | "member";
type ChurchKey = "primary" | "expired" | "other";
type Mode = "seed" | "reset";

type Persona = {
  key: string;
  label: string;
  email: string;
  fullName: string;
  church: ChurchKey;
  roles: Role[];
  expectedWorkspace: string;
  expectedResult: string;
};

type ChurchFixture = {
  key: ChurchKey;
  name: string;
  slug: string;
  code: string;
  subscription: { plan: "pro"; status: "trial"; expiresInDays: number };
};

type GuardInput = {
  branch: string;
  supabaseUrl?: string;
  linkedProjectRef?: string;
  expectedProjectRef?: string;
  hasServiceRoleKey: boolean;
  serviceRoleClaim?: string;
  hasAnonKey: boolean;
  appEnv?: string;
};

type CredentialFile = {
  fixture: string;
  generated_at: string;
  accounts: Record<string, string>;
};

type PersonaResult = {
  persona: Persona;
  userId: string;
  password: string;
  passwordSource: string;
  churchId: string;
  actualRoles: string[];
  expectedMajorFeatures: string[];
  checks: Array<{ name: string; pass: boolean; detail: string }>;
};

export const CHURCHES: ChurchFixture[] = [
  {
    key: "primary",
    name: "Kanisa Connect UAT Parish",
    slug: "kanisa-connect-uat",
    code: "KCUAT-PRIMARY",
    subscription: { plan: "pro", status: "trial", expiresInDays: 45 },
  },
  {
    key: "expired",
    name: "Kanisa Connect UAT Expired Parish",
    slug: "kanisa-connect-uat-expired",
    code: "KCUAT-EXPIRED",
    subscription: { plan: "pro", status: "trial", expiresInDays: -7 },
  },
  {
    key: "other",
    name: "Kanisa Connect UAT Other Parish",
    slug: "kanisa-connect-uat-other",
    code: "KCUAT-OTHER",
    subscription: { plan: "pro", status: "trial", expiresInDays: 45 },
  },
];

export const PERSONAS: Persona[] = [
  { key: "admin", label: "Church Admin only", email: "uat.admin@kanisaconnect.test", fullName: "UAT Church Admin", church: "primary", roles: ["church_admin"], expectedWorkspace: "Church Operations", expectedResult: "Church Admin permissions only" },
  { key: "pastor", label: "Pastor only", email: "uat.pastor@kanisaconnect.test", fullName: "UAT Pastor", church: "primary", roles: ["pastor"], expectedWorkspace: "Pastoral Workspace", expectedResult: "Pastor permissions only" },
  { key: "secretary", label: "Secretary only", email: "uat.secretary@kanisaconnect.test", fullName: "UAT Secretary", church: "primary", roles: ["secretary"], expectedWorkspace: "Church Operations", expectedResult: "Secretary permissions only" },
  { key: "treasurer", label: "Treasurer only", email: "uat.treasurer@kanisaconnect.test", fullName: "UAT Treasurer", church: "primary", roles: ["treasurer"], expectedWorkspace: "Finance Workspace", expectedResult: "Treasurer permissions only" },
  { key: "admin_pastor", label: "Church Admin + Pastor", email: "uat.admin-pastor@kanisaconnect.test", fullName: "UAT Admin Pastor", church: "primary", roles: ["church_admin", "pastor"], expectedWorkspace: "Church Operations", expectedResult: "Union of Church Admin and Pastor permissions" },
  { key: "pastor_treasurer", label: "Pastor + Treasurer", email: "uat.pastor-treasurer@kanisaconnect.test", fullName: "UAT Pastor Treasurer", church: "primary", roles: ["pastor", "treasurer"], expectedWorkspace: "Pastoral Workspace", expectedResult: "Union of Pastor and Treasurer permissions" },
  { key: "secretary_treasurer", label: "Secretary + Treasurer", email: "uat.secretary-treasurer@kanisaconnect.test", fullName: "UAT Secretary Treasurer", church: "primary", roles: ["secretary", "treasurer"], expectedWorkspace: "Church Operations", expectedResult: "Union of Secretary and Treasurer permissions" },
  { key: "multi_role", label: "Church Admin + Pastor + Treasurer", email: "uat.multi-role@kanisaconnect.test", fullName: "UAT Multi Role", church: "primary", roles: ["church_admin", "pastor", "treasurer"], expectedWorkspace: "Church Operations", expectedResult: "Union of Church Admin, Pastor, and Treasurer permissions" },
  { key: "member", label: "Member only", email: "uat.member@kanisaconnect.test", fullName: "UAT Member", church: "primary", roles: ["member"], expectedWorkspace: "Member Portal", expectedResult: "Member permissions only" },
  { key: "no_role", label: "No staff role", email: "uat.no-role@kanisaconnect.test", fullName: "UAT No Role", church: "primary", roles: [], expectedWorkspace: "Member Portal", expectedResult: "Active membership only; no staff permission" },
  { key: "expired_admin", label: "Expired subscription admin", email: "uat.expired-admin@kanisaconnect.test", fullName: "UAT Expired Admin", church: "expired", roles: ["church_admin"], expectedWorkspace: "Church Operations", expectedResult: "Denied features that require a current subscription" },
  { key: "other_admin", label: "Other church admin", email: "uat.other-church-admin@kanisaconnect.test", fullName: "UAT Other Church Admin", church: "other", roles: ["church_admin"], expectedWorkspace: "Church Operations", expectedResult: "Other-church access only; primary church denied" },
];

const ROLE_ORDER: Role[] = ["church_admin", "pastor", "secretary", "treasurer", "member"];
const PRIMARY_FEATURE_BY_ROLE: Partial<Record<Role, string>> = {
  church_admin: "members",
  pastor: "mass_intentions",
  secretary: "members",
  treasurer: "contributions",
  member: "events",
};

export function isManagedEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return !!normalized && PERSONAS.some((persona) => persona.email === normalized);
}

export function getProjectRefFromUrl(rawUrl: string | undefined) {
  if (!rawUrl) return null;
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    const suffix = ".supabase.co";
    return hostname.endsWith(suffix) ? hostname.slice(0, -suffix.length) : null;
  } catch {
    return null;
  }
}

export function assertStagingGuard(input: GuardInput) {
  const errors: string[] = [];
  const urlRef = getProjectRefFromUrl(input.supabaseUrl);
  const expected = input.expectedProjectRef || KNOWN_STAGING_PROJECT_REF;
  if (input.branch !== "staging") errors.push(`Git branch must be staging; received ${input.branch || "unset"}`);
  if (input.appEnv !== "staging") errors.push(`APP_ENV/VITE_APP_ENV must be staging; received ${input.appEnv || "unset"}`);
  if (!input.supabaseUrl || urlRef !== KNOWN_STAGING_PROJECT_REF) errors.push("Supabase URL is not the known Kanisa Connect staging project");
  if (expected !== KNOWN_STAGING_PROJECT_REF) errors.push("Expected project reference does not match the known staging project");
  if (input.linkedProjectRef !== KNOWN_STAGING_PROJECT_REF) errors.push("Linked Supabase project is not the known staging project");
  if (!input.hasServiceRoleKey) errors.push("SUPABASE_SERVICE_ROLE_KEY is required");
  if (input.serviceRoleClaim !== "service_role") errors.push("Configured admin credential is not a Supabase service_role token");
  if (!input.hasAnonKey) errors.push("VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY is required for authenticated verification");
  if (errors.length) throw new Error(`UAT staging safety guard failed:\n- ${errors.join("\n- ")}`);
}

export function compatibilityRole(roles: readonly Role[]) {
  return ROLE_ORDER.find((role) => roles.includes(role)) ?? "member";
}

export function permissionSeedFor(role: Role, feature: { key: string; member_available: boolean; staff_available: boolean }) {
  const allowed = (action: "view" | "create" | "edit" | "delete" | "approve" | "publish" | "manage") => {
    if (role === "church_admin") return true;
    if (action === "view") return role === "member" ? feature.member_available : feature.staff_available;
    if (role === "member" && action === "create" && new Set(["prayer_requests", "mass_intentions", "event_requests", "community_help", "give", "contributions", "pledges", "events", "ministries"]).has(feature.key)) return true;
    if (role === "member" && action === "edit" && new Set(["prayer_requests", "mass_intentions", "community_help", "pledges", "events"]).has(feature.key)) return true;
    if (role === "member" && action === "delete" && new Set(["prayer_requests", "ministries"]).has(feature.key)) return true;
    if (role === "pastor" && (action === "create" || action === "edit") && new Set(["prayer_requests", "mass_intentions", "sacraments", "announcements", "community_help", "sermons"]).has(feature.key)) return true;
    if (role === "pastor" && action === "delete" && feature.key === "sermons") return true;
    if (role === "pastor" && action === "approve" && new Set(["prayer_requests", "mass_intentions", "sacraments", "community_help"]).has(feature.key)) return true;
    if (role === "pastor" && action === "publish" && new Set(["announcements", "sermons"]).has(feature.key)) return true;
    if (role === "pastor" && action === "manage" && feature.key === "mass_intentions") return true;
    if (role === "secretary" && (action === "create" || action === "edit") && new Set(["members", "families", "communities", "ministries", "events", "event_requests", "announcements", "mass_intentions", "notifications", "channels", "sermons"]).has(feature.key)) return true;
    if (role === "secretary" && action === "delete" && new Set(["events", "announcements", "sermons"]).has(feature.key)) return true;
    if (role === "secretary" && action === "approve" && new Set(["events", "event_requests"]).has(feature.key)) return true;
    if (role === "secretary" && action === "publish" && new Set(["events", "announcements", "notifications"]).has(feature.key)) return true;
    if (role === "secretary" && action === "manage" && feature.key === "events") return true;
    if (role === "treasurer" && (action === "create" || action === "edit") && new Set(["contributions", "pledges", "reports", "finance_intelligence"]).has(feature.key)) return true;
    if (role === "treasurer" && action === "approve" && new Set(["contributions", "pledges"]).has(feature.key)) return true;
    if (role === "treasurer" && action === "manage" && new Set(["reports", "finance_intelligence"]).has(feature.key)) return true;
    return false;
  };
  return {
    can_view: allowed("view"),
    can_create: allowed("create"),
    can_edit: allowed("edit"),
    can_delete: allowed("delete"),
    can_approve: allowed("approve"),
    can_publish: allowed("publish"),
    can_manage: allowed("manage"),
  };
}

function loadStagingEnvironment() {
  const envPath = path.resolve(PROJECT_ROOT, ".env.staging.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function decodeJwtRole(token: string | undefined) {
  if (!token) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { role?: string };
    return payload.role;
  } catch {
    return undefined;
  }
}

export function resolveRepositoryRoot(projectRoot = PROJECT_ROOT) {
  let candidate = path.resolve(projectRoot);
  while (!existsSync(path.join(candidate, ".git"))) {
    const parent = path.dirname(candidate);
    if (parent === candidate) throw new Error(`Unable to locate the Git repository containing ${projectRoot}`);
    candidate = parent;
  }
  try {
    const repositoryRoot = execFileSync("git", ["-c", `safe.directory=${candidate}`, "rev-parse", "--show-toplevel"], {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
    if (!repositoryRoot) throw new Error("Git returned an empty repository root");
    return repositoryRoot;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`Unable to resolve the Git repository containing ${projectRoot}${detail}`);
  }
}

function currentBranch() {
  const repositoryRoot = resolveRepositoryRoot();
  return execFileSync("git", ["branch", "--show-current"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
}

function linkedProjectRef() {
  const refPath = path.resolve(PROJECT_ROOT, "supabase/.temp/project-ref");
  return existsSync(refPath) ? readFileSync(refPath, "utf8").trim() : "";
}

function securePassword() {
  return `Uat!${randomBytes(18).toString("base64url")}9a`;
}

function loadCredentials(): { file: CredentialFile; source: string } {
  const absolutePath = path.resolve(PROJECT_ROOT, CREDENTIALS_PATH);
  const shared = process.env.UAT_TEST_PASSWORD;
  let file: CredentialFile = { fixture: UAT_FIXTURE_MARKER, generated_at: new Date().toISOString(), accounts: {} };
  if (existsSync(absolutePath)) {
    file = JSON.parse(readFileSync(absolutePath, "utf8")) as CredentialFile;
    if (file.fixture !== UAT_FIXTURE_MARKER) throw new Error(`Unexpected credentials fixture marker in ${CREDENTIALS_PATH}`);
  }
  for (const persona of PERSONAS) file.accounts[persona.email] = shared || file.accounts[persona.email] || securePassword();
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(file, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return { file, source: shared ? "UAT_TEST_PASSWORD" : CREDENTIALS_PATH };
}

async function listAllUsers(admin: SupabaseClient) {
  const users: User[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function ensureAuthUsers(admin: SupabaseClient, credentials: CredentialFile) {
  const existing = await listAllUsers(admin);
  const result = new Map<string, User>();
  for (const persona of PERSONAS) {
    const current = existing.find((user) => user.email?.toLowerCase() === persona.email);
    const attributes = {
      email: persona.email,
      password: credentials.accounts[persona.email],
      email_confirm: true,
      user_metadata: { full_name: persona.fullName, staging: true, uat_fixture: UAT_FIXTURE_MARKER, persona: persona.key, roles: persona.roles },
      app_metadata: { uat_fixture: UAT_FIXTURE_MARKER },
    };
    const response = current
      ? await admin.auth.admin.updateUserById(current.id, attributes)
      : await admin.auth.admin.createUser(attributes);
    if (response.error) throw response.error;
    result.set(persona.key, response.data.user);
  }
  return result;
}

async function findRows(client: SupabaseClient, table: string, filters: Record<string, unknown>, columns = "*") {
  let query = client.from(table).select(columns);
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => Object.fromEntries(Object.entries(row)));
}

async function ensureChurches(admin: SupabaseClient, users: Map<string, User>) {
  const result = new Map<ChurchKey, string>();
  const creatorId = users.get("admin")?.id;
  for (const church of CHURCHES) {
    const existing = await findRows(admin, "churches", { slug: church.slug }, "id,name,slug,code");
    if (existing.length > 1) throw new Error(`Multiple churches use reserved UAT slug ${church.slug}`);
    if (existing[0] && (existing[0].name !== church.name || existing[0].code !== church.code)) {
      throw new Error(`Reserved UAT slug ${church.slug} belongs to an unexpected church; refusing to modify it`);
    }
    const payload = { name: church.name, slug: church.slug, code: church.code, email: `office.${church.key}@kanisaconnect.test`, address: "Staging UAT fixture", created_by: creatorId };
    if (existing[0]) {
      const { error } = await admin.from("churches").update(payload).eq("id", existing[0].id);
      if (error) throw error;
      result.set(church.key, String(existing[0].id));
    } else {
      const { data, error } = await admin.from("churches").insert(payload).select("id");
      if (error) throw error;
      const id = data?.[0]?.id;
      if (!id) throw new Error(`Church creation returned no ID for ${church.slug}`);
      result.set(church.key, id);
    }
  }
  return result;
}

async function ensureProfilesAndMemberships(admin: SupabaseClient, users: Map<string, User>, churches: Map<ChurchKey, string>) {
  for (const persona of PERSONAS) {
    const user = users.get(persona.key);
    const churchId = churches.get(persona.church);
    if (!user || !churchId) throw new Error(`Missing fixture dependency for ${persona.email}`);
    const profile = { id: user.id, full_name: persona.fullName, role: compatibilityRole(persona.roles), church_id: churchId };
    const existingProfiles = await findRows(admin, "profiles", { id: user.id }, "id,full_name,role,church_id");
    const profileMatches = existingProfiles.length === 1
      && existingProfiles[0].full_name === profile.full_name
      && existingProfiles[0].role === profile.role
      && existingProfiles[0].church_id === profile.church_id;
    if (!profileMatches) {
      const { error: profileError } = await admin.from("profiles").upsert(profile, { onConflict: "id" });
      if (profileError) throw profileError;
    }
    // The current schema enforces one linked member row per Auth user globally.
    // These exact managed personas may predate this fixture in another staging
    // church, so move only their own row into the reserved UAT church.
    const memberships = await findRows(admin, "members", { user_id: user.id }, "id,church_id,full_name,email,status");
    const memberPayload = { full_name: persona.fullName, email: persona.email, user_id: user.id, church_id: churchId, status: "active" };
    if (memberships[0]) {
      const membershipMatches = memberships[0].church_id === churchId
        && memberships[0].full_name === persona.fullName
        && String(memberships[0].email).toLowerCase() === persona.email
        && memberships[0].status === "active";
      if (!membershipMatches) {
        const { error } = await admin.from("members").update(memberPayload).eq("id", memberships[0].id);
        if (error) throw error;
      }
      if (memberships.length > 1) {
        const duplicateIds = memberships.slice(1).map((row) => row.id);
        const { error: duplicateError } = await admin.from("members").delete().in("id", duplicateIds);
        if (duplicateError) throw duplicateError;
      }
    } else {
      const { error } = await admin.from("members").insert(memberPayload);
      if (error) throw error;
    }
  }
}

async function ensureSubscriptions(admin: SupabaseClient, churches: Map<ChurchKey, string>) {
  for (const church of CHURCHES) {
    const churchId = churches.get(church.key)!;
    const expiresAt = new Date(Date.now() + church.subscription.expiresInDays * 86_400_000).toISOString();
    const existing = await findRows(admin, "subscriptions", { church_id: churchId }, "id,started_at");
    const payload = { church_id: churchId, plan: church.subscription.plan, status: church.subscription.status, started_at: new Date().toISOString(), expires_at: expiresAt, updated_at: new Date().toISOString() };
    if (existing[0]) {
      const keep = existing.sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0];
      const { error } = await admin.from("subscriptions").update(payload).eq("id", keep.id);
      if (error) throw error;
      const duplicates = existing.filter((row) => row.id !== keep.id).map((row) => row.id);
      if (duplicates.length) {
        const { error: duplicateError } = await admin.from("subscriptions").delete().in("id", duplicates);
        if (duplicateError) throw duplicateError;
      }
    } else {
      const { error } = await admin.from("subscriptions").insert(payload);
      if (error) throw error;
    }
  }
}

async function ensureFeaturesAndPermissions(admin: SupabaseClient, churches: Map<ChurchKey, string>) {
  const { data: features, error } = await admin.from("platform_features").select("id,key,member_available,staff_available,globally_enabled,globally_locked,is_mandatory");
  if (error) throw error;
  if (!features?.length) throw new Error("No platform feature catalog is available");
  for (const church of CHURCHES) {
    const churchId = churches.get(church.key)!;
    const churchFeatures = features.map((feature) => ({
      church_id: churchId,
      feature_id: feature.id,
      enabled: true,
      locked: feature.is_mandatory === true,
      enabled_at: new Date().toISOString(),
    }));
    const { error: featureError } = await admin.from("church_features").upsert(churchFeatures, { onConflict: "church_id,feature_id" });
    if (featureError) throw featureError;
    const permissionRows = ROLE_ORDER.flatMap((role) => features.flatMap((feature) => {
      const grants = permissionSeedFor(role, feature);
      return grants ? [{ church_id: churchId, role, feature_id: feature.id, ...grants }] : [];
    }));
    const { error: permissionError } = await admin.from("church_role_permissions").upsert(permissionRows, { onConflict: "church_id,role,feature_id" });
    if (permissionError) throw permissionError;
  }
  return features;
}

async function ensureRoles(admin: SupabaseClient, users: Map<string, User>, churches: Map<ChurchKey, string>) {
  for (const persona of PERSONAS) {
    const userId = users.get(persona.key)!.id;
    const churchId = churches.get(persona.church)!;
    if (persona.roles.length) {
      const rows = persona.roles.map((role) => ({ user_id: userId, church_id: churchId, role }));
      const { error } = await admin.from("user_roles").upsert(rows, { onConflict: "user_id,church_id,role" });
      if (error) throw error;
    }
    const existing = await findRows(admin, "user_roles", { user_id: userId, church_id: churchId }, "id,role");
    const extras = existing.filter((row) => !persona.roles.includes(row.role as Role)).map((row) => row.id);
    if (extras.length) {
      const { error } = await admin.from("user_roles").delete().in("id", extras);
      if (error) throw error;
    }
  }
}

function representativeFeature(persona: Persona) {
  return persona.roles.map((role) => PRIMARY_FEATURE_BY_ROLE[role]).find(Boolean) || "members";
}

async function verifyPersona(
  admin: SupabaseClient,
  anonKey: string,
  supabaseUrl: string,
  persona: Persona,
  user: User,
  password: string,
  passwordSource: string,
  churches: Map<ChurchKey, string>,
) {
  const churchId = churches.get(persona.church)!;
  const checks: PersonaResult["checks"] = [];
  const roles = await findRows(admin, "user_roles", { user_id: user.id, church_id: churchId }, "role");
  const actualRoles = roles.map((row) => String(row.role)).sort();
  checks.push({ name: "roles", pass: JSON.stringify(actualRoles) === JSON.stringify([...persona.roles].sort()), detail: actualRoles.join(", ") || "none" });
  const profiles = await findRows(admin, "profiles", { id: user.id }, "id,church_id,role");
  checks.push({ name: "profile", pass: profiles.length === 1 && profiles[0].church_id === churchId, detail: `${profiles.length} matching profile` });
  const memberships = await findRows(admin, "members", { user_id: user.id, church_id: churchId }, "id,status");
  checks.push({ name: "membership", pass: memberships.length === 1 && memberships[0].status === "active", detail: `${memberships.length} active membership row(s)` });

  const loginClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: login, error: loginError } = await loginClient.auth.signInWithPassword({ email: persona.email, password });
  checks.push({ name: "login", pass: !loginError && !!login.user, detail: loginError?.message || "authenticated" });
  const expectedFeature = representativeFeature(persona);
  let representativeAllowed = false;
  if (!loginError && login.user) {
    const { data, error } = await loginClient.rpc("has_church_feature_permission", { _user_id: login.user.id, _church_id: churchId, _feature_key: expectedFeature, _action: "view" });
    representativeAllowed = data === true && !error;
    const expectsAllowed = persona.church !== "expired" && (persona.roles.length > 0 || expectedFeature !== "members");
    checks.push({ name: `permission:${expectedFeature}`, pass: expectsAllowed ? representativeAllowed : !representativeAllowed, detail: error?.message || String(data) });
    if (persona.key === "other_admin") {
      const { data: crossData, error: crossError } = await loginClient.rpc("has_church_feature_permission", { _user_id: login.user.id, _church_id: churches.get("primary")!, _feature_key: "members", _action: "view" });
      checks.push({ name: "cross-tenant denial", pass: !crossError && crossData === false, detail: crossError?.message || String(crossData) });
    }
    await loginClient.auth.signOut();
  }

  const { data: permissionRows, error: permissionError } = await admin.from("church_role_permissions").select("role,platform_features!inner(key)").eq("church_id", churchId).in("role", persona.roles.length ? persona.roles : ["member"]).eq("can_view", true);
  if (permissionError) throw permissionError;
  const expectedMajorFeatures = [...new Set((permissionRows ?? []).map((row) => String((row.platform_features as unknown as { key: string }).key)))].sort();
  return { persona, userId: user.id, password, passwordSource, churchId, actualRoles, expectedMajorFeatures, checks } satisfies PersonaResult;
}

async function verifyAll(admin: SupabaseClient, anonKey: string, supabaseUrl: string, users: Map<string, User>, credentials: CredentialFile, passwordSource: string, churches: Map<ChurchKey, string>) {
  const results: PersonaResult[] = [];
  for (const persona of PERSONAS) results.push(await verifyPersona(admin, anonKey, supabaseUrl, persona, users.get(persona.key)!, credentials.accounts[persona.email], passwordSource, churches));
  const churchIds = [...churches.values()];
  const { data: duplicates, error: duplicateError } = await admin.from("user_roles").select("user_id,church_id,role").in("church_id", churchIds);
  if (duplicateError) throw duplicateError;
  const tuples = (duplicates ?? []).map((row) => `${row.user_id}:${row.church_id}:${row.role}`);
  if (new Set(tuples).size !== tuples.length) throw new Error("Duplicate UAT user/church/role tuple detected");
  for (const [key, churchId] of churches) {
    const admins = await findRows(admin, "user_roles", { church_id: churchId, role: "church_admin" }, "id");
    if (!admins.length) throw new Error(`UAT church ${key} has no Church Admin`);
  }
  return results;
}

function printResults(results: PersonaResult[], churches: Map<ChurchKey, string>) {
  const churchNames = new Map(CHURCHES.map((church) => [church.key, church.name]));
  console.table(results.map((result) => ({
    persona: result.persona.label,
    email: result.persona.email,
    password: result.password,
    password_source: result.passwordSource,
    church: churchNames.get(result.persona.church),
    roles: result.actualRoles.join(", ") || "none (active member only)",
    expected_workspace: result.persona.expectedWorkspace,
    expected_result: result.persona.expectedResult,
    subscription: CHURCHES.find((church) => church.key === result.persona.church)!.subscription.expiresInDays > 0 ? "pro trial active" : "pro trial expired",
    verification: result.checks.every((check) => check.pass) ? "PASS" : "FAIL",
  })));
  for (const result of results) {
    const status = result.checks.every((check) => check.pass) ? "PASS" : "FAIL";
    console.log(`${status} ${result.persona.label}: ${result.checks.map((check) => `${check.name}=${check.pass ? "PASS" : "FAIL"}`).join("; ")}`);
  }
  console.log(`UAT churches: ${[...churches.entries()].map(([key, id]) => `${key}=${id}`).join(", ")}`);
}

async function resetFixtures(admin: SupabaseClient) {
  const allUsers = await listAllUsers(admin);
  const users = allUsers.filter((user) => isManagedEmail(user.email) && user.user_metadata?.uat_fixture === UAT_FIXTURE_MARKER);
  const userByEmail = new Map(users.map((user) => [user.email!.toLowerCase(), user]));
  const churchRows = await Promise.all(CHURCHES.map(async (church) => (await findRows(admin, "churches", { slug: church.slug }, "id,slug,code,name"))[0]));
  const churches = churchRows.filter(Boolean);
  for (const church of churches) {
    const fixture = CHURCHES.find((item) => item.slug === church.slug)!;
    if (church.code !== fixture.code || church.name !== fixture.name) throw new Error(`Reset refused: reserved slug ${fixture.slug} does not match the UAT fixture identity`);
  }

  const anchors = new Set(["uat.admin@kanisaconnect.test", "uat.expired-admin@kanisaconnect.test", "uat.other-church-admin@kanisaconnect.test"]);
  for (const church of churches) {
    const fixture = CHURCHES.find((item) => item.slug === church.slug)!;
    const anchorEmail = fixture.key === "primary" ? "uat.admin@kanisaconnect.test" : fixture.key === "expired" ? "uat.expired-admin@kanisaconnect.test" : "uat.other-church-admin@kanisaconnect.test";
    const anchor = userByEmail.get(anchorEmail);
    if (!anchor) throw new Error(`Reset refused: ${anchorEmail} must remain to preserve the final Church Admin invariant`);
    const anchorRole = await findRows(admin, "user_roles", { user_id: anchor.id, church_id: church.id, role: "church_admin" }, "id");
    if (anchorRole.length !== 1) throw new Error(`Reset refused: ${anchorEmail} does not have exactly one Church Admin assignment`);

    const roles = await findRows(admin, "user_roles", { church_id: church.id }, "id,user_id,role");
    const removableRoleIds = roles.filter((row) => row.id !== anchorRole[0].id && users.some((user) => user.id === row.user_id)).map((row) => row.id);
    if (removableRoleIds.length) {
      const { error } = await admin.from("user_roles").delete().in("id", removableRoleIds);
      if (error) throw error;
    }
    const removableUserIds = users.filter((user) => !anchors.has(user.email!.toLowerCase())).map((user) => user.id);
    if (removableUserIds.length) {
      const { error: memberError } = await admin.from("members").delete().eq("church_id", church.id).in("user_id", removableUserIds);
      if (memberError) throw memberError;
    }
  }
  for (const user of users) {
    if (anchors.has(user.email!.toLowerCase())) continue;
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.warn(`[uat] Retained ${user.email}: Auth deletion is blocked by non-UAT database references (${error.message})`);
    }
  }
  console.log(`UAT reset complete. Retained ${anchors.size} invariant anchor accounts, the three dedicated UAT churches, and their protected feature/subscription configuration; removed only managed non-anchor identity, membership, and role fixtures.`);
}

async function main() {
  loadStagingEnvironment();
  const mode: Mode = process.argv.includes("--reset") ? "reset" : "seed";
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  assertStagingGuard({
    branch: currentBranch(),
    supabaseUrl,
    linkedProjectRef: linkedProjectRef(),
    expectedProjectRef: process.env.VITE_EXPECTED_SUPABASE_PROJECT_REF || KNOWN_STAGING_PROJECT_REF,
    hasServiceRoleKey: !!serviceRoleKey,
    serviceRoleClaim: decodeJwtRole(serviceRoleKey),
    hasAnonKey: !!anonKey,
    appEnv: process.env.APP_ENV || process.env.VITE_APP_ENV,
  });
  const admin = createClient(supabaseUrl!, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  if (mode === "reset") {
    console.log("[uat] Resetting controlled fixtures");
    await resetFixtures(admin);
    return;
  }
  console.log("[uat] Loading local credentials");
  const { file: credentials, source } = loadCredentials();
  console.log("[uat] Ensuring Auth users");
  const users = await ensureAuthUsers(admin, credentials);
  console.log("[uat] Ensuring dedicated churches");
  const churches = await ensureChurches(admin, users);
  console.log("[uat] Ensuring profiles and memberships");
  await ensureProfilesAndMemberships(admin, users, churches);
  console.log("[uat] Ensuring subscriptions");
  await ensureSubscriptions(admin, churches);
  console.log("[uat] Ensuring features and reviewed permission seeds");
  await ensureFeaturesAndPermissions(admin, churches);
  console.log("[uat] Ensuring one row per role assignment");
  await ensureRoles(admin, users, churches);
  console.log("[uat] Verifying Auth, tenant, subscription, and effective permissions");
  const results = await verifyAll(admin, anonKey!, supabaseUrl!, users, credentials, source, churches);
  printResults(results, churches);
  if (results.some((result) => result.checks.some((check) => !check.pass))) process.exitCode = 1;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) main().catch((error) => {
  if (error instanceof Error) console.error(error.message);
  else {
    try { console.error(JSON.stringify(error, null, 2)); }
    catch { console.error(String(error)); }
  }
  process.exitCode = 1;
});
