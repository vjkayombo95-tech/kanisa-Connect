import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import type { CanonicalDailyReading } from "../models/daily-readings.ts";
import { readLiturgicalWorkbook } from "./workbook-reader.ts";

export type ImportMode = "import" | "dry-run" | "preview";

export type ImportSummary = {
  status: "complete" | "failed";
  mode: ImportMode;
  input: string;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export type RunImportOptions = {
  input?: string;
  report?: string;
  dryRun?: boolean;
  preview?: boolean;
};

type LiturgicalDayRow = {
  id: string;
  date: string;
  celebration: string;
  season: string;
  week: string;
  liturgical_year: string;
  weekday_cycle: string;
  liturgical_color: string;
  rank: string;
  holy_day_of_obligation: boolean;
  saint: string | null;
  lectionary_number: string;
  notes: string | null;
};

type DailyReadingRow = {
  id: string;
  liturgical_day_id: string;
  first_reading_reference: string;
  responsorial_psalm_reference: string;
  psalm_response: string;
  second_reading_reference: string | null;
  gospel_acclamation: string | null;
  gospel_reference: string;
};

type LiturgicalDayPayload = Omit<LiturgicalDayRow, "id">;
type DailyReadingPayload = Omit<DailyReadingRow, "id">;

type RollbackState = {
  createdLiturgicalDayIds: string[];
  createdDailyReadingIds: string[];
  updatedLiturgicalDays: LiturgicalDayRow[];
  updatedDailyReadings: DailyReadingRow[];
};

type SupabaseErrorLike = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

type ImportRuntime = {
  startedAt: number;
  reportPath: string;
  supabaseUrl: string | undefined;
  serviceRoleKey: string | undefined;
  supabase: ReturnType<typeof createClient> | null;
};

let runtime: ImportRuntime = {
  startedAt: Date.now(),
  reportPath: "reports/liturgy/liturgical-import-report.json",
  supabaseUrl: undefined,
  serviceRoleKey: undefined,
  supabase: null,
};

export async function runImport(options: RunImportOptions = {}): Promise<ImportSummary> {
  const inputPath = options.input ?? "reports/liturgy/liturgical-calendar.xlsx";
  const mode: ImportMode = options.dryRun ? "dry-run" : options.preview ? "preview" : "import";

  loadEnvFiles([".env.staging.local", ".env.local", ".env"]);

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SERVICE_ROLE_KEY;

  runtime = {
    startedAt: Date.now(),
    reportPath: options.report ?? "reports/liturgy/liturgical-import-report.json",
    supabaseUrl,
    serviceRoleKey,
    supabase: supabaseUrl && serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      : null,
  };

  const summary: ImportSummary = {
    status: "complete",
    mode,
    input: inputPath,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  const rollback: RollbackState = {
    createdLiturgicalDayIds: [],
    createdDailyReadingIds: [],
    updatedLiturgicalDays: [],
    updatedDailyReadings: [],
  };

  try {
    if (!existsSync(inputPath)) {
      throw new Error(`Workbook does not exist: ${inputPath}`);
    }

    const result = readLiturgicalWorkbook(inputPath);
    if (result.errors.length) {
      summary.errors.push(...result.errors);
      throw new Error(`Workbook validation failed with ${result.errors.length} error(s).`);
    }

    console.log(`Validated ${result.readings.length} liturgical workbook row(s).`);

    if (mode === "preview") {
      printPreview(result.readings);
      summary.skipped = result.readings.length * 2;
    } else if (mode === "dry-run") {
      console.log("Dry run complete. No database writes were performed.");
      summary.skipped = result.readings.length * 2;
    } else {
      validateEnvironment();
      await importReadings(result.readings, summary, rollback);
    }
  } catch (error) {
    summary.status = "failed";
    const formattedError = formatImportError(error);
    console.error(formattedError);
    summary.errors.push(formattedError);
    if (mode === "import") {
      await rollbackImport(rollback, summary);
    }
  } finally {
    writeReport(summary);
    printSummary(summary);
  }

  return summary;
}

async function importReadings(
  readings: CanonicalDailyReading[],
  summary: ImportSummary,
  rollback: RollbackState,
) {
  console.log(`Importing ${readings.length} liturgical day(s) into staging...`);

  const existingDays = await findExistingLiturgicalDays(readings.map((reading) => reading.liturgicalDay.date));
  const dayIdsByDate = new Map<string, string>();

  for (const reading of readings) {
    const payload = toLiturgicalDayPayload(reading);
    const existingDay = existingDays.get(payload.date);

    if (!existingDay) {
      const inserted = await insertLiturgicalDay(payload);
      rollback.createdLiturgicalDayIds.push(inserted.id);
      dayIdsByDate.set(payload.date, inserted.id);
      summary.inserted += 1;
      continue;
    }

    dayIdsByDate.set(payload.date, existingDay.id);
    if (rowsMatch(existingDay, payload)) {
      summary.skipped += 1;
      continue;
    }

    rollback.updatedLiturgicalDays.push(existingDay);
    await updateLiturgicalDay(existingDay.id, payload);
    summary.updated += 1;
  }

  const existingReadings = await findExistingDailyReadings([...dayIdsByDate.values()]);

  for (const reading of readings) {
    const liturgicalDayId = dayIdsByDate.get(reading.liturgicalDay.date);
    if (!liturgicalDayId) {
      throw new Error(`Missing liturgical_day_id after upsert for ${reading.liturgicalDay.date}.`);
    }

    const payload = toDailyReadingPayload(liturgicalDayId, reading);
    const existingReading = existingReadings.get(liturgicalDayId);

    if (!existingReading) {
      const inserted = await insertDailyReading(payload);
      rollback.createdDailyReadingIds.push(inserted.id);
      summary.inserted += 1;
      continue;
    }

    if (rowsMatch(existingReading, payload)) {
      summary.skipped += 1;
      continue;
    }

    rollback.updatedDailyReadings.push(existingReading);
    await updateDailyReading(existingReading.id, payload);
    summary.updated += 1;
  }
}

async function findExistingLiturgicalDays(dates: string[]) {
  if (!dates.length) return new Map<string, LiturgicalDayRow>();
  const { data, error } = await getSupabase()
    .from("liturgical_days")
    .select("id,date,celebration,season,week,liturgical_year,weekday_cycle,liturgical_color,rank,holy_day_of_obligation,saint,lectionary_number,notes")
    .in("date", dates);
  if (error) throwSupabaseError(error);

  return new Map(((data ?? []) as LiturgicalDayRow[]).map((row) => [row.date, row]));
}

async function findExistingDailyReadings(liturgicalDayIds: string[]) {
  if (!liturgicalDayIds.length) return new Map<string, DailyReadingRow>();
  const { data, error } = await getSupabase()
    .from("daily_readings")
    .select("id,liturgical_day_id,first_reading_reference,responsorial_psalm_reference,psalm_response,second_reading_reference,gospel_acclamation,gospel_reference")
    .in("liturgical_day_id", liturgicalDayIds);
  if (error) throwSupabaseError(error);

  return new Map(((data ?? []) as DailyReadingRow[]).map((row) => [row.liturgical_day_id, row]));
}

async function insertLiturgicalDay(payload: LiturgicalDayPayload): Promise<LiturgicalDayRow> {
  const { data, error } = await getSupabase()
    .from("liturgical_days")
    .insert(payload)
    .select("id,date,celebration,season,week,liturgical_year,weekday_cycle,liturgical_color,rank,holy_day_of_obligation,saint,lectionary_number,notes")
    .single();
  if (error) throwSupabaseError(error);
  return data as LiturgicalDayRow;
}

async function updateLiturgicalDay(id: string, payload: LiturgicalDayPayload) {
  const { error } = await getSupabase()
    .from("liturgical_days")
    .update(payload)
    .eq("id", id);
  if (error) throwSupabaseError(error);
}

async function insertDailyReading(payload: DailyReadingPayload): Promise<DailyReadingRow> {
  const { data, error } = await getSupabase()
    .from("daily_readings")
    .insert(payload)
    .select("id,liturgical_day_id,first_reading_reference,responsorial_psalm_reference,psalm_response,second_reading_reference,gospel_acclamation,gospel_reference")
    .single();
  if (error) throwSupabaseError(error);
  return data as DailyReadingRow;
}

async function updateDailyReading(id: string, payload: DailyReadingPayload) {
  const { error } = await getSupabase()
    .from("daily_readings")
    .update(payload)
    .eq("id", id);
  if (error) throwSupabaseError(error);
}

async function rollbackImport(rollback: RollbackState, summary: ImportSummary) {
  if (
    !rollback.createdDailyReadingIds.length &&
    !rollback.createdLiturgicalDayIds.length &&
    !rollback.updatedDailyReadings.length &&
    !rollback.updatedLiturgicalDays.length
  ) {
    return;
  }

  console.warn("Import failed. Rolling back rows changed during this run...");

  try {
    if (rollback.createdDailyReadingIds.length) {
      await getSupabase().from("daily_readings").delete().in("id", rollback.createdDailyReadingIds);
    }

    for (const row of rollback.updatedDailyReadings.reverse()) {
      const { id, ...payload } = row;
      await getSupabase().from("daily_readings").update(payload).eq("id", id);
    }

    if (rollback.createdLiturgicalDayIds.length) {
      await getSupabase().from("liturgical_days").delete().in("id", rollback.createdLiturgicalDayIds);
    }

    for (const row of rollback.updatedLiturgicalDays.reverse()) {
      const { id, ...payload } = row;
      await getSupabase().from("liturgical_days").update(payload).eq("id", id);
    }
  } catch (error) {
    summary.errors.push(`Rollback failed:\n${formatImportError(error)}`);
  }
}

function toLiturgicalDayPayload(reading: CanonicalDailyReading): LiturgicalDayPayload {
  return {
    date: reading.liturgicalDay.date,
    celebration: reading.liturgicalDay.celebration,
    season: reading.liturgicalDay.season,
    week: reading.liturgicalDay.week,
    liturgical_year: reading.liturgicalDay.liturgicalYear,
    weekday_cycle: reading.liturgicalDay.weekdayCycle,
    liturgical_color: reading.liturgicalDay.liturgicalColor,
    rank: reading.liturgicalDay.rank,
    holy_day_of_obligation: reading.liturgicalDay.holyDayOfObligation,
    saint: reading.liturgicalDay.saint,
    lectionary_number: reading.liturgicalDay.lectionaryNumber,
    notes: reading.liturgicalDay.notes,
  };
}

function toDailyReadingPayload(liturgicalDayId: string, reading: CanonicalDailyReading): DailyReadingPayload {
  return {
    liturgical_day_id: liturgicalDayId,
    first_reading_reference: reading.dailyReadings.firstReadingReference,
    responsorial_psalm_reference: reading.dailyReadings.responsorialPsalmReference,
    psalm_response: reading.dailyReadings.psalmResponse,
    second_reading_reference: reading.dailyReadings.secondReadingReference,
    gospel_acclamation: reading.dailyReadings.gospelAcclamation,
    gospel_reference: reading.dailyReadings.gospelReference,
  };
}

function rowsMatch<T extends Record<string, string | boolean | null>>(row: { id?: string } & T, payload: T): boolean {
  return Object.entries(payload).every(([key, value]) => row[key] === value);
}

function printPreview(readings: CanonicalDailyReading[]) {
  console.log(JSON.stringify(readings.slice(0, 5), null, 2));
  if (readings.length > 5) console.log(`...${readings.length - 5} additional row(s) not shown.`);
}

function validateEnvironment() {
  if (!runtime.supabaseUrl) throw new Error("SUPABASE_URL or VITE_SUPABASE_URL is required.");
  if (!runtime.serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("VITE_SUPABASE_SERVICE_ROLE_KEY must never be set.");
  }
}

function getSupabase() {
  if (!runtime.supabase) throw new Error("Supabase client is not initialized.");
  return runtime.supabase;
}

function throwSupabaseError(error: unknown): never {
  throw new Error(formatSupabaseError(error), { cause: error });
}

function formatImportError(error: unknown): string {
  if (isSupabaseErrorLike(error)) return formatSupabaseError(error);
  if (error instanceof Error && isSupabaseErrorLike(error.cause)) {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return JSON.stringify(error, null, 2);
}

function formatSupabaseError(error: unknown): string {
  if (!isSupabaseErrorLike(error)) {
    return error instanceof Error ? error.message : JSON.stringify(error, null, 2);
  }

  const lines = ["Supabase Error"];
  if (error.message) lines.push("", "Message:", error.message);
  if (error.code) lines.push("", "Code:", error.code);
  if (error.details) lines.push("", "Details:", error.details);
  if (error.hint) lines.push("", "Hint:", error.hint);
  return lines.join("\n");
}

function isSupabaseErrorLike(error: unknown): error is SupabaseErrorLike {
  if (!error || typeof error !== "object") return false;
  const candidate = error as SupabaseErrorLike;
  return Boolean(candidate.message || candidate.code || candidate.details || candidate.hint);
}

function loadEnvFiles(envFiles: string[]) {
  for (const envFile of envFiles) {
    const envPath = path.resolve(envFile);
    if (!existsSync(envPath)) continue;

    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const equalsIndex = line.indexOf("=");
      if (equalsIndex <= 0) continue;
      const key = line.slice(0, equalsIndex).trim();
      let value = line.slice(equalsIndex + 1).trim();
      if (!key || process.env[key] !== undefined) continue;
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function writeReport(summary: ImportSummary) {
  const report = {
    ...summary,
    duration_ms: Date.now() - runtime.startedAt,
  };
  mkdirSync(path.dirname(runtime.reportPath), { recursive: true });
  writeFileSync(runtime.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function printSummary(summary: ImportSummary) {
  console.log(`Liturgical workbook import ${summary.status}`);
  console.log(`Mode: ${summary.mode}`);
  console.log(`Inserted: ${summary.inserted}`);
  console.log(`Updated: ${summary.updated}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log(`Errors: ${summary.errors.length}`);
  for (const error of summary.errors) console.error(`- ${error}`);
  console.log(`Report: ${runtime.reportPath}`);
}
