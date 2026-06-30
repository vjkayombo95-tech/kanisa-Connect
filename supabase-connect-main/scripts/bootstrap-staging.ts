import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import * as XLSX from "xlsx";

type AppRole = "super_admin" | "church_admin" | "member";
type Action = "created" | "updated" | "skipped" | "failed";
type HealthStatus = "PASS" | "FAIL" | "SKIP";

type BootstrapUser = {
  label: string;
  email: string;
  password: string;
  role: AppRole;
  fullName: string;
  phone: string;
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
  contribution_count: number;
  attendance_count: number;
  notification_count: number;
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
    label: "Super Admin",
    email: "uat.superadmin@kanisaconnect.test",
    password: "StagingSuperAdmin#2026",
    role: "super_admin",
    fullName: "UAT Super Admin",
    phone: "+255700000001",
  },
  {
    label: "Church Admin",
    email: "uat.churchadmin@kanisaconnect.test",
    password: "StagingChurchAdmin#2026",
    role: "church_admin",
    fullName: "UAT Church Admin",
    phone: "+255700000002",
  },
  {
    label: "Member",
    email: "uat.member@kanisaconnect.test",
    password: "StagingMember#2026",
    role: "member",
    fullName: "UAT Member",
    phone: "+255700000003",
  },
];

const INVITATION_TOKEN = "uat-member-invite-demo-catholic-parish";
const SEEDED_MEMBER_EMAILS = [
  "uat.churchadmin@kanisaconnect.test",
  "uat.member@kanisaconnect.test",
  "maria.demo@kanisaconnect.test",
];
const SEEDED_CONTRIBUTION_REFS = [
  "STAGING-UAT-CONTRIB-001",
  "STAGING-UAT-CONTRIB-002",
  "STAGING-UAT-CONTRIB-003",
];
const SEEDED_EVENT_TITLES = ["UAT Sunday Service", "UAT Weekday Service"];
const SEEDED_MASS_TITLES = ["Weekend Mass", "Weekday Mass"];
const SEEDED_ANNOUNCEMENT_TITLES = ["Welcome to Demo Catholic Parish", "Weekend Mass Reminder"];
const SEEDED_NOTIFICATION_TITLES = ["Birthday Blessings", "Contribution Reminder", "Weekend Mass RSVP"];

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
  contribution_count: 0,
  attendance_count: 0,
  notification_count: 0,
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

async function listUsers() {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users;
}

async function ensureUsers() {
  logStep("users", "Ensuring UAT auth users");
  const existingUsers = await listUsers();
  const usersByRole = new Map<AppRole, string>();

  for (const account of USERS) {
    const existing = existingUsers.find((candidate) => candidate.email?.toLowerCase() === account.email.toLowerCase());
    const reportUser = report.users.find((item) => item.email === account.email);

    if (isDryRun) {
      const action = existing ? "updated" : "created";
      record(action, "auth.users", `${account.email} would be ${action}`);
      if (existing) usersByRole.set(account.role, existing.id);
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
      usersByRole.set(account.role, data.user.id);
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
      usersByRole.set(account.role, data.user.id);
      if (reportUser) {
        reportUser.id = data.user.id;
        reportUser.action = "created";
      }
      record("created", "auth.users", account.email);
    }
  }

  return usersByRole;
}

async function seedProfiles(usersByRole: Map<AppRole, string>, churchId: string | undefined) {
  logStep("profiles", "Ensuring UAT profiles");
  await profileSupportsChurchContext();

  for (const account of USERS) {
    const userId = usersByRole.get(account.role);
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

async function seedChurch(usersByRole: Map<AppRole, string>) {
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

async function seedRoles(churchId: string | undefined, usersByRole: Map<AppRole, string>) {
  logStep("roles", "Ensuring UAT roles");
  if (!churchId) {
    record("skipped", "user_roles", "no church id available");
    return;
  }

  for (const role of ["church_admin", "member"] as AppRole[]) {
    const userId = usersByRole.get(role);
    if (!userId) continue;
    await upsertByFilter("user_roles", { user_id: userId, church_id: churchId }, { user_id: userId, church_id: churchId, role }, "user_roles");
  }

  const superAdminId = usersByRole.get("super_admin");
  if (superAdminId) {
    await upsertByFilter("super_admins", { id: superAdminId }, { id: superAdminId, user_id: superAdminId }, "super_admins");
  }
}

async function seedMembers(churchId: string | undefined, usersByRole: Map<AppRole, string>) {
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
  const { data, error } = await supabase.from("members").select("id, email, full_name").in("id", ids);
  if (error) throw error;
  return (data ?? []) as { id: string; email: string; full_name: string }[];
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

async function seedContributions(churchId: string | undefined, members: { id: string; email: string; full_name: string }[], usersByRole: Map<AppRole, string>) {
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

async function seedMassRsvp(churchId: string | undefined, members: { id: string; email: string; full_name: string }[], usersByRole: Map<AppRole, string>) {
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

async function seedEventAttendance(churchId: string | undefined, members: { id: string; email: string; full_name: string }[], usersByRole: Map<AppRole, string>) {
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

async function seedAnnouncements(churchId: string | undefined, usersByRole: Map<AppRole, string>) {
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

async function seedNotifications(churchId: string | undefined, usersByRole: Map<AppRole, string>) {
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

async function seedInvitation(churchId: string | undefined, usersByRole: Map<AppRole, string>) {
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
    if (await maybeSelect("event_attendances")) {
      const { data } = await supabase.from("event_attendances").select("id").eq("church_id", churchId);
      await deleteByIds("event_attendances", ((data ?? []) as { id: string }[]).map((row) => row.id), "event_attendances");
    }

    if (await maybeSelect("events")) {
      const { data } = await supabase.from("events").select("id").eq("church_id", churchId).in("title", SEEDED_EVENT_TITLES);
      await deleteByIds("events", ((data ?? []) as { id: string }[]).map((row) => row.id), "events");
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
  await health("Invitation token exists", async () => ({ ok: !!(await findOne("invitations", { token: INVITATION_TOKEN })), message: INVITATION_TOKEN }));
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
      await seedContributions(churchId, members, usersByRole);
      await seedMassRsvp(churchId, members, usersByRole);
      await seedEventAttendance(churchId, members, usersByRole);
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
