import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { recordCatholicAuditEvent } from "@/lib/super-admin/catholic-audit-service";

type Saint = {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  feast_month: number;
  feast_day: number;
  patron_of: string | null;
  birth_year: number | null;
  death_year: number | null;
  country: string | null;
  biography_short: string;
  biography_long: string;
  quote: string | null;
  reflection: string;
  prayer: string;
  image_url: string | null;
  color_theme: string | null;
  liturgical_rank: string | null;
  is_featured: boolean;
  scripture_reference: string | null;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SaintFormState = {
  slug: string;
  name: string;
  title: string;
  feast_month: string;
  feast_day: string;
  patron_of: string;
  birth_year: string;
  death_year: string;
  country: string;
  biography_short: string;
  biography_long: string;
  quote: string;
  reflection: string;
  prayer: string;
  image_url: string;
  color_theme: string;
  liturgical_rank: string;
  is_featured: boolean;
  scripture_reference: string;
  tags: string;
  is_active: boolean;
};

type SeedSaint = Omit<Saint, "id" | "created_at" | "updated_at">;

type ImportStep = "upload" | "validate" | "preview" | "import" | "summary";

type ValidationIssue = {
  type: "error" | "warning";
  message: string;
  saintName?: string;
};

type ImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: Array<{ slug: string; name: string; message: string }>;
};

type SeedSource = {
  filename: string;
  saint: SeedSaint;
  rowNumber?: number;
  imageFilename?: string | null;
};

type UploadedSeedFile = {
  filename: string;
  file?: File;
  text: string;
};

type ImportStats = {
  total: number;
  featured: number;
  active: number;
  creates: number;
  updates: number;
};

const allowedLiturgicalRanks = new Set(["Solemnity", "Feast", "Memorial", "Optional Memorial"]);

const saintSpreadsheetColumns = [
  "slug",
  "name",
  "title",
  "country",
  "birth_year",
  "death_year",
  "feast_month",
  "feast_day",
  "patron_of",
  "biography_short",
  "biography_long",
  "quote",
  "reflection",
  "prayer",
  "image_filename",
  "color_theme",
  "liturgical_rank",
  "scripture_reference",
  "tags",
  "is_featured",
  "is_active",
] as const;

const requiredSpreadsheetColumns = [
  "slug",
  "name",
  "feast_month",
  "feast_day",
  "biography_short",
  "biography_long",
  "reflection",
  "prayer",
] as const;

const emptyForm: SaintFormState = {
  slug: "",
  name: "",
  title: "",
  feast_month: String(new Date().getMonth() + 1),
  feast_day: String(new Date().getDate()),
  patron_of: "",
  birth_year: "",
  death_year: "",
  country: "",
  biography_short: "",
  biography_long: "",
  quote: "",
  reflection: "",
  prayer: "",
  image_url: "",
  color_theme: "",
  liturgical_rank: "",
  is_featured: false,
  scripture_reference: "",
  tags: "",
  is_active: true,
};

const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(2026, index, 1)),
);

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTag(tag: string): string {
  return tag
    .split(",")
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join(",");
}

