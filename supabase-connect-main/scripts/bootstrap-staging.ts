import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import * as XLSX from "xlsx";

type AppRole = "super_admin" | "church_admin" | "member";
type Action = "created" | "updated" | "skipped" | "failed";
type HealthStatus = "PASS" | "FAIL" | "SKIP";

type BootstrapUser = {
  key: string;
  label: string;
  email: string;
  password: string;
  role: AppRole;
  fullName: string;
  phone: string;
};

type BootstrapMember = {
  id: string;
  email: string;
  full_name: string;
  user_id?: string | null;
};

type Counters = Record<Action, number>;

type HealthCheck = {
  name: string;
  status: HealthStatus;
  message: string;
};

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type Report = {
  timestamp: string;
  environment: string;
  mode: "seed" | "reset" | "dry-run";
  duration_ms: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  warnings: string[];
  errors: string[];
  users: Array<{ label: string; email: string; role: AppRole; id?: string; action?: Action }>;
  church: { id?: string; name: string; code: string; action?: Action };
  saint_count: number;
  cms_prayer_count: number;
  cms_daily_reading_count: number;
  contribution_count: number;
  attendance_count: number;
  pledge_count: number;
  ministry_count: number;
  channel_count: number;
  prayer_request_count: number;
  mass_intention_count: number;
  notification_count: number;
  targeted_event_count: number;
  import_summary: Record<string, unknown>;
  health_checks: HealthCheck[];
};

const args = new Set(process.argv.slice(2));
const isReset = args.has("--reset");
const isDryRun = args.has("--dry-run");
const mode: Report["mode"] = isReset ? "reset" : isDryRun ? "dry-run" : "seed";

loadEnvFile();

const APP_ENV = process.env.APP_ENV ?? process.env.VITE_APP_ENV;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SERVICE_ROLE_KEY;
const STAGING_APP_URL = process.env.STAGING_APP_URL ?? "http://localhost:4173";

const DEMO_CHURCH = {
  name: "Demo Catholic Parish",
  slug: "demo-catholic-parish",
  code: "DEMO-PARISH",
  email: "office@demo-catholic-parish.test",
  phone: "+255700000100",
  address: "Staging Avenue, Demo City",
  status: "active",
};

const USERS: BootstrapUser[] = [
  {
    key: "super_admin",
    label: "Super Admin",
    email: "uat.superadmin@kanisaconnect.test",
    password: "StagingSuperAdmin#2026",
    role: "super_admin",
    fullName: "UAT Super Admin",
    phone: "+255700000001",
  },
  {
    key: "church_admin",
    label: "Church Admin",
    email: "uat.churchadmin@kanisaconnect.test",
    password: "StagingChurchAdmin#2026",
    role: "church_admin",
    fullName: "UAT Church Admin",
    phone: "+255700000002",
  },
  {
    key: "member",
    label: "Member",
    email: "uat.member@kanisaconnect.test",
    password: "StagingMember#2026",
    role: "member",
    fullName: "UAT Member",
    phone: "+255700000003",
  },
  {
    key: "choir_member",
    label: "Choir Member",
    email: "uat.choir.member@kanisaconnect.test",
    password: "StagingChoirMember#2026",
    role: "member",
    fullName: "UAT Choir Member",
    phone: "+255700000005",
  },
  {
    key: "youth_member",
    label: "Youth Member",
    email: "uat.youth.member@kanisaconnect.test",
    password: "StagingYouthMember#2026",
    role: "member",
    fullName: "UAT Youth Member",
    phone: "+255700000006",
  },
  {
    key: "general_member",
    label: "General Member",
    email: "uat.general.member@kanisaconnect.test",
    password: "StagingGeneralMember#2026",
    role: "member",
    fullName: "UAT General Member",
    phone: "+255700000007",
  },
  {
    key: "multi_group_member",
    label: "Multi-Group Member",
    email: "uat.multigroup.member@kanisaconnect.test",
    password: "StagingMultiGroupMember#2026",
    role: "member",
    fullName: "UAT Multi-Group Member",
    phone: "+255700000008",
  },
];

const INVITATION_TOKEN = "uat-member-invite-demo-catholic-parish";
const SEEDED_MEMBER_EMAILS = [
  "uat.churchadmin@kanisaconnect.test",
  "uat.member@kanisaconnect.test",
  "uat.choir.member@kanisaconnect.test",
  "uat.youth.member@kanisaconnect.test",
  "uat.general.member@kanisaconnect.test",
  "uat.multigroup.member@kanisaconnect.test",
  "maria.demo@kanisaconnect.test",
];
const SEEDED_CONTRIBUTION_REFS = [
  "STAGING-UAT-CONTRIB-001",
  "STAGING-UAT-CONTRIB-002",
  "STAGING-UAT-CONTRIB-003",
];
const SEEDED_EVENT_TITLES = ["UAT Sunday Service", "UAT Weekday Service"];
const SEEDED_TARGETED_EVENT_TITLES = [
  "UAT Choir Rehearsal",
  "UAT Youth Retreat",
  "UAT Choir + Youth Meeting",
  "UAT Parish Meeting",
  "UAT Public Parish Event",
];
const SEEDED_MASS_TITLES = ["Weekend Mass", "Weekday Mass"];
const SEEDED_ANNOUNCEMENT_TITLES = ["Welcome to Demo Catholic Parish", "Weekend Mass Reminder"];
const SEEDED_NOTIFICATION_TITLES = ["Birthday Blessings", "Contribution Reminder", "Weekend Mass RSVP"];
const SEEDED_CMS_PRAYER_SLUG = "uat-sala-ya-asubuhi";
const SEEDED_CMS_DAILY_READING_CELEBRATIONS = [
  "Staging UAT Reading - Yesterday",
  "Staging UAT Reading - Today",
  "Staging UAT Reading - Tomorrow",
];
const SEEDED_COMMUNITY_NAME = "UAT St. Monica Community";
const SEEDED_MINISTRY_NAME = "UAT Choir Ministry";
const SEEDED_TARGETED_MINISTRIES = {
  choir: "Choir",
  youth: "Youth Ministry",
};
const SEEDED_CHANNEL_NAME = "UAT St. Monica Community Channel";
const SEEDED_CHANNEL_MESSAGE = "Karibu kwenye kituo cha mawasiliano cha UAT kwa waumini.";
const SEEDED_PRAYER_REQUEST_TEXT = "Please pray for the Demo Catholic Parish UAT family.";
const SEEDED_PRAYER_COMMENT = "Tunaungana nawe katika sala wakati wa UAT.";
const SEEDED_MASS_INTENTION_MESSAGE = "Thanksgiving for the Demo Catholic Parish UAT launch.";

const startedAt = Date.now();
const now = new Date();
const today = new Date(now);
const yesterday = addDays(today, -1);
const tomorrow = addDays(today, 1);
const saturday = nextWeekday(today, 6);
const weekdayMassDate = addDays(today, 1);

const counters: Counters = { created: 0, updated: 0, skipped: 0, failed: 0 };
const warnings: string[] = [];
const errors: string[] = [];
const healthChecks: HealthCheck[] = [];
const columnSupportCache = new Map<string, boolean>();

const report: Report = {
  timestamp: new Date().toISOString(),
  environment: APP_ENV ?? "unset",
  mode,
  duration_ms: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  warnings,
  errors,
  users: USERS.map((user) => ({ label: user.label, email: user.email, role: user.role })),
  church: { name: DEMO_CHURCH.name, code: DEMO_CHURCH.code },
  saint_count: 0,
  cms_prayer_count: 0,
  cms_daily_reading_count: 0,
  contribution_count: 0,
  attendance_count: 0,
  pledge_count: 0,
  ministry_count: 0,
  channel_count: 0,
  prayer_request_count: 0,
  mass_intention_count: 0,
  notification_count: 0,
  targeted_event_count: 0,
  import_summary: {},
  health_checks: healthChecks,
};

validateEnvironment();

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function nextWeekday(date: Date, weekday: number) {
  const copy = new Date(date);
  const delta = (weekday + 7 - copy.getDay()) % 7 || 7;
  copy.setDate(copy.getDate() + delta);
  return copy;
}