function parseTagList(value: string) {
  return value
    .split(",")
    .flatMap((tag) => normalizeTag(tag).split(","))
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formFromSaint(saint: Saint): SaintFormState {
  return {
    slug: saint.slug,
    name: saint.name,
    title: saint.title ?? "",
    feast_month: String(saint.feast_month),
    feast_day: String(saint.feast_day),
    patron_of: saint.patron_of ?? "",
    birth_year: saint.birth_year?.toString() ?? "",
    death_year: saint.death_year?.toString() ?? "",
    country: saint.country ?? "",
    biography_short: saint.biography_short,
    biography_long: saint.biography_long,
    quote: saint.quote ?? "",
    reflection: saint.reflection,
    prayer: saint.prayer,
    image_url: saint.image_url ?? "",
    color_theme: saint.color_theme ?? "",
    liturgical_rank: saint.liturgical_rank ?? "",
    is_featured: saint.is_featured ?? false,
    scripture_reference: saint.scripture_reference ?? "",
    tags: saint.tags?.join(", ") ?? "",
    is_active: saint.is_active,
  };
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function nullableInteger(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function parseTags(value: string) {
  return parseTagList(value);
}

function formatFeast(month: number, day: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(2026, month - 1, day));
}

function SaintImage({ saint }: { saint: Pick<Saint, "name" | "image_url"> }) {
  if (saint.image_url) {
    return (
      <img
        src={saint.image_url}
        alt={saint.name}
        loading="lazy"
        decoding="async"
        className="h-12 w-12 rounded-xl object-cover"
      />
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <BookOpen className="h-5 w-5" />
    </div>
  );
}

function buildPayload(form: SaintFormState) {
  return {
    slug: form.slug.trim() || slugify(form.name),
    name: form.name.trim(),
    title: nullableText(form.title),
    feast_month: Number(form.feast_month),
    feast_day: Number(form.feast_day),
    patron_of: nullableText(form.patron_of),
    birth_year: nullableInteger(form.birth_year),
    death_year: nullableInteger(form.death_year),
    country: nullableText(form.country),
    biography_short: form.biography_short.trim(),
    biography_long: form.biography_long.trim(),
    quote: nullableText(form.quote),
    reflection: form.reflection.trim(),
    prayer: form.prayer.trim(),
    image_url: nullableText(form.image_url),
    color_theme: nullableText(form.color_theme),
    liturgical_rank: nullableText(form.liturgical_rank),
    is_featured: form.is_featured,
    scripture_reference: nullableText(form.scripture_reference),
    tags: parseTags(form.tags),
    is_active: form.is_active,
  };
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function getStringField(record: Record<string, unknown>, key: string, fallbackKey?: string) {
  const value = record[key] ?? (fallbackKey ? record[fallbackKey] : undefined);
  return normalizeCell(value);
}

function getNullableStringField(record: Record<string, unknown>, key: string) {
  const value = normalizeCell(record[key]);
  return value ? value : null;
}

function getNullableNumberField(record: Record<string, unknown>, key: string) {
  const value = normalizeCell(record[key]);
  if (!value) return null;
  return Number(value);
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

function isValidBooleanValue(value: unknown) {
  if (normalizeCell(value) === "") return true;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return value === 0 || value === 1;
  return ["true", "false", "yes", "no", "y", "n", "1", "0"].includes(normalizeCell(value).toLowerCase());
}

function parseImportTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.flatMap((tag) => parseTagList(normalizeCell(tag)));
  }

  const normalized = normalizeCell(value);
  if (!normalized) return [];

  return normalized
    .split(/[;,]/)
    .flatMap((tag) => parseTagList(normalizeCell(tag)))
    .filter(Boolean);
}

function normalizeSeedSaint(record: Record<string, unknown>): SeedSaint {
  return {
    slug: getStringField(record, "slug"),
    name: getStringField(record, "name"),
    title: getNullableStringField(record, "title"),
    feast_month: Number(record.feast_month),
    feast_day: Number(record.feast_day),
    patron_of: getNullableStringField(record, "patron_of"),
    birth_year: getNullableNumberField(record, "birth_year"),
    death_year: getNullableNumberField(record, "death_year"),
    country: getNullableStringField(record, "country"),
    biography_short: getStringField(record, "biography_short", "short_biography"),
    biography_long: getStringField(record, "biography_long", "long_biography"),
    quote: getNullableStringField(record, "quote"),
    reflection: getStringField(record, "reflection"),
    prayer: getStringField(record, "prayer"),
    image_url: getNullableStringField(record, "image_url"),
    color_theme: getNullableStringField(record, "color_theme"),
    liturgical_rank: getNullableStringField(record, "liturgical_rank"),
    is_featured: normalizeBoolean(record.is_featured),
    scripture_reference: getNullableStringField(record, "scripture_reference"),
    tags: parseImportTags(record.tags),
    is_active: record.is_active === undefined ? true : normalizeBoolean(record.is_active, true),
  };
}

function validateSeedSources(seedSources: Array<{ filename: string; raw: unknown; rowNumber?: number }>, existingSaints: Saint[]) {
  const issues: ValidationIssue[] = [];
  const failures: Array<{ slug: string; name: string; message: string }> = [];
  const slugCounts = new Map<string, number>();
  const feastDateMap = new Map<string, string[]>();
  const sources = seedSources.map(({ filename, raw, rowNumber }, index) => {
    const recordIssues: string[] = [];

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      recordIssues.push(`${filename} must contain one saint JSON object.`);
      failures.push({ slug: filename, name: filename, message: recordIssues[0] });
      return null;
    }

    const record = raw as Record<string, unknown>;
    const saint = normalizeSeedSaint(record);
    const label = saint.name || saint.slug || `record ${index + 1}`;
    const rowLabel = rowNumber ? `Row ${rowNumber}` : filename;
    const fileLabel = `${rowLabel} (${label})`;

    const requiredFields: Array<[keyof SeedSaint, string]> = [
      ["slug", "slug"],
      ["name", "name"],
      ["feast_month", "feast_month"],
      ["feast_day", "feast_day"],
      ["biography_short", "biography_short"],
      ["biography_long", "biography_long"],
      ["reflection", "reflection"],
      ["prayer", "prayer"],
    ];

    requiredFields.forEach(([field, fieldName]) => {
      const value = saint[field];
      if (value === null || value === undefined || value === "" || Number.isNaN(value)) {
        recordIssues.push(`${rowLabel}: Missing ${fieldName}`);
      }
    });

    if (saint.slug && saint.slug !== slugify(saint.slug)) {
      recordIssues.push(`Invalid slug format in ${fileLabel}: ${saint.slug}. Use lowercase letters, numbers, and hyphens only.`);
    }

    if (!Number.isInteger(saint.feast_month) || saint.feast_month < 1 || saint.feast_month > 12) {
      recordIssues.push(`Invalid feast_month for ${fileLabel}. Use a number from 1 to 12.`);
    }

    if (!Number.isInteger(saint.feast_day) || saint.feast_day < 1 || saint.feast_day > 31) {
      recordIssues.push(`Invalid feast_day for ${fileLabel}. Use a number from 1 to 31.`);
    }

    if (saint.liturgical_rank && !allowedLiturgicalRanks.has(saint.liturgical_rank)) {
      recordIssues.push(`Invalid liturgical_rank for ${fileLabel}. Allowed values: ${Array.from(allowedLiturgicalRanks).join(", ")}.`);
    }

    if (record.tags !== undefined && record.tags !== null && !Array.isArray(record.tags) && typeof record.tags !== "string") {
      recordIssues.push(`Invalid tag format for ${fileLabel}. tags must be text or an array of strings.`);
    }

    saint.tags?.forEach((tag) => {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(tag)) {
        recordIssues.push(`Invalid tag format for ${fileLabel}: ${tag}. Use lowercase kebab-case tags.`);
      }
    });

    if (!isValidBooleanValue(record.is_featured)) {
      recordIssues.push(`Invalid is_featured value for ${fileLabel}. Use TRUE/FALSE.`);
    }

    if (!isValidBooleanValue(record.is_active)) {
      recordIssues.push(`Invalid is_active value for ${fileLabel}. Use TRUE/FALSE.`);
    }

    if (saint.slug) slugCounts.set(saint.slug, (slugCounts.get(saint.slug) ?? 0) + 1);

    if (Number.isInteger(saint.feast_month) && Number.isInteger(saint.feast_day)) {
      const feastKey = `${saint.feast_month}-${saint.feast_day}`;
      feastDateMap.set(feastKey, [...(feastDateMap.get(feastKey) ?? []), label]);
    }

    if (recordIssues.length > 0) {
      recordIssues.forEach((message) => issues.push({ type: "error", message, saintName: label }));
      failures.push({ slug: saint.slug || filename, name: saint.name || filename, message: recordIssues.join(" ") });
      return null;
    }

    return { filename, saint, rowNumber, imageFilename: getNullableStringField(record, "image_filename") };
  }).filter((source): source is SeedSource => Boolean(source));

  slugCounts.forEach((count, slug) => {
    if (count > 1) {
      sources
        .filter((source) => source.saint.slug === slug)
        .forEach((source) => {
          const sourceLabel = source.rowNumber ? `Row ${source.rowNumber}` : source.filename;
          const message = `${sourceLabel}: Duplicate slug ${slug}`;
          issues.push({ type: "error", message, saintName: source.saint.name });
          failures.push({
            slug,
            name: source.saint.name,
            message,
          });
        });
    }
  });

  feastDateMap.forEach((names, dateKey) => {
    if (names.length > 1) {
      issues.push({ type: "warning", message: `Duplicate feast date ${dateKey}: ${names.join(", ")}` });
    }
  });

  const existingSlugs = new Set(existingSaints.map((saint) => saint.slug));
  const duplicateSlugs = new Set(Array.from(slugCounts.entries()).filter(([, count]) => count > 1).map(([slug]) => slug));
  const validSources = sources.filter((source) => !duplicateSlugs.has(source.saint.slug));
  const saints = validSources.map((source) => source.saint);
  const stats = {
    total: saints.length,
    featured: saints.filter((saint) => saint.is_featured).length,
    active: saints.filter((saint) => saint.is_active).length,
    creates: saints.filter((saint) => !existingSlugs.has(saint.slug)).length,
    updates: saints.filter((saint) => existingSlugs.has(saint.slug)).length,
  };

  return { sources: validSources, saints, issues, stats, failures };
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function imageFilenameFromUrl(value: string | null) {
  if (!value) return "";

  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.split("/").pop() ?? "");
  } catch {
    return value.split("/").pop() ?? "";
  }
}

function saintToSpreadsheetRow(saint: Partial<SeedSaint>) {
  return {
    slug: saint.slug ?? "",
    name: saint.name ?? "",
    title: saint.title ?? "",
    country: saint.country ?? "",
    birth_year: saint.birth_year ?? "",
    death_year: saint.death_year ?? "",
    feast_month: saint.feast_month ?? "",
    feast_day: saint.feast_day ?? "",
    patron_of: saint.patron_of ?? "",
    biography_short: saint.biography_short ?? "",
    biography_long: saint.biography_long ?? "",
    quote: saint.quote ?? "",
    reflection: saint.reflection ?? "",
    prayer: saint.prayer ?? "",
    image_filename: imageFilenameFromUrl(saint.image_url ?? null),
    color_theme: saint.color_theme ?? "",
    liturgical_rank: saint.liturgical_rank ?? "",
    scripture_reference: saint.scripture_reference ?? "",
    tags: saint.tags?.join(",") ?? "",
    is_featured: saint.is_featured ? "TRUE" : "FALSE",
    is_active: saint.is_active === false ? "FALSE" : "TRUE",
  };
}

function applyWorksheetSizing(worksheet: unknown) {
  (worksheet as Record<string, unknown>)["!cols"] = saintSpreadsheetColumns.map((column) => ({
    wch: ["biography_short", "biography_long", "reflection", "prayer"].includes(column) ? 42 : 18,
  }));
}

async function downloadExcelWorkbook(filename: string, rows: Array<Record<string, unknown>>, includeValidationSheet = false) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...saintSpreadsheetColumns] });
  XLSX.utils.sheet_add_aoa(worksheet, [[...saintSpreadsheetColumns]], { origin: "A1" });
  applyWorksheetSizing(worksheet);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Saints");

  if (includeValidationSheet) {
    const validationSheet = XLSX.utils.aoa_to_sheet([
      ["Field", "Allowed Values"],
      ["feast_month", "1-12"],
      ["is_featured", "TRUE, FALSE"],
      ["is_active", "TRUE, FALSE"],
      ["liturgical_rank", Array.from(allowedLiturgicalRanks).join(", ")],
      ["tags", "lowercase kebab-case, separated by commas"],
    ]);
    XLSX.utils.book_append_sheet(workbook, validationSheet, "Validation");
  }

  XLSX.writeFile(workbook, filename);
}

async function downloadExcelTemplate() {
  await downloadExcelWorkbook(
    "Saints-Template.xlsx",
    [
      saintToSpreadsheetRow({
        slug: "st-example",
        name: "St. Example",
        title: "Example Saint",
        country: "Example Country",
        birth_year: null,
        death_year: null,
        feast_month: 1,
        feast_day: 1,
        patron_of: "Example patronage",
        biography_short: "A concise biography used on dashboard cards.",
        biography_long: "A longer biography used in details and future content pages.",
        quote: "An optional quote from or about the saint.",
        reflection: "A pastoral reflection connected to the saint's witness.",
        prayer: "A short prayer asking for the saint's intercession.",
        image_url: "st-example.jpg",
        color_theme: "gold",
        liturgical_rank: "Memorial",
        scripture_reference: "John 15:1-11",
        tags: ["example", "template"],
        is_featured: false,
        is_active: true,
      }),
    ],
    true,
  );
}

function detectImportKind(files: UploadedSeedFile[]) {
  if (files.some((file) => file.filename.toLowerCase().endsWith(".xlsx"))) return "Excel Import";
  if (files.some((file) => file.filename.toLowerCase().endsWith(".csv"))) return "CSV Import";
  return "JSON Import";
}

function parseCsv(text: string) {
  const rows: unknown[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((items) => items.some((item) => normalizeCell(item)));
}

function rowsToRecords(rows: unknown[][]) {
  const headers = (rows[0] ?? []).map((header) => normalizeCell(header));
  const missingColumns = requiredSpreadsheetColumns.filter((column) => !headers.includes(column));
  const records = rows
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      record: headers.reduce<Record<string, unknown>>((acc, header, headerIndex) => {
        if (header) {
          acc[header] = normalizeCell(row[headerIndex]);
        }
        return acc;
      }, {}),
    }))
    .filter(({ record }) => Object.values(record).some((value) => normalizeCell(value)));

  return { headers, missingColumns, records };
}

function createSpreadsheetRecord(record: Record<string, unknown>) {
  const tags = record.tags;

  return {
    ...record,
    tags: Array.isArray(tags) ? tags.join(",") : String(tags ?? ""),
  };
}