function loadEnvFile() {
  const envPath = path.resolve(".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isoAt(date: Date, hour: number, minute = 0) {
  const copy = new Date(date);
  copy.setHours(hour, minute, 0, 0);
  return copy.toISOString();
}

function elapsed() {
  return `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
}

function logStep(step: string, message: string) {
  console.log(JSON.stringify({ level: "info", elapsed: elapsed(), step, message }));
}

function logWarn(step: string, message: string) {
  warnings.push(`${step}: ${message}`);
  console.warn(JSON.stringify({ level: "warn", elapsed: elapsed(), step, message }));
}

function formatError(error: unknown) {
  if (error && typeof error === "object") {
    const supabaseError = error as SupabaseLikeError;
    const parts = [
      supabaseError.code ? `Code: ${supabaseError.code}` : null,
      supabaseError.message ? `Message: ${supabaseError.message}` : null,
      supabaseError.details ? `Details: ${supabaseError.details}` : null,
      supabaseError.hint ? `Hint: ${supabaseError.hint}` : null,
    ].filter(Boolean);

    if (parts.length) return parts.join(" | ");
  }

  return error instanceof Error ? error.message : String(error);
}

function logError(step: string, error: unknown) {
  const message = formatError(error);
  errors.push(`${step}: ${message}`);
  console.error(JSON.stringify({ level: "error", elapsed: elapsed(), step, message }));
}

function record(action: Action, entity: string, message?: string) {
  counters[action] += 1;
  if (message) {
    const level = action === "failed" ? "error" : "info";
    console.log(JSON.stringify({ level, elapsed: elapsed(), action, entity, message }));
  }
}

function validateEnvironment() {
  const missing: string[] = [];
  if (APP_ENV !== "staging") missing.push(`APP_ENV must be "staging" but is "${APP_ENV ?? "unset"}"`);
  if (!SUPABASE_URL) missing.push("SUPABASE_URL is required");
  if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY is required");

  if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("VITE_SUPABASE_SERVICE_ROLE_KEY must never be set; service-role keys must not be exposed to frontend env vars");
  }

  if (missing.length) {
    for (const item of missing) console.error(JSON.stringify({ level: "error", step: "environment", message: item }));
    process.exit(1);
  }
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function nullableText(value: unknown) {
  const normalized = normalizeCell(value);
  return normalized ? normalized : null;
}

function nullableNumber(value: unknown) {
  const normalized = normalizeCell(value);
  return normalized ? Number(normalized) : null;
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = normalizeCell(value).toLowerCase();
  if (!normalized) return fallback;
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  return fallback;
}

function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseTags(value: unknown) {
  if (Array.isArray(value)) return value.map((tag) => normalizeTag(normalizeCell(tag))).filter(Boolean);
  return normalizeCell(value)
    .split(/[;,]/)
    .map(normalizeTag)
    .filter(Boolean);
}

function saintRecordFromRow(row: Record<string, unknown>) {
  return {
    slug: normalizeCell(row.slug),
    name: normalizeCell(row.name),
    title: nullableText(row.title),
    country: nullableText(row.country),
    birth_year: nullableNumber(row.birth_year),
    death_year: nullableNumber(row.death_year),
    feast_month: Number(normalizeCell(row.feast_month)),
    feast_day: Number(normalizeCell(row.feast_day)),
    patron_of: nullableText(row.patron_of),
    biography_short: normalizeCell(row.biography_short),
    biography_long: normalizeCell(row.biography_long),
    quote: nullableText(row.quote),
    reflection: normalizeCell(row.reflection),
    prayer: normalizeCell(row.prayer),
    image_url: nullableText(row.image_url),
    color_theme: nullableText(row.color_theme),
    liturgical_rank: nullableText(row.liturgical_rank),
    scripture_reference: nullableText(row.scripture_reference),
    tags: parseTags(row.tags),
    is_featured: normalizeBoolean(row.is_featured, true),
    is_active: normalizeBoolean(row.is_active, true),
    updated_at: new Date().toISOString(),
  };
}

function loadSaintPackRows() {
  const publishedDir = path.resolve("supabase/seed/saints/published");
  const files = readdirSync(publishedDir)
    .filter((file) => file.toLowerCase().endsWith(".xlsx"))
    .sort();

  const saints = new Map<string, ReturnType<typeof saintRecordFromRow>>();
  const importFiles: Record<string, number> = {};

  for (const file of files) {
    const workbook = XLSX.readFile(path.join(publishedDir, file));
    const sheet = workbook.Sheets.Saints ?? workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      logWarn("saints", `Workbook ${file} has no readable sheet`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    let imported = 0;
    for (const row of rows) {
      const record = saintRecordFromRow(row);
      if (record.slug && record.name) {
        saints.set(record.slug, record);
        imported += 1;
      }
    }
    importFiles[file] = imported;
  }

  report.import_summary = { files: importFiles, unique_saints: saints.size };
  return Array.from(saints.values());
}

async function maybeSelect(table: string, columns = "id") {
  const { error } = await supabase.from(table).select(columns).limit(1);
  if (!error) return true;
  if (["42P01", "PGRST205"].includes(error.code ?? "")) return false;
  throw error;
}

async function hasColumn(table: string, column: string) {
  const cacheKey = `${table}.${column}`;
  const cached = columnSupportCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const { error } = await supabase.from(table).select(column).limit(1);
  if (!error) {
    columnSupportCache.set(cacheKey, true);
    return true;
  }

  const code = error.code ?? "";
  if (code === "42703" || code === "PGRST204") {
    columnSupportCache.set(cacheKey, false);
    return false;
  }

  throw error;
}

async function findOne(table: string, match: Record<string, unknown>, columns = "id") {
  let query = supabase.from(table).select(columns);
  for (const [column, value] of Object.entries(match)) query = query.eq(column, value as never);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

async function upsertByFilter(table: string, match: Record<string, unknown>, payload: Record<string, unknown>, entity = table) {
  const existing = await findOne(table, match, "id");

  if (isDryRun) {
    record(existing ? "updated" : "created", entity, existing ? "would update existing record" : "would create record");
    return existing?.id as string | undefined;
  }

  if (existing?.id) {
    const { error } = await supabase
      .from(table)
      .update(payload as never)
      .eq("id", existing.id as never);
    if (error) throw error;
    record("updated", entity);
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from(table)
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw error;
  record("created", entity);
  return (data as { id: string }).id;
}

async function profileSupportsChurchContext() {
  const { error } = await supabase.from("profiles").select("id, role, church_id").limit(1);
  if (!error) return true;

  const code = error.code ?? "";
  if (code === "42703" || code === "PGRST204" || code === "PGRST205") {
    throw new Error(`public.profiles is missing role/church_id support required by staging bootstrap. ${formatError(error)}`);
  }

  throw error;
}

async function deleteByIds(table: string, ids: string[], entity = table) {
  if (!ids.length) {
    record("skipped", entity, "no matching records");
    return;
  }
  if (isDryRun) {
    record("skipped", entity, `dry-run would delete ${ids.length}`);
    return;
  }
  const { error } = await supabase.from(table).delete().in("id", ids);
  if (error) throw error;
  record("updated", entity, `deleted ${ids.length}`);
}

async function deleteByFilter(table: string, match: Record<string, unknown>, entity = table) {
  if (isDryRun) {
    record("skipped", entity, "dry-run would delete matching records");
    return;
  }

  let query = supabase.from(table).delete();
  for (const [column, value] of Object.entries(match)) query = query.eq(column, value as never);
  const { error } = await query;
  if (error) throw error;
  record("updated", entity, "deleted matching records");
}

async function findContentLanguageId(code: string) {
  if (!(await maybeSelect("content_languages"))) return null;
  const row = await findOne("content_languages", { code }, "id");
  return (row?.id as string | undefined) ?? null;
}

async function findContentCategoryId(slug: string) {
  if (!(await maybeSelect("content_categories"))) return null;
  const row = await findOne("content_categories", { slug }, "id");
  return (row?.id as string | undefined) ?? null;
}

async function listUsers() {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users;
}

async function ensureUsers() {
  logStep("users", "Ensuring UAT auth users");
  const existingUsers = await listUsers();
  const usersByRole = new Map<string, string>();

  for (const account of USERS) {
    const existing = existingUsers.find((candidate) => candidate.email?.toLowerCase() === account.email.toLowerCase());
    const reportUser = report.users.find((item) => item.email === account.email);

    if (isDryRun) {
      const action = existing ? "updated" : "created";
      record(action, "auth.users", `${account.email} would be ${action}`);
      if (existing) usersByRole.set(account.key, existing.id);
      if (reportUser) {
        reportUser.id = existing?.id;
        reportUser.action = action;
      }
      continue;
    }

    if (existing) {
      const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.fullName, role: account.role, staging: true },
      });
      if (error) throw error;
      usersByRole.set(account.key, data.user.id);
      if (reportUser) {
        reportUser.id = data.user.id;
        reportUser.action = "updated";
      }
      record("updated", "auth.users", account.email);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.fullName, role: account.role, staging: true },
      });
      if (error) throw error;
      usersByRole.set(account.key, data.user.id);
      if (reportUser) {
        reportUser.id = data.user.id;
        reportUser.action = "created";
      }
      record("created", "auth.users", account.email);
    }
  }

  return usersByRole;
}

async function seedProfiles(usersByRole: Map<string, string>, churchId: string | undefined) {
  logStep("profiles", "Ensuring UAT profiles");
  await profileSupportsChurchContext();

  for (const account of USERS) {
    const userId = usersByRole.get(account.key);
    if (!userId) {
      record("skipped", "profiles", `${account.email} has no user id in dry-run`);
      continue;
    }

    const profilePayload: Record<string, unknown> = {
      id: userId,
      full_name: account.fullName,
      role: account.role,
      church_id: account.role === "super_admin" ? null : churchId,
    };

    if (await hasColumn("profiles", "phone")) {
      profilePayload.phone = account.phone;
    }

    if (await hasColumn("profiles", "updated_at")) {
      profilePayload.updated_at = new Date().toISOString();
    }

    try {
      await upsertByFilter("profiles", { id: userId }, profilePayload, "profiles");
    } catch (error) {
      record("failed", "profiles", `${account.email} (${account.role}) failed`);
      logError(
        "profiles",
        new Error(
          `${account.email} role=${account.role} auth_user_id=${userId} church_id=${profilePayload.church_id ?? "null"} ${formatError(error)}`,
        ),
      );
      throw error;
    }
  }
}

async function seedChurch(usersByRole: Map<string, string>) {
  logStep("church", "Ensuring Demo Catholic Parish");
  const existing = await findOne("churches", { code: DEMO_CHURCH.code }, "id");
  const churchPayload: Record<string, unknown> = {
    name: DEMO_CHURCH.name,
    slug: DEMO_CHURCH.slug,
    code: DEMO_CHURCH.code,
    email: DEMO_CHURCH.email,
    phone: DEMO_CHURCH.phone,
    address: DEMO_CHURCH.address,
    created_by: usersByRole.get("super_admin") ?? null,
  };

  const optionalChurchFields: Array<[keyof typeof DEMO_CHURCH | "metadata" | "updated_at", unknown]> = [
    ["status", DEMO_CHURCH.status],
    ["metadata", { staging_bootstrap: true }],
    ["updated_at", new Date().toISOString()],
  ];

  for (const [column, value] of optionalChurchFields) {
    if (await hasColumn("churches", column)) {
      churchPayload[column] = value;
    } else {
      logWarn("church", `Skipping optional churches.${column}; column does not exist in this staging schema`);
    }
  }

  const churchId = await upsertByFilter(
    "churches",
    { code: DEMO_CHURCH.code },
    churchPayload,
    "churches",
  );
  report.church.id = churchId ?? (existing?.id as string | undefined);
  report.church.action = existing ? "updated" : "created";
  return report.church.id;
}

async function seedRoles(churchId: string | undefined, usersByRole: Map<string, string>) {
  logStep("roles", "Ensuring UAT roles");
  if (!churchId) {
    record("skipped", "user_roles", "no church id available");
    return;
  }

  for (const account of USERS.filter((user) => user.role === "church_admin" || user.role === "member")) {
    const userId = usersByRole.get(account.key);
    if (!userId) continue;
    await upsertByFilter("user_roles", { user_id: userId, church_id: churchId }, { user_id: userId, church_id: churchId, role: account.role }, "user_roles");
  }

  const superAdminId = usersByRole.get("super_admin");
  if (superAdminId) {
    await seedSuperAdminMarker(superAdminId);
  }
}

async function seedSuperAdminMarker(superAdminId: string) {
  if (!(await maybeSelect("super_admins", "*"))) {
    record("skipped", "super_admins", "table missing");
    return;
  }

  const hasId = await hasColumn("super_admins", "id");
  const hasUserId = await hasColumn("super_admins", "user_id");
  if (hasId && hasUserId) {
    await upsertByFilter("super_admins", { id: superAdminId }, { id: superAdminId, user_id: superAdminId }, "super_admins");
    return;
  }
  if (hasUserId) {
    await upsertByFilter("super_admins", { user_id: superAdminId }, { user_id: superAdminId }, "super_admins");
    return;
  }
  if (hasId) {
    await upsertByFilter("super_admins", { id: superAdminId }, { id: superAdminId }, "super_admins");
    return;
  }

  throw new Error("public.super_admins has neither id nor user_id");
}

async function seedMembers(churchId: string | undefined, usersByRole: Map<string, string>) {
  logStep("members", "Ensuring UAT member records");
  if (!churchId) {
    record("skipped", "members", "no church id available");
    return [];
  }

  const rows = [
    {
      full_name: "UAT Church Admin",
      email: "uat.churchadmin@kanisaconnect.test",
      phone: "+255700000002",
      church_id: churchId,
      user_id: usersByRole.get("church_admin"),
      status: "active",
      gender: "male",
    },
    {
      full_name: "UAT Member",
      email: "uat.member@kanisaconnect.test",
      phone: "+255700000003",
      church_id: churchId,
      user_id: usersByRole.get("member"),
      status: "active",
      gender: "female",
    },
    {
      full_name: "UAT Choir Member",
      email: "uat.choir.member@kanisaconnect.test",
      phone: "+255700000005",
      church_id: churchId,
      user_id: usersByRole.get("choir_member"),
      status: "active",
      gender: "female",
    },
    {
      full_name: "UAT Youth Member",
      email: "uat.youth.member@kanisaconnect.test",
      phone: "+255700000006",
      church_id: churchId,
      user_id: usersByRole.get("youth_member"),
      status: "active",
      gender: "male",
    },
    {
      full_name: "UAT General Member",
      email: "uat.general.member@kanisaconnect.test",
      phone: "+255700000007",
      church_id: churchId,
      user_id: usersByRole.get("general_member"),
      status: "active",
      gender: "female",
    },
    {
      full_name: "UAT Multi-Group Member",
      email: "uat.multigroup.member@kanisaconnect.test",
      phone: "+255700000008",
      church_id: churchId,
      user_id: usersByRole.get("multi_group_member"),
      status: "active",
      gender: "male",
    },
    {
      full_name: "Maria Demo",
      email: "maria.demo@kanisaconnect.test",
      phone: "+255700000004",
      church_id: churchId,
      status: "active",
      gender: "female",
    },
  ];

  const ids: string[] = [];
  for (const row of rows) {
    const id = await upsertByFilter("members", { church_id: churchId, email: row.email }, row, "members");
    if (id) ids.push(id);
  }

  if (!ids.length) return [];
  const { data, error } = await supabase.from("members").select("id, email, full_name, user_id").in("id", ids);
  if (error) throw error;
  return (data ?? []) as BootstrapMember[];
}

async function seedSaints() {
  logStep("saints", "Importing saint workbooks");
  const records = loadSaintPackRows();
  report.saint_count = records.length;
  if (!records.length) {
    record("skipped", "saints", "no saint workbooks found");
    return;
  }

  for (const recordPayload of records) {
    await upsertByFilter("saints", { slug: recordPayload.slug }, recordPayload, "saints");
  }
}

async function seedDailyReadings() {
  logStep("daily_readings", "Seeding placeholder readings if table exists");
  if (!(await maybeSelect("daily_readings"))) {
    logWarn("daily_readings", "No daily_readings table exists; current app uses static placeholders");
    record("skipped", "daily_readings");
    return;
  }

  const rows = [yesterday, today, tomorrow].map((date, index) => ({
    reading_date: dateKey(date),
    liturgical_season: "Ordinary Time",
    first_reading: index === 0 ? "Yesterday first reading placeholder" : index === 1 ? "Today first reading placeholder" : "Tomorrow first reading placeholder",
    psalm: "Responsorial Psalm placeholder",
    second_reading: "Second Reading placeholder",
    gospel: "Gospel placeholder",
    reflection: "Staging reflection placeholder for UAT.",
    prayer: "Lord, guide this staging UAT with clarity, patience, and truth. Amen.",
    is_published: true,
    updated_at: new Date().toISOString(),
  }));

  for (const row of rows) {
    await upsertByFilter("daily_readings", { reading_date: row.reading_date }, row, "daily_readings");
  }
}

async function seedCmsPrayer(usersByRole: Map<string, string>) {
  logStep("cms_prayers", "Ensuring one published Member Prayer Library prayer");
  if (!(await maybeSelect("content_prayers"))) {
    record("skipped", "content_prayers", "CMS prayers table missing");
    return;
  }

  const languageId = await findContentLanguageId("sw") ?? await findContentLanguageId("en");
  const categoryId = await findContentCategoryId("morning");
  const payload = {
    title: "Sala ya Asubuhi ya UAT",
    slug: SEEDED_CMS_PRAYER_SLUG,
    summary: "Sala fupi ya asubuhi kwa ukaguzi wa UAT.",
    body: "Ee Bwana, tuongoze leo katika imani, tumaini, na upendo. Bariki familia ya parokia na kazi ya UAT. Amina.",
    category_id: categoryId,
    language_id: languageId,
    status: "published",
    featured: false,
    visibility: "member",
    author: "Kanisa Connect UAT",
    source: "Staging UAT seed data",
    liturgical_season: "Ordinary Time",
    scripture_reference: "Psalm 118:24",
    estimated_read_time: 1,
    created_by: usersByRole.get("super_admin") ?? null,
    updated_by: usersByRole.get("super_admin") ?? null,
  };

  await upsertByFilter("content_prayers", { slug: SEEDED_CMS_PRAYER_SLUG }, payload, "content_prayers");
  report.cms_prayer_count = 1;
}

async function seedCmsDailyReadings(usersByRole: Map<string, string>) {
  logStep("cms_daily_readings", "Ensuring published CMS Daily Readings for UAT dates");
  if (!(await maybeSelect("content_daily_readings"))) {
    record("skipped", "content_daily_readings", "CMS daily readings table missing");
    return;
  }

  const languageId = await findContentLanguageId("sw") ?? await findContentLanguageId("en");
  if (!languageId) {
    record("skipped", "content_daily_readings", "no content language available");
    return;
  }

  const rows = [yesterday, today, tomorrow].map((date, index) => ({
    reading_date: dateKey(date),
    liturgical_year: "C",
    liturgical_season: "Ordinary Time",
    celebration: SEEDED_CMS_DAILY_READING_CELEBRATIONS[index],
    liturgical_color: "Green",
    first_reading_reference: index === 0 ? "Isaiah 55:10-11" : index === 1 ? "Romans 8:18-23" : "Micah 6:6-8",
    responsorial_psalm_reference: index === 0 ? "Psalm 65" : index === 1 ? "Psalm 126" : "Psalm 50",
    second_reading_reference: null,
    gospel_acclamation_reference: null,
    gospel_reference: index === 0 ? "Matthew 13:1-9" : index === 1 ? "Luke 10:25-37" : "Matthew 5:13-16",
    reflection: "Tafakari ya UAT inathibitisha kuwa ukurasa wa Masomo ya Siku unaonyesha maudhui yaliyochapishwa.",
    prayer: "Bwana, tusaidie kusikiliza Neno lako na kulitenda kwa upendo. Amina.",
    meditation_questions: "Je, neno la Mungu linanialika kufanya nini leo?",
    daily_challenge: "Fanya tendo moja la huruma kwa jirani.",
    language_id: languageId,
    status: "published",
    visibility: "member",
    source_attribution: "Kanisa Connect Staging UAT",
    editorial_notes: "Bootstrap-owned UAT reading; not official liturgical text.",
    created_by: usersByRole.get("super_admin") ?? null,
    updated_by: usersByRole.get("super_admin") ?? null,
  }));

  for (const row of rows) {
    await upsertByFilter(
      "content_daily_readings",
      { reading_date: row.reading_date, language_id: row.language_id },
      row,
      "content_daily_readings",
    );
  }
  report.cms_daily_reading_count = rows.length;
}

async function seedCommunityAndMinistry(churchId: string | undefined, members: BootstrapMember[]) {
  logStep("member_groups", "Ensuring community and ministry memberships");
  if (!churchId || !members.length) {
    record("skipped", "member_groups", "missing church or members");
    return { communityId: undefined, ministryId: undefined };
  }

  const member = members.find((row) => row.email === "uat.member@kanisaconnect.test") ?? members[0];
  let communityId: string | undefined;
  let ministryId: string | undefined;

  if (await maybeSelect("communities")) {
    communityId = await upsertByFilter(
      "communities",
      { church_id: churchId, name: SEEDED_COMMUNITY_NAME },
      {
        church_id: churchId,
        name: SEEDED_COMMUNITY_NAME,
        description: "Bootstrap-owned community for Member UAT channels and pledges.",
        chairperson_id: member.id,
      },
      "communities",
    );

    if (communityId && await maybeSelect("member_communities")) {
      await upsertByFilter("member_communities", { member_id: member.id, community_id: communityId }, { member_id: member.id, community_id: communityId }, "member_communities");
    }

    if (communityId && await hasColumn("members", "community_id") && !isDryRun) {
      const { error } = await supabase.from("members").update({ community_id: communityId } as never).eq("id", member.id);
      if (error) throw error;
    }
  }

  if (await maybeSelect("ministries")) {
    ministryId = await upsertByFilter(
      "ministries",
      { church_id: churchId, name: SEEDED_MINISTRY_NAME },
      {
        church_id: churchId,
        name: SEEDED_MINISTRY_NAME,
        description: "Bootstrap-owned ministry for Member UAT membership checks.",
      },
      "ministries",
    );

    if (ministryId && await maybeSelect("member_ministries")) {
      await upsertByFilter("member_ministries", { member_id: member.id, ministry_id: ministryId }, { member_id: member.id, ministry_id: ministryId }, "member_ministries");
    }
  }

  report.ministry_count = ministryId ? 1 : 0;
  return { communityId, ministryId };
}

function memberByEmail(members: BootstrapMember[], email: string) {
  return members.find((member) => member.email.toLowerCase() === email.toLowerCase());
}

async function clearTargetedMinistryMemberships(memberIds: string[], ministryIds: string[]) {
  if (!memberIds.length || !ministryIds.length || !(await maybeSelect("member_ministries"))) return;
  const { data, error } = await supabase
    .from("member_ministries")
    .select("id")
    .in("member_id", memberIds)
    .in("ministry_id", ministryIds);
  if (error) throw error;
  await deleteByIds("member_ministries", ((data ?? []) as { id: string }[]).map((row) => row.id), "member_ministries");
}

async function setLegacyMemberMinistry(memberId: string, ministryId: string | null) {
  if (!(await hasColumn("members", "ministry_id")) || isDryRun) return;
  const { error } = await supabase.from("members").update({ ministry_id: ministryId } as never).eq("id", memberId);
  if (error) throw error;
}

async function seedMemberMinistry(member: BootstrapMember | undefined, ministryId: string | undefined) {
  if (!member || !ministryId) return;
  if (await maybeSelect("member_ministries")) {
    await upsertByFilter(
      "member_ministries",
      { member_id: member.id, ministry_id: ministryId },
      { member_id: member.id, ministry_id: ministryId },
      "member_ministries",
    );
  }
}

async function seedTargetedEventUatData(
  churchId: string | undefined,
  members: BootstrapMember[],
  usersByRole: Map<string, string>,
) {
  logStep("targeted_events", "Ensuring targeted event UAT data");
  if (!churchId || !members.length || !(await maybeSelect("ministries")) || !(await maybeSelect("events"))) {
    record("skipped", "targeted_events", "missing church, members, ministries, or events table");
    return { choirMinistryId: undefined, youthMinistryId: undefined, eventIds: {} as Record<string, string> };
  }

  const choirMember = memberByEmail(members, "uat.choir.member@kanisaconnect.test");
  const youthMember = memberByEmail(members, "uat.youth.member@kanisaconnect.test");
  const generalMember = memberByEmail(members, "uat.general.member@kanisaconnect.test");
  const multiGroupMember = memberByEmail(members, "uat.multigroup.member@kanisaconnect.test");

  const choirMinistryPayload: Record<string, unknown> = {
    church_id: churchId,
    name: SEEDED_TARGETED_MINISTRIES.choir,
    description: "Bootstrap-owned ministry for targeted event UAT.",
  };
  const youthMinistryPayload: Record<string, unknown> = {
    church_id: churchId,
    name: SEEDED_TARGETED_MINISTRIES.youth,
    description: "Bootstrap-owned ministry for targeted event UAT.",
  };
  if (await hasColumn("ministries", "is_active")) {
    choirMinistryPayload.is_active = true;
    youthMinistryPayload.is_active = true;
  }

  const choirMinistryId = await upsertByFilter(
    "ministries",
    { church_id: churchId, name: SEEDED_TARGETED_MINISTRIES.choir },
    choirMinistryPayload,
    "ministries",
  );
  const youthMinistryId = await upsertByFilter(
    "ministries",
    { church_id: churchId, name: SEEDED_TARGETED_MINISTRIES.youth },
    youthMinistryPayload,
    "ministries",
  );
  report.ministry_count += [choirMinistryId, youthMinistryId].filter(Boolean).length;

  const targetedMembers = [choirMember, youthMember, generalMember, multiGroupMember].filter(Boolean) as BootstrapMember[];
  await clearTargetedMinistryMemberships(targetedMembers.map((member) => member.id), [choirMinistryId, youthMinistryId].filter(Boolean) as string[]);
  await seedMemberMinistry(choirMember, choirMinistryId);
  await seedMemberMinistry(youthMember, youthMinistryId);
  await seedMemberMinistry(multiGroupMember, choirMinistryId);
  await seedMemberMinistry(multiGroupMember, youthMinistryId);

  if (choirMember) await setLegacyMemberMinistry(choirMember.id, choirMinistryId ?? null);
  if (youthMember) await setLegacyMemberMinistry(youthMember.id, youthMinistryId ?? null);
  if (generalMember) await setLegacyMemberMinistry(generalMember.id, null);
  if (multiGroupMember) await setLegacyMemberMinistry(multiGroupMember.id, choirMinistryId ?? null);

  if (!(await hasColumn("events", "audience_mode"))) {
    record("skipped", "targeted_events", "events.audience_mode missing; apply RC-2.7.7 migration first");
    return { choirMinistryId, youthMinistryId, eventIds: {} as Record<string, string> };
  }

  const choirDate = nextWeekday(today, 3);
  const youthDate = addDays(today, 10);
  const meetingDate = addDays(today, 12);
  const parishDate = addDays(today, 14);
  const publicDate = addDays(today, 16);
  const basePayload = {
    church_id: churchId,
    status: "upcoming",
    visibility: "member",
    created_by: usersByRole.get("church_admin"),
  };
  const events = [
    {
      ...basePayload,
      title: SEEDED_TARGETED_EVENT_TITLES[0],
      description: "Weekly rehearsal used to verify Choir-only targeted event access.",
      location: "Choir Loft",
      start_date: isoAt(choirDate, 18),
      end_date: isoAt(choirDate, 19, 30),
      event_type: "choir_practice",
      ministry: SEEDED_TARGETED_MINISTRIES.choir,
      audience_mode: "specific_groups",
      recurrence_frequency: "weekly",
      recurrence_interval: 1,
      recurrence_days_of_week: [3],
      recurrence_count: 8,
    },
    {
      ...basePayload,
      title: SEEDED_TARGETED_EVENT_TITLES[1],
      description: "One-time retreat used to verify Youth-only targeted event access.",
      location: "Youth Hall",
      start_date: isoAt(youthDate, 9),
      end_date: isoAt(youthDate, 16),
      event_type: "retreat",
      ministry: SEEDED_TARGETED_MINISTRIES.youth,
      audience_mode: "specific_groups",
    },
    {
      ...basePayload,
      title: SEEDED_TARGETED_EVENT_TITLES[2],
      description: "Combined planning meeting visible to Choir and Youth Ministry members.",
      location: "Parish Hall",
      start_date: isoAt(meetingDate, 17),
      end_date: isoAt(meetingDate, 18),
      event_type: "meeting",
      ministry: "Choir and Youth Ministry",
      audience_mode: "specific_groups",
    },
    {
      ...basePayload,
      title: SEEDED_TARGETED_EVENT_TITLES[3],
      description: "All-member parish meeting used to verify parish-wide member visibility.",
      location: "Main Church Hall",
      start_date: isoAt(parishDate, 15),
      end_date: isoAt(parishDate, 16),
      event_type: "parish_meeting",
      ministry: "Parish",
      audience_mode: "all_members",
    },
    {
      ...basePayload,
      title: SEEDED_TARGETED_EVENT_TITLES[4],
      description: "Public parish event used to verify everyone audience visibility.",
      location: "Church Grounds",
      start_date: isoAt(publicDate, 10),
      end_date: isoAt(publicDate, 12),
      event_type: "community",
      ministry: "Parish",
      visibility: "public",
      audience_mode: "everyone",
    },
  ];

  const eventIds: Record<string, string> = {};
  for (const event of events) {
    const payload: Record<string, unknown> = { ...event };
    for (const optionalColumn of [
      "event_type",
      "ministry",
      "visibility",
      "recurrence_frequency",
      "recurrence_interval",
      "recurrence_days_of_week",
      "recurrence_count",
    ]) {
      if (!(await hasColumn("events", optionalColumn))) delete payload[optionalColumn];
    }
    const eventId = await upsertByFilter("events", { church_id: churchId, title: event.title }, payload, "events");
    if (eventId) eventIds[event.title] = eventId;
  }

  if (await maybeSelect("event_audience_targets")) {
    for (const eventId of Object.values(eventIds)) {
      await deleteByFilter("event_audience_targets", { event_id: eventId }, "event_audience_targets");
    }

    const targetRows = [
      { event_id: eventIds[SEEDED_TARGETED_EVENT_TITLES[0]], ministry_id: choirMinistryId },
      { event_id: eventIds[SEEDED_TARGETED_EVENT_TITLES[1]], ministry_id: youthMinistryId },
      { event_id: eventIds[SEEDED_TARGETED_EVENT_TITLES[2]], ministry_id: choirMinistryId },
      { event_id: eventIds[SEEDED_TARGETED_EVENT_TITLES[2]], ministry_id: youthMinistryId },
    ].filter((row) => row.event_id && row.ministry_id);

    for (const row of targetRows) {
      await upsertByFilter(
        "event_audience_targets",
        { event_id: row.event_id, ministry_id: row.ministry_id },
        { church_id: churchId, event_id: row.event_id, ministry_id: row.ministry_id },
        "event_audience_targets",
      );
    }
  }

  report.targeted_event_count = Object.keys(eventIds).length;
  return { choirMinistryId, youthMinistryId, eventIds };
}

async function seedPledge(churchId: string | undefined, members: BootstrapMember[], communityId: string | undefined) {
  logStep("pledges", "Ensuring member pledge data");
  if (!churchId || !members.length || !(await maybeSelect("pledges"))) {
    record("skipped", "pledges", "missing church, members, or pledges table");
    return;
  }

  const member = members.find((row) => row.email === "uat.member@kanisaconnect.test") ?? members[0];
  const payload: Record<string, unknown> = {
    church_id: churchId,
    member_id: member.id,
    amount_pledged: 75000,
    amount_paid: 25000,
    status: "partial",
  };
  if (communityId) payload.community_id = communityId;

  const match: Record<string, unknown> = { church_id: churchId, member_id: member.id };
  if (communityId) match.community_id = communityId;

  await upsertByFilter("pledges", match, payload, "pledges");
  report.pledge_count = 1;
}

async function upsertChatChannelMember(channelId: string, member: BootstrapMember) {
  if (!member.user_id) {
    record("skipped", "chat_channel_members", "member has no linked auth user");
    return;
  }

  const existing = await findOne("chat_channel_members", { channel_id: channelId, user_id: member.user_id }, "channel_id");
  if (isDryRun) {
    record(existing ? "updated" : "created", "chat_channel_members", existing ? "would update existing membership" : "would create membership");
    return;
  }

  if (existing) {
    const { error } = await supabase
      .from("chat_channel_members" as never)
      .update({ member_id: member.id } as never)
      .eq("channel_id", channelId)
      .eq("user_id", member.user_id);
    if (error) throw error;
    record("updated", "chat_channel_members");
    return;
  }

  const { error } = await supabase.from("chat_channel_members" as never).insert({
    channel_id: channelId,
    user_id: member.user_id,
    member_id: member.id,
  } as never);
  if (error) throw error;
  record("created", "chat_channel_members");
}

async function seedChannelAndMessage(
  churchId: string | undefined,
  members: BootstrapMember[],
  usersByRole: Map<string, string>,
  communityId: string | undefined,
) {
  logStep("channels", "Ensuring member channel and starter message");
  if (!churchId || !members.length || !communityId || !(await maybeSelect("chat_channels")) || !(await maybeSelect("chat_channel_members")) || !(await maybeSelect("chat_messages"))) {
    record("skipped", "channels", "missing church, community, member, or chat tables");
    return;
  }

  const member = members.find((row) => row.email === "uat.member@kanisaconnect.test") ?? members[0];
  const channelId = await upsertByFilter(
    "chat_channels",
    { church_id: churchId, name: SEEDED_CHANNEL_NAME },
    {
      church_id: churchId,
      name: SEEDED_CHANNEL_NAME,
      description: "Bootstrap-owned channel for Member UAT conversations.",
      owner_scope: "church_admin",
      audience_type: "community_members",
      community_id: communityId,
      metadata: { staging_bootstrap: true },
      created_by: usersByRole.get("church_admin") ?? member.user_id,
    },
    "chat_channels",
  );

  if (!channelId) return;
  await upsertChatChannelMember(channelId, member);

  if (!member.user_id) {
    record("skipped", "chat_messages", "member has no linked auth user");
    return;
  }

  await upsertByFilter(
    "chat_messages",
    { channel_id: channelId, body: SEEDED_CHANNEL_MESSAGE },
    {
      channel_id: channelId,
      sender_user_id: member.user_id,
      sender_member_id: member.id,
      body: SEEDED_CHANNEL_MESSAGE,
    },
    "chat_messages",
  );
  report.channel_count = 1;
}

async function seedPortalPrayerRequest(churchId: string | undefined, members: BootstrapMember[]) {
  logStep("prayer_requests", "Ensuring member prayer request data");
  if (!churchId || !members.length || !(await maybeSelect("prayer_requests"))) {
    record("skipped", "prayer_requests", "missing church, members, or prayer_requests table");
    return;
  }

  const member = members.find((row) => row.email === "uat.member@kanisaconnect.test") ?? members[0];
  const requestPayload: Record<string, unknown> = {
    church_id: churchId,
    member_id: member.id,
    request_text: SEEDED_PRAYER_REQUEST_TEXT,
    status: "approved",
    offering_amount: 0,
    is_anonymous: false,
  };
  if (await hasColumn("prayer_requests", "request")) requestPayload.request = SEEDED_PRAYER_REQUEST_TEXT;
  if (await hasColumn("prayer_requests", "privacy")) requestPayload.privacy = "public_to_church";

  const requestId = await upsertByFilter(
    "prayer_requests",
    { church_id: churchId, member_id: member.id, request_text: SEEDED_PRAYER_REQUEST_TEXT },
    requestPayload,
    "prayer_requests",
  );

  if (requestId && await maybeSelect("prayer_request_comments")) {
    await upsertByFilter(
      "prayer_request_comments",
      { prayer_request_id: requestId, comment: SEEDED_PRAYER_COMMENT },
      {
        prayer_request_id: requestId,
        church_id: churchId,
        member_id: member.id,
        author_name: member.full_name,
        comment: SEEDED_PRAYER_COMMENT,
      },
      "prayer_request_comments",
    );
  }

  report.prayer_request_count = 1;
}

async function seedMemberMassIntention(churchId: string | undefined, members: BootstrapMember[]) {
  logStep("mass_intentions", "Ensuring member Mass intention data");
  if (!churchId || !members.length || !(await maybeSelect("mass_intentions"))) {
    record("skipped", "mass_intentions", "missing church, members, or mass_intentions table");
    return;
  }

  const member = members.find((row) => row.email === "uat.member@kanisaconnect.test") ?? members[0];
  const payload: Record<string, unknown> = {
    church_id: churchId,
    member_id: member.id,
    intention_type: "shukrani",
    message: SEEDED_MASS_INTENTION_MESSAGE,
    offering_amount: 5000,
    status: "pending",
  };
  if (await hasColumn("mass_intentions", "intention")) payload.intention = SEEDED_MASS_INTENTION_MESSAGE;
  if (await hasColumn("mass_intentions", "requested_mass_date")) payload.requested_mass_date = dateKey(tomorrow);
  if (await hasColumn("mass_intentions", "mass_date")) payload.mass_date = dateKey(tomorrow);

  await upsertByFilter(
    "mass_intentions",
    { church_id: churchId, member_id: member.id, message: SEEDED_MASS_INTENTION_MESSAGE },
    payload,
    "mass_intentions",
  );
  report.mass_intention_count = 1;
}

async function seedContributions(churchId: string | undefined, members: BootstrapMember[], usersByRole: Map<string, string>) {
  logStep("contributions", "Ensuring contribution records");
  if (!churchId || !members.length) {
    record("skipped", "contributions", "missing church or members");
    return;
  }

  const member = members.find((row) => row.email === "uat.member@kanisaconnect.test") ?? members[0];
  const rows = [
    {
      church_id: churchId,
      member_id: member.id,
      donor_name: member.full_name,
      phone: "+255700000003",
      amount: 25000,
      currency: "TZS",
      date: dateKey(today),
      payment_reference: SEEDED_CONTRIBUTION_REFS[0],
      notes: "UAT tithe contribution",
      created_by: usersByRole.get("member"),
    },
    {
      church_id: churchId,
      member_id: member.id,
      donor_name: member.full_name,
      phone: "+255700000003",
      amount: 15000,
      currency: "TZS",
      date: dateKey(yesterday),
      payment_reference: SEEDED_CONTRIBUTION_REFS[1],
      notes: "UAT offering contribution",
      created_by: usersByRole.get("member"),
    },
    {
      church_id: churchId,
      member_id: null,
      donor_name: "Cash Office Demo",
      phone: "+255700000099",
      amount: 50000,
      currency: "TZS",
      date: dateKey(today),
      payment_reference: SEEDED_CONTRIBUTION_REFS[2],
      notes: "UAT office contribution",
      created_by: usersByRole.get("church_admin"),
    },
  ];

  for (const row of rows) await upsertByFilter("contributions", { church_id: churchId, payment_reference: row.payment_reference }, row, "contributions");
  report.contribution_count = rows.length;
}

async function seedMassRsvp(churchId: string | undefined, members: { id: string; email: string; full_name: string }[], usersByRole: Map<string, string>) {
  logStep("mass_rsvp", "Ensuring Mass RSVP records");
  if (!churchId || !members.length || !(await maybeSelect("mass_events")) || !(await maybeSelect("mass_responses"))) {
    record("skipped", "mass_rsvp", "Mass RSVP tables or dependencies missing");
    return;
  }

  const events = [
    {
      church_id: churchId,
      title: SEEDED_MASS_TITLES[0],
      description: "Seeded weekend Mass for UAT RSVP checks.",
      mass_date: dateKey(saturday),
      start_time: "08:00",
      end_time: "09:30",
      response_deadline: isoAt(saturday, 6),
      ask_for_rsvp: true,
      is_active: true,
      created_by: usersByRole.get("church_admin"),
    },
    {
      church_id: churchId,
      title: SEEDED_MASS_TITLES[1],
      description: "Seeded weekday Mass for UAT RSVP checks.",
      mass_date: dateKey(weekdayMassDate),
      start_time: "18:00",
      end_time: "18:45",
      response_deadline: isoAt(weekdayMassDate, 16),
      ask_for_rsvp: true,
      is_active: true,
      created_by: usersByRole.get("church_admin"),
    },
  ];

  const eventIds: string[] = [];
  for (const event of events) {
    const id = await upsertByFilter("mass_events", { church_id: churchId, title: event.title, mass_date: event.mass_date, start_time: event.start_time }, event, "mass_events");
    if (id) eventIds.push(id);
  }

  const responses = eventIds.flatMap((eventId, eventIndex) =>
    members.slice(0, 3).map((member, memberIndex) => ({
      mass_event_id: eventId,
      member_id: member.id,
      response: eventIndex === 0 && memberIndex < 2 ? "yes" : memberIndex === 2 ? "maybe" : "no",
      responded_at: new Date().toISOString(),
    })),
  );
  for (const row of responses) await upsertByFilter("mass_responses", { mass_event_id: row.mass_event_id, member_id: row.member_id }, row, "mass_responses");
  report.attendance_count += responses.length;
}

async function seedEventAttendance(churchId: string | undefined, members: { id: string; email: string; full_name: string }[], usersByRole: Map<string, string>) {
  logStep("attendance", "Ensuring event attendance records");
  if (!churchId || !members.length || !(await maybeSelect("events")) || !(await maybeSelect("event_attendances"))) {
    record("skipped", "event_attendance", "events/event_attendances tables or dependencies missing");
    return;
  }

  const events = [
    {
      church_id: churchId,
      title: SEEDED_EVENT_TITLES[0],
      description: "Seeded service event for attendance check-in UAT.",
      location: "Main Church",
      start_date: isoAt(saturday, 8),
      end_date: isoAt(saturday, 9, 30),
      status: "upcoming",
      created_by: usersByRole.get("church_admin"),
    },
    {
      church_id: churchId,
      title: SEEDED_EVENT_TITLES[1],
      description: "Seeded weekday event for attendance reporting UAT.",
      location: "Chapel",
      start_date: isoAt(weekdayMassDate, 18),
      end_date: isoAt(weekdayMassDate, 18, 45),
      status: "upcoming",
      created_by: usersByRole.get("church_admin"),
    },
  ];

  const eventIds: string[] = [];
  for (const event of events) {
    const id = await upsertByFilter("events", { church_id: churchId, title: event.title }, event, "events");
    if (id) eventIds.push(id);
  }

  const responses = eventIds.flatMap((eventId, eventIndex) =>
    members.slice(0, 3).map((member, memberIndex) => ({
      church_id: churchId,
      event_id: eventId,
      member_id: member.id,
      response: eventIndex === 0 || memberIndex < 2 ? "yes" : "no",
      responded_at: new Date().toISOString(),
    })),
  );
  for (const row of responses) await upsertByFilter("event_attendances", { event_id: row.event_id, member_id: row.member_id }, row, "event_attendances");
  report.attendance_count += responses.length;
}

async function seedAnnouncements(churchId: string | undefined, usersByRole: Map<string, string>) {
  logStep("announcements", "Ensuring announcements");
  if (!churchId) {
    record("skipped", "announcements", "no church id available");
    return;
  }

  const rows = [
    {
      church_id: churchId,
      title: SEEDED_ANNOUNCEMENT_TITLES[0],
      content: "This staging announcement confirms parish communications are ready for UAT.",
      is_published: true,
      published_at: new Date().toISOString(),
      created_by: usersByRole.get("church_admin"),
    },
    {
      church_id: churchId,
      title: SEEDED_ANNOUNCEMENT_TITLES[1],
      content: "Please RSVP for the upcoming Weekend Mass in the member portal.",
      is_published: true,
      published_at: new Date().toISOString(),
      created_by: usersByRole.get("church_admin"),
    },
  ];
  for (const row of rows) await upsertByFilter("announcements", { church_id: churchId, title: row.title }, row, "announcements");
}

async function seedNotifications(churchId: string | undefined, usersByRole: Map<string, string>) {
  logStep("notifications", "Ensuring notifications");
  if (!churchId) {
    record("skipped", "notifications", "no church id available");
    return;
  }

  const memberUserId = usersByRole.get("member") ?? null;
  const rows = [
    { church_id: churchId, user_id: memberUserId, title: SEEDED_NOTIFICATION_TITLES[0], message: "A staging birthday notification for UAT.", type: "success", is_read: false },
    { church_id: churchId, user_id: memberUserId, title: SEEDED_NOTIFICATION_TITLES[1], message: "A staging contribution reminder for UAT.", type: "info", is_read: false },
    { church_id: churchId, user_id: memberUserId, title: SEEDED_NOTIFICATION_TITLES[2], message: "Please respond to the upcoming Mass RSVP.", type: "warning", is_read: false },
  ];

  for (const row of rows) await upsertByFilter("notifications", { church_id: churchId, user_id: row.user_id, title: row.title }, row, "notifications");
  report.notification_count = rows.length;
}

async function seedInvitation(churchId: string | undefined, usersByRole: Map<string, string>) {
  logStep("invitations", "Ensuring pending invitation");
  if (!churchId) {
    record("skipped", "invitations", "no church id available");
    return `/invite/${INVITATION_TOKEN}`;
  }

  await upsertByFilter(
    "invitations",
    { token: INVITATION_TOKEN },
    {
      church_id: churchId,
      email: "uat.invited.member@kanisaconnect.test",
      token: INVITATION_TOKEN,
      role: "member",
      status: "pending",
      invited_by: usersByRole.get("church_admin"),
      expires_at: addDays(today, 14).toISOString(),
    },
    "invitations",
  );

  return `/invite/${INVITATION_TOKEN}`;
}

async function resetSeedData() {
  logStep("reset", "Deleting only bootstrap-owned staging data");
  const church = await findOne("churches", { code: DEMO_CHURCH.code }, "id");
  const churchId = church?.id as string | undefined;
  const saints = loadSaintPackRows();

  if (churchId) {
    if (await maybeSelect("chat_channels")) {
      const { data: channels, error: channelError } = await supabase.from("chat_channels").select("id").eq("church_id", churchId).eq("name", SEEDED_CHANNEL_NAME);
      if (channelError) throw channelError;
      const channelIds = ((channels ?? []) as { id: string }[]).map((row) => row.id);
      if (channelIds.length && await maybeSelect("chat_messages")) {
        const { data, error } = await supabase.from("chat_messages").select("id").in("channel_id", channelIds);
        if (error) throw error;
        await deleteByIds("chat_messages", ((data ?? []) as { id: string }[]).map((row) => row.id), "chat_messages");
      }
      if (channelIds.length && await maybeSelect("chat_channel_members")) {
        for (const channelId of channelIds) await deleteByFilter("chat_channel_members", { channel_id: channelId }, "chat_channel_members");
      }
      await deleteByIds("chat_channels", channelIds, "chat_channels");
    }

    if (await maybeSelect("prayer_requests")) {
      const { data: prayerRequests, error } = await supabase
        .from("prayer_requests")
        .select("id")
        .eq("church_id", churchId)
        .eq("request_text", SEEDED_PRAYER_REQUEST_TEXT);
      if (error) throw error;
      const prayerRequestIds = ((prayerRequests ?? []) as { id: string }[]).map((row) => row.id);
      if (prayerRequestIds.length && await maybeSelect("prayer_request_comments")) {
        const { data, error: commentsError } = await supabase.from("prayer_request_comments").select("id").in("prayer_request_id", prayerRequestIds);
        if (commentsError) throw commentsError;
        await deleteByIds("prayer_request_comments", ((data ?? []) as { id: string }[]).map((row) => row.id), "prayer_request_comments");
      }
      if (prayerRequestIds.length && await maybeSelect("prayer_request_prayers")) {
        const { data, error: prayersError } = await supabase.from("prayer_request_prayers").select("id").in("prayer_request_id", prayerRequestIds);
        if (prayersError) throw prayersError;
        await deleteByIds("prayer_request_prayers", ((data ?? []) as { id: string }[]).map((row) => row.id), "prayer_request_prayers");
      }
      await deleteByIds("prayer_requests", prayerRequestIds, "prayer_requests");
    }

    if (await maybeSelect("mass_intentions")) {
      const { data, error } = await supabase
        .from("mass_intentions")
        .select("id")
        .eq("church_id", churchId)
        .eq("message", SEEDED_MASS_INTENTION_MESSAGE);
      if (error) throw error;
      await deleteByIds("mass_intentions", ((data ?? []) as { id: string }[]).map((row) => row.id), "mass_intentions");
    }

    if (await maybeSelect("pledges")) {
      const { data, error } = await supabase
        .from("pledges")
        .select("id")
        .eq("church_id", churchId)
        .eq("amount_pledged", 75000)
        .eq("amount_paid", 25000);
      if (error) throw error;
      await deleteByIds("pledges", ((data ?? []) as { id: string }[]).map((row) => row.id), "pledges");
    }

    if (await maybeSelect("ministries")) {
      const { data: ministries, error } = await supabase
        .from("ministries")
        .select("id")
        .eq("church_id", churchId)
        .in("name", [SEEDED_MINISTRY_NAME, SEEDED_TARGETED_MINISTRIES.choir, SEEDED_TARGETED_MINISTRIES.youth]);
      if (error) throw error;
      const ministryIds = ((ministries ?? []) as { id: string }[]).map((row) => row.id);
      if (ministryIds.length && await maybeSelect("member_ministries")) {
        const { data, error: membershipError } = await supabase.from("member_ministries").select("id").in("ministry_id", ministryIds);
        if (membershipError) throw membershipError;
        await deleteByIds("member_ministries", ((data ?? []) as { id: string }[]).map((row) => row.id), "member_ministries");
      }
      if (ministryIds.length && await hasColumn("members", "ministry_id") && !isDryRun) {
        const { error: memberUpdateError } = await supabase
          .from("members")
          .update({ ministry_id: null } as never)
          .eq("church_id", churchId)
          .in("email", SEEDED_MEMBER_EMAILS);
        if (memberUpdateError) throw memberUpdateError;
      }
      await deleteByIds("ministries", ministryIds, "ministries");
    }

    if (await maybeSelect("communities")) {
      const { data: communities, error } = await supabase.from("communities").select("id").eq("church_id", churchId).eq("name", SEEDED_COMMUNITY_NAME);
      if (error) throw error;
      const communityIds = ((communities ?? []) as { id: string }[]).map((row) => row.id);
      if (communityIds.length && await maybeSelect("member_communities")) {
        const { data, error: membershipError } = await supabase.from("member_communities").select("id").in("community_id", communityIds);
        if (membershipError) throw membershipError;
        await deleteByIds("member_communities", ((data ?? []) as { id: string }[]).map((row) => row.id), "member_communities");
      }
      await deleteByIds("communities", communityIds, "communities");
    }

    if (await maybeSelect("events")) {
      const { data } = await supabase
        .from("events")
        .select("id")
        .eq("church_id", churchId)
        .in("title", [...SEEDED_EVENT_TITLES, ...SEEDED_TARGETED_EVENT_TITLES]);
      const eventIds = ((data ?? []) as { id: string }[]).map((row) => row.id);
      if (eventIds.length && await maybeSelect("event_attendances")) {
        const { data: attendances, error: attendanceError } = await supabase.from("event_attendances").select("id").in("event_id", eventIds);
        if (attendanceError) throw attendanceError;
        await deleteByIds("event_attendances", ((attendances ?? []) as { id: string }[]).map((row) => row.id), "event_attendances");
      }
      if (eventIds.length && await maybeSelect("event_audience_targets")) {
        const { data: targets, error: targetError } = await supabase.from("event_audience_targets").select("id").in("event_id", eventIds);
        if (targetError) throw targetError;
        await deleteByIds("event_audience_targets", ((targets ?? []) as { id: string }[]).map((row) => row.id), "event_audience_targets");
      }
      await deleteByIds("events", eventIds, "events");
    }

    if (await maybeSelect("mass_responses") && await maybeSelect("mass_events")) {
      const { data: massEvents } = await supabase.from("mass_events").select("id").eq("church_id", churchId).in("title", SEEDED_MASS_TITLES);
      const massEventIds = ((massEvents ?? []) as { id: string }[]).map((row) => row.id);
      if (massEventIds.length) {
        const { data } = await supabase.from("mass_responses").select("id").in("mass_event_id", massEventIds);
        await deleteByIds("mass_responses", ((data ?? []) as { id: string }[]).map((row) => row.id), "mass_responses");
      }
    }

    if (await maybeSelect("mass_events")) {
      const { data } = await supabase.from("mass_events").select("id").eq("church_id", churchId).in("title", SEEDED_MASS_TITLES);
      await deleteByIds("mass_events", ((data ?? []) as { id: string }[]).map((row) => row.id), "mass_events");
    }

    for (const table of ["notifications", "announcements", "contributions", "invitations", "user_roles", "members"] as const) {
      if (!(await maybeSelect(table))) continue;
      let query = supabase.from(table).select("id").eq("church_id", churchId);
      if (table === "notifications") query = query.in("title", SEEDED_NOTIFICATION_TITLES);
      if (table === "announcements") query = query.in("title", SEEDED_ANNOUNCEMENT_TITLES);
      if (table === "contributions") query = query.in("payment_reference", SEEDED_CONTRIBUTION_REFS);
      if (table === "invitations") query = query.eq("token", INVITATION_TOKEN);
      if (table === "members") query = query.in("email", SEEDED_MEMBER_EMAILS);
      const { data, error } = await query;
      if (error) throw error;
      await deleteByIds(table, ((data ?? []) as { id: string }[]).map((row) => row.id), table);
    }

    await deleteByIds("churches", [churchId], "churches");
  } else {
    record("skipped", "churches", "Demo Catholic Parish not found");
  }

  if (saints.length && await maybeSelect("saints")) {
    const { data, error } = await supabase.from("saints").select("id").in("slug", saints.map((saint) => saint.slug));
    if (error) throw error;
    await deleteByIds("saints", ((data ?? []) as { id: string }[]).map((row) => row.id), "saints");
  }

  if (await maybeSelect("content_prayers")) {
    const { data, error } = await supabase.from("content_prayers").select("id").eq("slug", SEEDED_CMS_PRAYER_SLUG);
    if (error) throw error;
    await deleteByIds("content_prayers", ((data ?? []) as { id: string }[]).map((row) => row.id), "content_prayers");
  }

  if (await maybeSelect("content_daily_readings")) {
    const { data, error } = await supabase.from("content_daily_readings").select("id").in("celebration", SEEDED_CMS_DAILY_READING_CELEBRATIONS);
    if (error) throw error;
    await deleteByIds("content_daily_readings", ((data ?? []) as { id: string }[]).map((row) => row.id), "content_daily_readings");
  }

  const authUsers = await listUsers();
  for (const account of USERS) {
    const user = authUsers.find((candidate) => candidate.email?.toLowerCase() === account.email.toLowerCase());
    if (!user) {
      record("skipped", "auth.users", `${account.email} not found`);
      continue;
    }
    if (!isDryRun) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) throw error;
    }
    record(isDryRun ? "skipped" : "updated", "auth.users", `${isDryRun ? "would delete" : "deleted"} ${account.email}`);
  }
}

async function health(name: string, fn: () => Promise<{ ok: boolean; message: string }>) {
  if (isReset) {
    healthChecks.push({ name, status: "SKIP", message: "reset mode" });
    return;
  }
  try {
    const result = await fn();
    healthChecks.push({ name, status: result.ok ? "PASS" : "FAIL", message: result.message });
  } catch (error) {
    healthChecks.push({ name, status: "FAIL", message: error instanceof Error ? error.message : String(error) });
  }
}

async function ministryIdByName(churchId: string, name: string) {
  const row = await findOne("ministries", { church_id: churchId, name }, "id");
  return row?.id as string | undefined;
}

async function memberIdByEmail(churchId: string, email: string) {
  const row = await findOne("members", { church_id: churchId, email }, "id");
  return row?.id as string | undefined;
}

async function memberRecordByEmail(churchId: string, email: string) {
  return await findOne("members", { church_id: churchId, email }, "id, user_id, church_id, status");
}

async function profileRecordById(userId: string) {
  return await findOne("profiles", { id: userId }, "id, role, church_id");
}

async function userRoleExists(userId: string | undefined, churchId: string | undefined, role: AppRole) {
  if (!userId || !churchId || !(await maybeSelect("user_roles"))) return false;
  return !!(await findOne("user_roles", { user_id: userId, church_id: churchId, role }, "id"));
}

async function memberHasMinistry(memberId: string | undefined, ministryId: string | undefined) {
  if (!memberId || !ministryId) return false;
  if (await maybeSelect("member_ministries")) {
    return !!(await findOne("member_ministries", { member_id: memberId, ministry_id: ministryId }, "id"));
  }
  const member = await findOne("members", { id: memberId }, "ministry_id");
  return member?.ministry_id === ministryId;
}

async function eventIdByTitle(churchId: string, title: string) {
  const row = await findOne("events", { church_id: churchId, title }, "id");
  return row?.id as string | undefined;
}

async function eventAudienceMode(churchId: string, title: string) {
  const row = await findOne("events", { church_id: churchId, title }, "audience_mode");
  return row?.audience_mode as string | undefined;
}

async function eventTargetsMinistries(eventId: string | undefined) {
  if (!eventId || !(await maybeSelect("event_audience_targets"))) return [];
  const { data, error } = await supabase.from("event_audience_targets").select("ministry_id").eq("event_id", eventId);
  if (error) throw error;
  return ((data ?? []) as { ministry_id: string | null }[]).map((row) => row.ministry_id).filter(Boolean) as string[];
}

async function runHealthChecks(churchId: string | undefined) {
  logStep("health", "Running bootstrap health checks");
  const users = await listUsers();
  for (const account of USERS) {
    await health(`${account.label} exists`, async () => {
      const user = users.find((candidate) => candidate.email?.toLowerCase() === account.email.toLowerCase());
      return { ok: !!user, message: user ? user.id : "missing" };
    });
  }

  await health("Profiles have expected roles and church assignments", async () => {
    const expected = USERS.map((account) => {
      const user = users.find((candidate) => candidate.email?.toLowerCase() === account.email.toLowerCase());
      return {
        ...account,
        id: user?.id,
        expectedChurchId: account.role === "super_admin" ? null : churchId,
      };
    });

    const ids = expected.map((account) => account.id).filter(Boolean) as string[];
    if (ids.length !== USERS.length) return { ok: false, message: "one or more auth users are missing" };

    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, church_id")
      .in("id", ids);
    if (error) throw error;

    const profiles = new Map(((data ?? []) as Array<{ id: string; role: string | null; church_id: string | null }>).map((profile) => [profile.id, profile]));
    const mismatches = expected.flatMap((account) => {
      const profile = account.id ? profiles.get(account.id) : null;
      if (!profile) return [`${account.email}: missing profile`];
      const issues: string[] = [];
      if (profile.role !== account.role) issues.push(`${account.email}: role ${profile.role ?? "null"} != ${account.role}`);
      if ((profile.church_id ?? null) !== account.expectedChurchId) {
        issues.push(`${account.email}: church_id ${profile.church_id ?? "null"} != ${account.expectedChurchId ?? "null"}`);
      }
      return issues;
    });

    return {
      ok: mismatches.length === 0,
      message: mismatches.length ? mismatches.join("; ") : "super_admin=null church, church_admin/member=demo church",
    };
  });

  await health("Church exists", async () => ({ ok: !!(await findOne("churches", { code: DEMO_CHURCH.code })), message: DEMO_CHURCH.code }));
  await health("Saints imported", async () => {
    const { count, error } = await supabase.from("saints").select("id", { count: "exact", head: true }).eq("is_active", true);
    if (error) throw error;
    return { ok: (count ?? 0) > 0, message: `${count ?? 0} active saints` };
  });
  await health("Saint of the Day query", async () => {
    const { data, error } = await supabase.rpc("get_saint_of_the_day" as never);
    if (error) throw error;
    const count = Array.isArray(data) ? data.length : data ? 1 : 0;
    return { ok: count > 0 || report.saint_count > 0, message: `${count} returned today` };
  });
  await health("Catholic Library query", async () => {
    const { data, error } = await supabase.from("saints").select("id, name").eq("is_active", true).limit(5);
    if (error) throw error;
    return { ok: (data ?? []).length > 0, message: `${(data ?? []).length} rows` };
  });
  await health("Liturgical Calendar query", async () => {
    const month = today.getMonth() + 1;
    const { data, error } = await supabase.from("saints").select("id, name").eq("is_active", true).eq("feast_month", month).limit(5);
    if (error) throw error;
    return { ok: report.saint_count > 0, message: `${(data ?? []).length} saints for current month` };
  });
  await health("Dashboard contribution totals", async () => {
    if (!churchId) return { ok: false, message: "missing church id" };
    const { data, error } = await supabase.from("contributions").select("amount").eq("church_id", churchId);
    if (error) throw error;
    const total = ((data ?? []) as { amount: number }[]).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return { ok: total > 0, message: `TZS ${total}` };
  });
  await health("Member UAT CMS prayer exists", async () => {
    if (!(await maybeSelect("content_prayers"))) return { ok: true, message: "content_prayers table absent; optional check skipped" };
    return { ok: !!(await findOne("content_prayers", { slug: SEEDED_CMS_PRAYER_SLUG })), message: SEEDED_CMS_PRAYER_SLUG };
  });
  await health("Member UAT CMS daily readings exist", async () => {
    if (!(await maybeSelect("content_daily_readings"))) return { ok: true, message: "content_daily_readings table absent; optional check skipped" };
    const { count, error } = await supabase
      .from("content_daily_readings")
      .select("id", { count: "exact", head: true })
      .in("celebration", SEEDED_CMS_DAILY_READING_CELEBRATIONS);
    if (error) throw error;
    return { ok: (count ?? 0) >= 3, message: `${count ?? 0} CMS UAT readings` };
  });
  await health("Member UAT pledge exists", async () => {
    if (!churchId || !(await maybeSelect("pledges"))) return { ok: true, message: "pledges table absent or missing church; optional check skipped" };
    const { count, error } = await supabase
      .from("pledges")
      .select("id", { count: "exact", head: true })
      .eq("church_id", churchId)
      .eq("amount_pledged", 75000)
      .eq("amount_paid", 25000);
    if (error) throw error;
    return { ok: (count ?? 0) > 0, message: `${count ?? 0} UAT pledge rows` };
  });
  await health("Member UAT channel exists", async () => {
    if (!churchId || !(await maybeSelect("chat_channels"))) return { ok: true, message: "chat_channels table absent or missing church; optional check skipped" };
    return { ok: !!(await findOne("chat_channels", { church_id: churchId, name: SEEDED_CHANNEL_NAME })), message: SEEDED_CHANNEL_NAME };
  });
  await health("Member UAT prayer request exists", async () => {
    if (!churchId || !(await maybeSelect("prayer_requests"))) return { ok: true, message: "prayer_requests table absent or missing church; optional check skipped" };
    return { ok: !!(await findOne("prayer_requests", { church_id: churchId, request_text: SEEDED_PRAYER_REQUEST_TEXT })), message: SEEDED_PRAYER_REQUEST_TEXT };
  });
  await health("Member UAT Mass intention exists", async () => {
    if (!churchId || !(await maybeSelect("mass_intentions"))) return { ok: true, message: "mass_intentions table absent or missing church; optional check skipped" };
    return { ok: !!(await findOne("mass_intentions", { church_id: churchId, message: SEEDED_MASS_INTENTION_MESSAGE })), message: SEEDED_MASS_INTENTION_MESSAGE };
  });
  await health("Invitation token exists", async () => ({ ok: !!(await findOne("invitations", { token: INVITATION_TOKEN })), message: INVITATION_TOKEN }));

  await health("Choir ministry exists", async () => {
    if (!churchId || !(await maybeSelect("ministries"))) return { ok: false, message: "ministries unavailable" };
    return { ok: !!(await ministryIdByName(churchId, SEEDED_TARGETED_MINISTRIES.choir)), message: SEEDED_TARGETED_MINISTRIES.choir };
  });
  await health("Youth Ministry exists", async () => {
    if (!churchId || !(await maybeSelect("ministries"))) return { ok: false, message: "ministries unavailable" };
    return { ok: !!(await ministryIdByName(churchId, SEEDED_TARGETED_MINISTRIES.youth)), message: SEEDED_TARGETED_MINISTRIES.youth };
  });
  for (const [label, email] of [
    ["Choir Member", "uat.choir.member@kanisaconnect.test"],
    ["Youth Member", "uat.youth.member@kanisaconnect.test"],
    ["General Member", "uat.general.member@kanisaconnect.test"],
    ["Multi-Group Member", "uat.multigroup.member@kanisaconnect.test"],
  ] as const) {
    await health(`${label} member row exists`, async () => {
      if (!churchId) return { ok: false, message: "missing church id" };
      return { ok: !!(await memberIdByEmail(churchId, email)), message: email };
    });
  }
  for (const [label, email] of [
    ["Choir Member", "uat.choir.member@kanisaconnect.test"],
    ["Youth Member", "uat.youth.member@kanisaconnect.test"],
    ["General Member", "uat.general.member@kanisaconnect.test"],
    ["Multi-Group Member", "uat.multigroup.member@kanisaconnect.test"],
  ] as const) {
    await health(`${label} full account fixture is linked`, async () => {
      if (!churchId) return { ok: false, message: "missing church id" };
      const user = users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
      if (!user) return { ok: false, message: "auth user missing" };

      const profile = await profileRecordById(user.id);
      const member = await memberRecordByEmail(churchId, email);
      const issues: string[] = [];
      if (!profile) issues.push("profile missing");
      if (profile && profile.role !== "member") issues.push(`profile role ${profile.role ?? "null"}`);
      if (profile && profile.church_id !== churchId) issues.push("profile church mismatch");
      if (!member) issues.push("member row missing");
      if (member && member.user_id !== user.id) issues.push("member user_id mismatch");
      if (member && member.church_id !== churchId) issues.push("member church mismatch");
      if (member && (member.status ?? "active") !== "active") issues.push(`member status ${member.status ?? "null"}`);
      if (!(await userRoleExists(user.id, churchId, "member"))) issues.push("member user_role missing");

      return {
        ok: issues.length === 0,
        message: issues.length ? issues.join("; ") : "auth/profile/member/user_role/church active",
      };
    });
  }
  await health("Targeted ministry memberships are correct", async () => {
    if (!churchId) return { ok: false, message: "missing church id" };
    const choirId = await ministryIdByName(churchId, SEEDED_TARGETED_MINISTRIES.choir);
    const youthId = await ministryIdByName(churchId, SEEDED_TARGETED_MINISTRIES.youth);
    const choirMemberId = await memberIdByEmail(churchId, "uat.choir.member@kanisaconnect.test");
    const youthMemberId = await memberIdByEmail(churchId, "uat.youth.member@kanisaconnect.test");
    const generalMemberId = await memberIdByEmail(churchId, "uat.general.member@kanisaconnect.test");
    const multiMemberId = await memberIdByEmail(churchId, "uat.multigroup.member@kanisaconnect.test");
    const checks = [
      ["choir=choir", await memberHasMinistry(choirMemberId, choirId)],
      ["choir!=youth", !(await memberHasMinistry(choirMemberId, youthId))],
      ["youth=youth", await memberHasMinistry(youthMemberId, youthId)],
      ["youth!=choir", !(await memberHasMinistry(youthMemberId, choirId))],
      ["general!=choir", !(await memberHasMinistry(generalMemberId, choirId))],
      ["general!=youth", !(await memberHasMinistry(generalMemberId, youthId))],
      ["multi=choir", await memberHasMinistry(multiMemberId, choirId)],
      ["multi=youth", await memberHasMinistry(multiMemberId, youthId)],
    ];
    const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
    return { ok: failed.length === 0, message: failed.length ? failed.join(", ") : "choir/youth/general/multi matrix ready" };
  });
  await health("Targeted event audience modes are correct", async () => {
    if (!churchId || !(await hasColumn("events", "audience_mode"))) return { ok: false, message: "events.audience_mode unavailable" };
    const expected = new Map([
      [SEEDED_TARGETED_EVENT_TITLES[0], "specific_groups"],
      [SEEDED_TARGETED_EVENT_TITLES[1], "specific_groups"],
      [SEEDED_TARGETED_EVENT_TITLES[2], "specific_groups"],
      [SEEDED_TARGETED_EVENT_TITLES[3], "all_members"],
      [SEEDED_TARGETED_EVENT_TITLES[4], "everyone"],
    ]);
    const mismatches: string[] = [];
    for (const [title, mode] of expected) {
      const actual = await eventAudienceMode(churchId, title);
      if (actual !== mode) mismatches.push(`${title}: ${actual ?? "missing"} != ${mode}`);
    }
    return { ok: mismatches.length === 0, message: mismatches.length ? mismatches.join("; ") : "five UAT event modes verified" };
  });
  await health("Targeted event ministry targets are correct", async () => {
    if (!churchId || !(await maybeSelect("event_audience_targets"))) return { ok: false, message: "event_audience_targets unavailable" };
    const choirId = await ministryIdByName(churchId, SEEDED_TARGETED_MINISTRIES.choir);
    const youthId = await ministryIdByName(churchId, SEEDED_TARGETED_MINISTRIES.youth);
    const choirTargets = await eventTargetsMinistries(await eventIdByTitle(churchId, SEEDED_TARGETED_EVENT_TITLES[0]));
    const youthTargets = await eventTargetsMinistries(await eventIdByTitle(churchId, SEEDED_TARGETED_EVENT_TITLES[1]));
    const combinedTargets = await eventTargetsMinistries(await eventIdByTitle(churchId, SEEDED_TARGETED_EVENT_TITLES[2]));
    const ok =
      choirTargets.length === 1 &&
      choirTargets.includes(choirId ?? "") &&
      youthTargets.length === 1 &&
      youthTargets.includes(youthId ?? "") &&
      combinedTargets.length === 2 &&
      combinedTargets.includes(choirId ?? "") &&
      combinedTargets.includes(youthId ?? "");
    return { ok, message: ok ? "choir/youth/combined targets verified" : "target rows missing or mismatched" };
  });
}

function writeReport() {
  report.duration_ms = Date.now() - startedAt;
  report.created = counters.created;
  report.updated = counters.updated;
  report.skipped = counters.skipped;
  report.failed = counters.failed;
  const reportsDir = path.resolve("reports/bootstrap");
  mkdirSync(reportsDir, { recursive: true });
  const filePath = path.join(reportsDir, "bootstrap-report.json");
  writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  logStep("report", `Wrote ${filePath}`);
}

async function main() {
  let churchId: string | undefined;
  let invitationPath = `/invite/${INVITATION_TOKEN}`;

  try {
    logStep("start", `Mode: ${mode}`);

    if (isReset) {
      await resetSeedData();
    } else {
      const usersByRole = await ensureUsers();
      churchId = await seedChurch(usersByRole);
      await seedProfiles(usersByRole, churchId);
      await seedRoles(churchId, usersByRole);
      const members = await seedMembers(churchId, usersByRole);
      await seedSaints();
      await seedDailyReadings();
      await seedCmsPrayer(usersByRole);
      await seedCmsDailyReadings(usersByRole);
      const { communityId } = await seedCommunityAndMinistry(churchId, members);
      await seedPledge(churchId, members, communityId);
      await seedChannelAndMessage(churchId, members, usersByRole, communityId);
      await seedPortalPrayerRequest(churchId, members);
      await seedMemberMassIntention(churchId, members);
      await seedContributions(churchId, members, usersByRole);
      await seedMassRsvp(churchId, members, usersByRole);
      await seedEventAttendance(churchId, members, usersByRole);
      await seedTargetedEventUatData(churchId, members, usersByRole);
      await seedAnnouncements(churchId, usersByRole);
      await seedNotifications(churchId, usersByRole);
      invitationPath = await seedInvitation(churchId, usersByRole);
      await runHealthChecks(churchId);
    }
  } catch (error) {
    counters.failed += 1;
    logError("bootstrap", error);
    process.exitCode = 1;
  } finally {
    writeReport();
    const invitationUrl = `${STAGING_APP_URL.replace(/\/$/, "")}${invitationPath}`;
    console.log(JSON.stringify({
      level: process.exitCode ? "error" : "info",
      step: "summary",
      mode,
      created: counters.created,
      updated: counters.updated,
      skipped: counters.skipped,
      failed: counters.failed,
      warnings: warnings.length,
      errors: errors.length,
      church_id: churchId ?? report.church.id ?? null,
      invitation_url: invitationUrl,
      report: "reports/bootstrap/bootstrap-report.json",
    }, null, 2));

    if (!isReset) {
      console.log("\nUAT credentials:");
      for (const account of USERS) {
        console.log(`${account.label}: ${account.email} / ${account.password}`);
      }
      console.log(`Invitation link: ${invitationUrl}`);
    }
  }
}

main();