function formatImportError(error: unknown, source: SeedSource) {
  const maybePostgrestError = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const lines = [
    source.saint.name,
    source.rowNumber ? `Row ${source.rowNumber}` : source.filename,
  ];

  if (typeof maybePostgrestError.code === "string" && maybePostgrestError.code) {
    lines.push(`Code: ${maybePostgrestError.code}`);
  }

  if (typeof maybePostgrestError.message === "string" && maybePostgrestError.message) {
    lines.push(`Message: ${maybePostgrestError.message}`);
  } else if (error instanceof Error) {
    lines.push(`Message: ${error.message}`);
  } else {
    lines.push(`Message: ${String(error)}`);
  }

  if (typeof maybePostgrestError.details === "string" && maybePostgrestError.details) {
    lines.push(`Details: ${maybePostgrestError.details}`);
  }

  if (typeof maybePostgrestError.hint === "string" && maybePostgrestError.hint) {
    lines.push(`Hint: ${maybePostgrestError.hint}`);
  }

  lines.push(`File: ${source.filename}`);

  return lines.join("\n");
}

function formatUnexpectedError(error: unknown) {
  const maybePostgrestError = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const lines: string[] = [];

  if (typeof maybePostgrestError.code === "string" && maybePostgrestError.code) {
    lines.push(`Code: ${maybePostgrestError.code}`);
  }

  if (typeof maybePostgrestError.message === "string" && maybePostgrestError.message) {
    lines.push(`Message: ${maybePostgrestError.message}`);
  } else if (error instanceof Error) {
    lines.push(`Message: ${error.message}`);
  } else {
    lines.push(`Message: ${String(error)}`);
  }

  if (typeof maybePostgrestError.details === "string" && maybePostgrestError.details) {
    lines.push(`Details: ${maybePostgrestError.details}`);
  }

  if (typeof maybePostgrestError.hint === "string" && maybePostgrestError.hint) {
    lines.push(`Hint: ${maybePostgrestError.hint}`);
  }

  return lines.join("\n");
}

async function parseSpreadsheetSeedFile(file: UploadedSeedFile) {
  if (!file.file) {
    return { seedSources: [] as Array<{ filename: string; raw: unknown; rowNumber?: number }>, errors: [`${file.filename}: Missing uploaded file data.`] };
  }

  const extension = file.filename.split(".").pop()?.toLowerCase();
  let rows: unknown[][] = [];

  if (extension === "xlsx") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.file.arrayBuffer(), { type: "array" });
    const sheetName = workbook.SheetNames.includes("Saints") ? "Saints" : workbook.SheetNames[0];

    if (!sheetName) {
      return { seedSources: [] as Array<{ filename: string; raw: unknown; rowNumber?: number }>, errors: [`${file.filename}: Workbook has no sheets.`] };
    }

    rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" }) as unknown[][];
  } else if (extension === "csv") {
    rows = parseCsv(file.text);
  } else {
    return { seedSources: [] as Array<{ filename: string; raw: unknown; rowNumber?: number }>, errors: [`${file.filename}: Unsupported spreadsheet file type.`] };
  }

  const { missingColumns, records } = rowsToRecords(rows);
  const errors = missingColumns.map((column) => `${file.filename}: Missing required column ${column}`);

  if (records.length === 0) {
    errors.push(`${file.filename}: No saint rows found.`);
  }

  return {
    seedSources: records.map(({ record, rowNumber }) => ({
      filename: `${file.filename} Row ${rowNumber}`,
      rowNumber,
      raw: createSpreadsheetRecord(record),
    })),
    errors,
  };
}

function fileBaseName(filename: string) {
  return filename.split(/[\\/]/).pop() || filename;
}

function isDraftPath(filename: string) {
  return /(^|[\\/])draft[\\/]/i.test(filename);
}

function isPublishedPath(filename: string) {
  return /(^|[\\/])published[\\/]/i.test(filename);
}

function parseUploadedSeedFiles(files: UploadedSeedFile[]) {
  const errors: string[] = [];

  if (files.length === 0) {
    return { seedSources: [] as Array<{ filename: string; raw: unknown }>, errors: ["Upload at least one JSON file."] };
  }

  if (files.length === 1) {
    const file = files[0];
    const parsed = JSON.parse(file.text);

    if (Array.isArray(parsed)) {
      return {
        seedSources: parsed.map((raw, index) => ({
          filename: parsed.length === 1 ? file.filename : `${file.filename} #${index + 1}`,
          raw,
        })),
        errors,
      };
    }

    if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).published)) {
      return {
        seedSources: [] as Array<{ filename: string; raw: unknown }>,
        errors: ["manifest.json was uploaded without its published saint files. Select the manifest and all listed published saint JSON files together."],
      };
    }

    return { seedSources: [{ filename: file.filename, raw: parsed }], errors };
  }

  const manifestFile = files.find((file) => fileBaseName(file.filename).toLowerCase() === "manifest.json");

  if (!manifestFile) {
    return {
      seedSources: [] as Array<{ filename: string; raw: unknown }>,
      errors: ["Multiple saint files require a manifest.json file listing the files to import."],
    };
  }

  const manifest = JSON.parse(manifestFile.text);
  const manifestFiles = (manifest as Record<string, unknown>)?.published;

  if (!Array.isArray(manifestFiles) || manifestFiles.some((entry) => typeof entry !== "string" || !entry.trim())) {
    return {
      seedSources: [] as Array<{ filename: string; raw: unknown }>,
      errors: ["manifest.json must include a published array, for example: { \"published\": [\"st-peter.json\"] }."],
    };
  }

  const fileMap = new Map<string, UploadedSeedFile>();
  files.forEach((file) => {
    if (isDraftPath(file.filename)) return;

    fileMap.set(file.filename, file);
    if (isPublishedPath(file.filename) || !/[\\/]/.test(file.filename)) {
      fileMap.set(fileBaseName(file.filename), file);
      fileMap.set(`published/${fileBaseName(file.filename)}`, file);
    }
  });

  const seedSources = manifestFiles.flatMap((entry) => {
    const filename = String(entry).trim();
    const file = fileMap.get(filename) ?? fileMap.get(`published/${fileBaseName(filename)}`) ?? fileMap.get(fileBaseName(filename));

    if (!file) {
      errors.push(`Published manifest file not found: ${filename}`);
      return [];
    }

    try {
      const parsed = JSON.parse(file.text);
      if (Array.isArray(parsed)) {
        errors.push(`${filename} must contain one saint object, not an array.`);
        return [];
      }

      return [{ filename, raw: parsed }];
    } catch (error) {
      errors.push(error instanceof Error ? `${filename}: Invalid JSON: ${error.message}` : `${filename}: Invalid JSON.`);
      return [];
    }
  });

  return { seedSources, errors };
}

export default function CatholicSaintsPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [previewSaint, setPreviewSaint] = useState<Saint | null>(null);
  const [editingSaint, setEditingSaint] = useState<Saint | null>(null);
  const [form, setForm] = useState<SaintFormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>("upload");
  const [importKind, setImportKind] = useState("JSON Import");
  const [importFileName, setImportFileName] = useState("");
  const [importJsonText, setImportJsonText] = useState("");
  const [uploadedSeedFiles, setUploadedSeedFiles] = useState<UploadedSeedFile[]>([]);
  const [validatedSources, setValidatedSources] = useState<SeedSource[]>([]);
  const [validatedSaints, setValidatedSaints] = useState<SeedSaint[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [validationFailures, setValidationFailures] = useState<Array<{ slug: string; name: string; message: string }>>([]);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const { data: saints = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["super-admin-catholic-saints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saints" as never)
        .select("*")
        .order("feast_month", { ascending: true })
        .order("feast_day", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as Saint[];
    },
  });

  const filteredSaints = useMemo(() => {
    const term = search.trim().toLowerCase();

    return saints.filter((saint) => {
      const matchesStatus =
        activeFilter === "all" ||
        (activeFilter === "active" && saint.is_active) ||
        (activeFilter === "inactive" && !saint.is_active);
      const matchesSearch =
        !term ||
        [saint.name, saint.title, saint.patron_of, saint.country, saint.slug]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));

      return matchesStatus && matchesSearch;
    });
  }, [activeFilter, saints, search]);

  const metrics = useMemo(
    () => ({
      total: saints.length,
      active: saints.filter((saint) => saint.is_active).length,
      inactive: saints.filter((saint) => !saint.is_active).length,
    }),
    [saints],
  );

  const openCreateForm = () => {
    setEditingSaint(null);
    setForm(emptyForm);
    setImageFile(null);
    setFormOpen(true);
  };

  const openEditForm = (saint: Saint) => {
    setEditingSaint(saint);
    setForm(formFromSaint(saint));
    setImageFile(null);
    setFormOpen(true);
  };

  const updateForm = (key: keyof SaintFormState, value: string | boolean) => {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "name" && !editingSaint && !current.slug.trim() && typeof value === "string") {
        next.slug = slugify(value);
      }

      return next;
    });
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setImageFile(event.target.files?.[0] ?? null);
  };

  const uploadImage = async (slug: string) => {
    if (!imageFile) return form.image_url;

    const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `saints/${slug}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("catholic-content").upload(path, imageFile, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from("catholic-content").getPublicUrl(path);
    return data.publicUrl;
  };

  const saveSaint = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const basePayload = buildPayload(form);
      const imageUrl = await uploadImage(basePayload.slug);
      const payload = { ...basePayload, image_url: nullableText(imageUrl ?? "") };

      if (editingSaint) {
        const { error } = await supabase
          .from("saints" as never)
          .update(payload as never)
          .eq("id", editingSaint.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("saints" as never)
          .insert(payload as never);

        if (error) throw error;
      }

      toast({
        title: editingSaint ? "Saint updated" : "Saint created",
        description: `${payload.name} is ready for the Catholic Content platform.`,
      });
      setFormOpen(false);
      await refetch();
    } catch (saveError) {
      toast({
        title: "Unable to save saint",
        description: saveError instanceof Error ? saveError.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetImportWizard = () => {
    setImportStep("upload");
    setImportKind("JSON Import");
    setImportFileName("");
    setImportJsonText("");
    setUploadedSeedFiles([]);
    setValidatedSources([]);
    setValidatedSaints([]);
    setValidationIssues([]);
    setValidationFailures([]);
    setImportStats(null);
    setImportProgress(0);
    setImportSummary(null);
    setIsImporting(false);
  };

  const openImportWizard = () => {
    resetImportWizard();
    setImportOpen(true);
  };

  const closeImportWizard = (open: boolean) => {
    setImportOpen(open);
    if (!open && !isImporting) resetImportWizard();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => /\.(json|csv|xlsx)$/i.test(file.name));
    event.target.value = "";
    await loadImportFiles(files);
  };

  const loadImportFiles = async (files: File[]) => {
    resetImportWizard();

    if (files.length === 0) return;

    const detectedKind = detectImportKind(files.map((file) => ({ filename: file.name, text: "", file })));
    setImportFileName(files.length === 1 ? files[0].name : `${files.length} files`);
    setImportKind(detectedKind);

    try {
      const uploadedFiles = await Promise.all(
        files.map(async (file) => ({
          filename: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
          file,
          text: await file.text(),
        })),
      );

      setUploadedSeedFiles(uploadedFiles);
      setImportJsonText(uploadedFiles[0]?.text ?? "");
      setImportStep("validate");
    } catch (readError) {
      setValidationIssues([
        {
          type: "error",
          message: readError instanceof Error ? `Unable to read uploaded file: ${readError.message}` : "Unable to read uploaded file.",
        },
      ]);
      setImportStep("validate");
    }
  };

  const validateImportFile = async () => {
    try {
      const uploadFiles = uploadedSeedFiles.length > 0 ? uploadedSeedFiles : [{ filename: importFileName || "uploaded.json", text: importJsonText }];
      const parsedUpload = importKind === "Excel Import" || importKind === "CSV Import"
        ? await parseSpreadsheetSeedFile(uploadFiles[0])
        : parseUploadedSeedFiles(uploadFiles);

      if (parsedUpload.errors.length > 0) {
        setValidationIssues(parsedUpload.errors.map((message) => ({ type: "error", message })));
        setValidatedSources([]);
        setValidatedSaints([]);
        setValidationFailures(parsedUpload.errors.map((message) => ({ slug: "manifest", name: "Manifest", message })));
        setImportStats(null);
        return;
      }

      const result = validateSeedSources(parsedUpload.seedSources, saints);
      setValidatedSources(result.sources);
      setValidatedSaints(result.saints);
      setValidationIssues(result.issues);
      setValidationFailures(result.failures);
      setImportStats(result.stats ?? null);

      if (result.saints.length === 0) {
        return;
      }

      setImportStep("preview");
    } catch (parseError) {
      setValidationIssues([
        {
          type: "error",
          message: parseError instanceof Error ? `Invalid JSON: ${parseError.message}` : "Invalid JSON file.",
        },
      ]);
      setValidatedSources([]);
      setValidatedSaints([]);
      setValidationFailures([
        {
          slug: importFileName || "uploaded-json",
          name: importFileName || "Uploaded JSON",
          message: parseError instanceof Error ? `Invalid JSON: ${parseError.message}` : "Invalid JSON file.",
        },
      ]);
      setImportStats(null);
      return;
    }
  };

  const runImport = async () => {
    const importStartedAt = performance.now();
    setIsImporting(true);
    setImportStep("import");
    setImportProgress(0);

    const existingSlugs = new Set(saints.map((saint) => saint.slug));
    const summary: ImportSummary = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: validationFailures.length,
      failures: [...validationFailures],
    };

    const { data: isSuperAdminForImport, error: authorizationError } = await supabase.rpc("is_super_admin" as never);

    if (authorizationError || isSuperAdminForImport !== true) {
      if (authorizationError) {
        console.error(authorizationError);
      }

      summary.failed += validatedSources.length;
      summary.failures.push({
        slug: "saints-import",
        name: "Saints Import",
        message: authorizationError
          ? `The Saints import could not verify Super Admin access.\n${formatUnexpectedError(authorizationError)}`
          : "The database rejected this import because the current authenticated user is not a Super Admin according to public.is_super_admin(). Sign out and back in after your Super Admin role is applied.",
      });
      setImportSummary(summary);
      setIsImporting(false);
      setImportStep("summary");
      setImportProgress(100);
      toast({
        title: "Import not authorized",
        description: "The database does not recognize this session as Super Admin.",
        variant: "destructive",
      });
      return;
    }

    for (const [index, source] of validatedSources.entries()) {
      const { saint, filename } = source;
      const payload = { ...saint } as Record<string, unknown>;

      if (!saint.image_url) {
        delete payload.image_url;
      }

      try {
        const { error } = await supabase
          .from("saints" as never)
          .upsert(payload as never, { onConflict: "slug" });

        if (error) throw error;

        if (existingSlugs.has(saint.slug)) {
          summary.updated += 1;
        } else {
          summary.created += 1;
          existingSlugs.add(saint.slug);
        }
      } catch (recordError) {
        console.error(recordError);
        summary.failed += 1;
        summary.failures.push({
          slug: saint.slug,
          name: saint.name,
          message: formatImportError(recordError, source),
        });
      } finally {
        setImportProgress(Math.round(((index + 1) / Math.max(validatedSources.length, 1)) * 100));
      }
    }

    setImportSummary(summary);
    setIsImporting(false);
    setImportStep("summary");

    await recordCatholicAuditEvent({
      action: "workbook_imported",
      entityType: "workbook",
      description: `${importFileName || "Saints import"} completed with ${summary.created} created, ${summary.updated} updated, and ${summary.failed} failed.`,
      metadata: {
        workbook_name: importFileName || "Saints import",
        records_created: summary.created,
        records_updated: summary.updated,
        records_skipped: summary.skipped,
        records_failed: summary.failed,
        duration_ms: Math.round(performance.now() - importStartedAt),
      },
    });

    if (summary.failed === 0) {
      toast({
        title: "Import finished",
        description: `${summary.created} created and ${summary.updated} updated.`,
      });
    } else {
      toast({
        title: "Import finished with errors",
        description: `${summary.failed} record(s) failed. Review the import summary.`,
        variant: "destructive",
      });
    }

    await refetch();
  };

  const setSaintActive = async (saint: Saint, isActive: boolean) => {
    setUpdatingId(saint.id);

    try {
      const { error } = await supabase
        .from("saints" as never)
        .update({ is_active: isActive } as never)
        .eq("id", saint.id);

      if (error) throw error;

      toast({
        title: isActive ? "Saint restored" : "Saint archived",
        description: `${saint.name} is now ${isActive ? "active" : "inactive"}.`,
      });
      await refetch();
    } catch (updateError) {
      toast({
        title: "Unable to update saint",
        description: updateError instanceof Error ? updateError.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const exportSaints = async () => {
    setIsExporting(true);

    try {
      await downloadExcelWorkbook(
        "Saints.xlsx",
        saints.map((saint) => saintToSpreadsheetRow(saint)),
      );

      toast({
        title: "Export Complete",
        description: `${saints.length} saints exported to Saints.xlsx.`,
      });
    } catch (exportError) {
      toast({
        title: "Unable to export saints",
        description: exportError instanceof Error ? exportError.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      await downloadExcelTemplate();
      toast({
        title: "Template downloaded",
        description: "Saints-Template.xlsx is ready for content authoring.",
      });
    } catch (templateError) {
      toast({
        title: "Unable to download template",
        description: templateError instanceof Error ? templateError.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif">Saints</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage Saint of the Day content for the Catholic platform</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Excel Template
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={exportSaints} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Saints
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={openImportWizard}>
            <Upload className="mr-2 h-4 w-4" />
            Import Saints
          </Button>
          <Button className="w-full sm:w-auto" onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" />
            Create Saint
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Saints</p>
            <p className="mt-2 text-2xl font-bold font-serif">{metrics.total}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="mt-2 text-2xl font-bold font-serif">{metrics.active}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Archived</p>
            <p className="mt-2 text-2xl font-bold font-serif">{metrics.inactive}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search saints by name, patronage, country..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All saints</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Archived only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing {filteredSaints.length} of {saints.length} saints
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Saint</TableHead>
                  <TableHead>Feast Day</TableHead>
                  <TableHead>Patron Of</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
                      Loading saints...
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-destructive">
                      Unable to load saints: {(error as Error)?.message || "Unknown error"}
                    </TableCell>
                  </TableRow>
                ) : saints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                      No saints have been created yet
                    </TableCell>
                  </TableRow>
                ) : filteredSaints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                      No saints match the current filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSaints.map((saint) => (
                    <TableRow key={saint.id} className="border-border">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <SaintImage saint={saint} />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{saint.name}</p>
                            <p className="max-w-[280px] truncate text-xs text-muted-foreground">
                              {saint.title || saint.slug}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatFeast(saint.feast_month, saint.feast_day)}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                        {saint.patron_of || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {saint.country || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            saint.is_active
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-muted-foreground/30 bg-muted text-muted-foreground"
                          }
                        >
                          {saint.is_active ? "Active" : "Archived"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => setPreviewSaint(saint)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Preview
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditForm(saint)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingId === saint.id}
                            onClick={() => setSaintActive(saint, !saint.is_active)}
                          >
                            {updatingId === saint.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : saint.is_active ? (
                              <Archive className="mr-2 h-4 w-4" />
                            ) : (
                              <RotateCcw className="mr-2 h-4 w-4" />
                            )}
                            {saint.is_active ? "Archive" : "Restore"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={importOpen} onOpenChange={closeImportWizard}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Import Saints</DialogTitle>
            <DialogDescription>
              Upload Excel, CSV, or JSON content, validate it, preview changes, then import by slug.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-5">
            {(["upload", "validate", "preview", "import", "summary"] as ImportStep[]).map((step, index) => {
              const isActive = importStep === step;
              const isComplete = ["upload", "validate", "preview", "import", "summary"].indexOf(importStep) > index;

              return (
                <div
                  key={step}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : isComplete
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  <span className="font-medium capitalize">{step}</span>
                </div>
              );
            })}
          </div>

          {importStep === "upload" ? (
            <div className="space-y-5">
              <div
                className="rounded-2xl border border-dashed border-border p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  loadImportFiles(Array.from(event.dataTransfer.files).filter((file) => /\.(json|csv|xlsx)$/i.test(file.name)));
                }}
              >
                <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-3 font-semibold text-foreground">Upload Saints.xlsx, CSV, or JSON</h3>
                <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                  Excel is the primary authoring format. CSV and JSON imports remain supported for developers. You can also drag and drop files here.
                </p>
                <Input className="mx-auto mt-4 max-w-md" type="file" accept=".xlsx,.csv,application/json,.json" multiple onChange={handleImportFile} />
              </div>
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Future bulk image upload is planned around slug-matched filenames such as `st-peter.jpg`. Spreadsheet imports read `image_filename` for that future workflow but do not upload images.
                </CardContent>
              </Card>
            </div>
          ) : null}

          {importStep === "validate" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">{importFileName || "Uploaded JSON"}</p>
                  <p className="text-sm text-muted-foreground">{importKind}. Validate before previewing or importing.</p>
                </div>
                <Button onClick={validateImportFile}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Validate
                </Button>
              </div>

              {validationIssues.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground">
                    {validationIssues.some((issue) => issue.type === "error") ? "Validation Failed" : "Validation Warnings"}
                  </h3>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-border p-3">
                    {validationIssues.map((issue, index) => (
                      <div
                        key={`${issue.message}-${index}`}
                        className={`rounded-xl p-3 text-sm ${
                          issue.type === "error"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-amber-500/10 text-amber-700"
                        }`}
                      >
                        {issue.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {importStep === "preview" && importStats ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Card className="glass-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Saints</p><p className="mt-1 text-2xl font-bold">{importStats.total}</p></CardContent></Card>
                <Card className="glass-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Featured</p><p className="mt-1 text-2xl font-bold">{importStats.featured}</p></CardContent></Card>
                <Card className="glass-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active</p><p className="mt-1 text-2xl font-bold">{importStats.active}</p></CardContent></Card>
                <Card className="glass-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Create</p><p className="mt-1 text-2xl font-bold">{importStats.creates}</p></CardContent></Card>
                <Card className="glass-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Update</p><p className="mt-1 text-2xl font-bold">{importStats.updates}</p></CardContent></Card>
              </div>

              {validationIssues.filter((issue) => issue.type === "warning").length > 0 ? (
                <div>
                  <h3 className="font-semibold text-foreground">Validation warnings</h3>
                  <div className="mt-2 space-y-2">
                    {validationIssues.filter((issue) => issue.type === "warning").map((issue, index) => (
                      <div key={`${issue.message}-${index}`} className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700">
                        {issue.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {validationFailures.length > 0 ? (
                <div>
                  <h3 className="font-semibold text-foreground">Records that will fail or be skipped</h3>
                  <div className="mt-2 space-y-2">
                    {validationFailures.map((failure, index) => (
                      <div key={`${failure.slug}-${index}`} className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                        <span className="font-medium">{failure.name || failure.slug}:</span> {failure.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="max-h-72 overflow-y-auto rounded-2xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Saint</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Feast</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validatedSources.map(({ filename, saint }) => {
                      const willUpdate = saints.some((existing) => existing.slug === saint.slug);

                      return (
                        <TableRow key={`${filename}-${saint.slug}`}>
                          <TableCell className="text-sm text-muted-foreground">{filename}</TableCell>
                          <TableCell className="font-medium">{saint.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{saint.slug}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatFeast(saint.feast_month, saint.feast_day)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={willUpdate ? "border-amber-500/30 bg-amber-500/10 text-amber-700" : "border-success/30 bg-success/10 text-success"}>
                              {willUpdate ? "Update" : "Create"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {importStep === "import" ? (
            <div className="space-y-4 rounded-2xl border border-border p-5">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="font-medium text-foreground">Import in progress</p>
                  <p className="text-sm text-muted-foreground">Records are being upserted by slug. Failed records will be reported without stopping the import.</p>
                </div>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${importProgress}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">{importProgress}% complete</p>
            </div>
          ) : null}

          {importStep === "summary" && importSummary ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-success/30 bg-success/10 p-4">
                <p className="font-medium text-success">Import Finished</p>
                <p className="mt-1 text-sm text-muted-foreground">Created: {importSummary.created} · Updated: {importSummary.updated} · Skipped: {importSummary.skipped} · Failed: {importSummary.failed}</p>
              </div>
              {importSummary.failures.length > 0 ? (
                <div>
                  <h3 className="font-semibold text-foreground">Failed records</h3>
                  <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                    {importSummary.failures.map((failure) => (
                      <div key={`${failure.slug}-${failure.message}`} className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                        <span className="font-medium">{failure.name || failure.slug}:</span> {failure.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            {importStep === "preview" ? (
              <>
                <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                <Button type="button" onClick={runImport} disabled={validatedSaints.length === 0}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import {validatedSaints.length} Saints
                </Button>
              </>
            ) : importStep === "summary" ? (
              <Button type="button" onClick={() => setImportOpen(false)}>Done</Button>
            ) : importStep === "validate" ? (
              <Button type="button" variant="outline" onClick={() => setImportStep("upload")}>Back</Button>
            ) : importStep === "upload" ? (
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingSaint ? "Edit Saint" : "Create Saint"}</DialogTitle>
            <DialogDescription>
              This content powers Saint of the Day and future Catholic content experiences.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={saveSaint}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="saint-name">Name</Label>
                <Input id="saint-name" className="mt-2" required value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="saint-slug">Slug</Label>
                <Input id="saint-slug" className="mt-2" required value={form.slug} onChange={(event) => updateForm("slug", slugify(event.target.value))} />
              </div>
              <div>
                <Label htmlFor="saint-title">Title</Label>
                <Input id="saint-title" className="mt-2" value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="saint-country">Country</Label>
                <Input id="saint-country" className="mt-2" value={form.country} onChange={(event) => updateForm("country", event.target.value)} />
              </div>
              <div>
                <Label>Feast Month</Label>
                <Select value={form.feast_month} onValueChange={(value) => updateForm("feast_month", value)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((month, index) => (
                      <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="saint-day">Feast Day</Label>
                <Input
                  id="saint-day"
                  className="mt-2"
                  type="number"
                  min={1}
                  max={31}
                  required
                  value={form.feast_day}
                  onChange={(event) => updateForm("feast_day", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="saint-birth">Birth Year</Label>
                <Input id="saint-birth" className="mt-2" type="number" value={form.birth_year} onChange={(event) => updateForm("birth_year", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="saint-death">Death Year</Label>
                <Input id="saint-death" className="mt-2" type="number" value={form.death_year} onChange={(event) => updateForm("death_year", event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="saint-patron">Patron Of</Label>
                <Input id="saint-patron" className="mt-2" value={form.patron_of} onChange={(event) => updateForm("patron_of", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="saint-image-url">Image URL</Label>
                <Input id="saint-image-url" className="mt-2" value={form.image_url} onChange={(event) => updateForm("image_url", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="saint-image-file">Upload Image</Label>
                <Input id="saint-image-file" className="mt-2" type="file" accept="image/*" onChange={handleImageChange} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="saint-theme">Color Theme</Label>
                <Input id="saint-theme" className="mt-2" placeholder="Optional, e.g. gold, blue, rose" value={form.color_theme} onChange={(event) => updateForm("color_theme", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="saint-rank">Liturgical Rank</Label>
                <Input id="saint-rank" className="mt-2" placeholder="Memorial, Feast, Solemnity" value={form.liturgical_rank} onChange={(event) => updateForm("liturgical_rank", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="saint-scripture">Scripture Reference</Label>
                <Input id="saint-scripture" className="mt-2" placeholder="Matthew 16:13-19" value={form.scripture_reference} onChange={(event) => updateForm("scripture_reference", event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="saint-tags">Tags</Label>
                <Input id="saint-tags" className="mt-2" placeholder="apostle, martyr, patron" value={form.tags} onChange={(event) => updateForm("tags", event.target.value)} />
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <Label htmlFor="saint-short">Short Biography</Label>
                <Textarea id="saint-short" className="mt-2 min-h-24" required value={form.biography_short} onChange={(event) => updateForm("biography_short", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="saint-long">Full Biography</Label>
                <Textarea id="saint-long" className="mt-2 min-h-32" required value={form.biography_long} onChange={(event) => updateForm("biography_long", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="saint-quote">Quote</Label>
                <Textarea id="saint-quote" className="mt-2" value={form.quote} onChange={(event) => updateForm("quote", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="saint-reflection">Reflection</Label>
                <Textarea id="saint-reflection" className="mt-2 min-h-24" required value={form.reflection} onChange={(event) => updateForm("reflection", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="saint-prayer">Prayer</Label>
                <Textarea id="saint-prayer" className="mt-2 min-h-24" required value={form.prayer} onChange={(event) => updateForm("prayer", event.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-medium text-foreground">Active</p>
                <p className="text-sm text-muted-foreground">Active saints can appear in member-facing content.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(checked) => updateForm("is_active", checked)} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-medium text-foreground">Featured</p>
                <p className="text-sm text-muted-foreground">Featured saints are prioritized when multiple saints share a feast day.</p>
              </div>
              <Switch checked={form.is_featured} onCheckedChange={(checked) => updateForm("is_featured", checked)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                {editingSaint ? "Save Changes" : "Create Saint"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewSaint} onOpenChange={(open) => !open && setPreviewSaint(null)}>
        <DialogContent className="max-w-3xl">
          {previewSaint ? (
            <>
              <DialogHeader>
                <DialogTitle>{previewSaint.name}</DialogTitle>
                <DialogDescription>
                  {previewSaint.title || "Saint"} - Feast Day {formatFeast(previewSaint.feast_month, previewSaint.feast_day)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row">
                  {previewSaint.image_url ? (
                    <img
                      src={previewSaint.image_url}
                      alt={previewSaint.name}
                      loading="lazy"
                      decoding="async"
                      className="h-40 w-full rounded-2xl object-cover sm:w-48"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center rounded-2xl bg-primary/10 text-primary sm:w-48">
                      <BookOpen className="h-10 w-10" />
                    </div>
                  )}
                  <div className="space-y-3">
                    <Badge variant="outline">{previewSaint.is_active ? "Active" : "Archived"}</Badge>
                    <p className="text-sm leading-6 text-muted-foreground">{previewSaint.biography_short}</p>
                    {previewSaint.patron_of ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Patron of:</span> {previewSaint.patron_of}
                      </p>
                    ) : null}
                    {previewSaint.liturgical_rank ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Rank:</span> {previewSaint.liturgical_rank}
                      </p>
                    ) : null}
                    {previewSaint.scripture_reference ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Scripture:</span> {previewSaint.scripture_reference}
                      </p>
                    ) : null}
                    {previewSaint.tags?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {previewSaint.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                {previewSaint.quote ? (
                  <blockquote className="rounded-2xl border-l-4 border-primary bg-primary/5 p-4 text-sm italic text-foreground">
                    "{previewSaint.quote}"
                  </blockquote>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold text-foreground">Reflection</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{previewSaint.reflection}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Prayer</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{previewSaint.prayer}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Full Biography</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{previewSaint.biography_long}</p>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
