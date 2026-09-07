import type {
  NormalizedDailyReadingSourcePayload,
  PreparedDailyReadingSource,
} from "./daily-readings-import-normalization";

export type DailyReadingImportContentStatus = "draft" | "review" | "published" | "featured" | "archived" | string;
export type DailyReadingImportContentVisibility = "public" | "member" | "pastoral" | "admin" | string;

export type ExistingDailyReadingForImportPlan = {
  id: string;
  reading_date: string;
  language_code: string;
  language_id?: string | null;
  source_key?: string | null;
  source_record_id?: string | null;
  source_version?: string | null;
  source_url?: string | null;
  last_imported_source_hash?: string | null;
  last_imported_source_payload?: NormalizedDailyReadingSourcePayload | null;
  status: DailyReadingImportContentStatus;
  visibility: DailyReadingImportContentVisibility;
  liturgical_year?: string | null;
  liturgical_season?: string | null;
  celebration?: string | null;
  liturgical_color?: string | null;
  first_reading_reference?: string | null;
  responsorial_psalm_reference?: string | null;
  second_reading_reference?: string | null;
  gospel_acclamation_reference?: string | null;
  gospel_reference?: string | null;
  source_attribution?: string | null;
};

export type DailyReadingImportPlannedContentValues = {
  reading_date: string;
  language_code: string;
  language_id: string | null;
  source_key: string;
  source_record_id: string;
  source_version: string | null;
  source_url: string | null;
  last_imported_source_hash: string;
  liturgical_year: string;
  liturgical_season: string;
  celebration: string;
  liturgical_color: string;
  first_reading_reference: string;
  responsorial_psalm_reference: string;
  second_reading_reference: string | null;
  gospel_acclamation_reference: string | null;
  gospel_reference: string;
  source_attribution: string;
};

export type DailyReadingImportDecisionKind =
  | "create_draft"
  | "skip_unchanged"
  | "update_draft_from_source"
  | "conflict_manual_drift"
  | "conflict_published_source_changed"
  | "conflict_date_language_source_collision"
  | "conflict_manual_content_collision";

export type DailyReadingImportLedgerStatus = "imported" | "skipped" | "conflict";

export type DailyReadingImportPlanningErrorCode =
  | "manual_drift"
  | "published_source_changed"
  | "date_language_collision"
  | "manual_content_collision";

export type DailyReadingImportPlan = {
  decision: DailyReadingImportDecisionKind;
  ledger_status: DailyReadingImportLedgerStatus;
  error_code: DailyReadingImportPlanningErrorCode | null;
  target_record_id: string | null;
  insert_values: (DailyReadingImportPlannedContentValues & { status: "draft"; visibility: "member" }) | null;
  update_values: DailyReadingImportPlannedContentValues | null;
  conflict_record_id: string | null;
  preserves_editorial_fields: true;
  auto_publish: false;
};

export type PlanDailyReadingImportInput = {
  source: PreparedDailyReadingSource;
  existing_by_source?: ExistingDailyReadingForImportPlan | null;
  existing_by_date_language?: ExistingDailyReadingForImportPlan | ExistingDailyReadingForImportPlan[] | null;
  language_id?: string | null;
};

const SOURCE_CONTROLLED_FIELDS: Array<keyof NormalizedDailyReadingSourcePayload> = [
  "source_key",
  "source_record_id",
  "source_version",
  "reading_date",
  "language_code",
  "liturgical_year",
  "liturgical_season",
  "celebration",
  "liturgical_color",
  "first_reading_reference",
  "responsorial_psalm_reference",
  "second_reading_reference",
  "gospel_acclamation_reference",
  "gospel_reference",
  "source_attribution",
];

function isPublished(status: DailyReadingImportContentStatus) {
  return status === "published" || status === "featured";
}

function sourceIdentityMatches(existing: ExistingDailyReadingForImportPlan, source: NormalizedDailyReadingSourcePayload) {
  return existing.source_key === source.source_key && existing.source_record_id === source.source_record_id;
}

function dateLanguageMatches(existing: ExistingDailyReadingForImportPlan, source: NormalizedDailyReadingSourcePayload) {
  return existing.reading_date === source.reading_date && existing.language_code === source.language_code;
}

function hasSourceIdentity(existing: ExistingDailyReadingForImportPlan) {
  return Boolean(existing.source_key && existing.source_record_id);
}

function toCollisionList(
  existing: ExistingDailyReadingForImportPlan | ExistingDailyReadingForImportPlan[] | null | undefined,
) {
  return (Array.isArray(existing) ? existing : [existing]).filter(Boolean) as ExistingDailyReadingForImportPlan[];
}

function findDateLanguageCollision(input: PlanDailyReadingImportInput) {
  const source = input.source.normalized_payload;
  return toCollisionList(input.existing_by_date_language).find((existing) => {
    if (!dateLanguageMatches(existing, source)) return false;
    if (input.existing_by_source && existing.id === input.existing_by_source.id) return false;
    return !sourceIdentityMatches(existing, source);
  });
}

function sourceFieldValue(value: string | null | undefined) {
  return value ?? null;
}

function currentSourcePayload(existing: ExistingDailyReadingForImportPlan): NormalizedDailyReadingSourcePayload {
  return {
    source_key: existing.source_key ?? "",
    source_record_id: existing.source_record_id ?? "",
    source_version: sourceFieldValue(existing.source_version),
    reading_date: existing.reading_date,
    language_code: existing.language_code,
    liturgical_year: sourceFieldValue(existing.liturgical_year),
    liturgical_season: sourceFieldValue(existing.liturgical_season),
    celebration: sourceFieldValue(existing.celebration),
    liturgical_color: sourceFieldValue(existing.liturgical_color),
    first_reading_reference: existing.first_reading_reference ?? "",
    responsorial_psalm_reference: existing.responsorial_psalm_reference ?? "",
    second_reading_reference: sourceFieldValue(existing.second_reading_reference),
    gospel_acclamation_reference: sourceFieldValue(existing.gospel_acclamation_reference),
    gospel_reference: existing.gospel_reference ?? "",
    source_attribution: existing.source_attribution ?? "",
  };
}

function hasManualDrift(existing: ExistingDailyReadingForImportPlan) {
  const last = existing.last_imported_source_payload;
  if (!last) return false;

  const current = currentSourcePayload(existing);
  return SOURCE_CONTROLLED_FIELDS.some((field) => current[field] !== last[field]);
}

function plannedValues(input: PlanDailyReadingImportInput): DailyReadingImportPlannedContentValues {
  const payload = input.source.normalized_payload;

  return {
    reading_date: payload.reading_date,
    language_code: payload.language_code,
    language_id: input.language_id ?? null,
    source_key: payload.source_key,
    source_record_id: payload.source_record_id,
    source_version: payload.source_version,
    source_url: input.source.source_url,
    last_imported_source_hash: input.source.source_hash,
    liturgical_year: payload.liturgical_year ?? "",
    liturgical_season: payload.liturgical_season ?? "",
    celebration: payload.celebration ?? "",
    liturgical_color: payload.liturgical_color ?? "",
    first_reading_reference: payload.first_reading_reference,
    responsorial_psalm_reference: payload.responsorial_psalm_reference,
    second_reading_reference: payload.second_reading_reference,
    gospel_acclamation_reference: payload.gospel_acclamation_reference,
    gospel_reference: payload.gospel_reference,
    source_attribution: payload.source_attribution,
  };
}

function plan(
  decision: DailyReadingImportDecisionKind,
  ledger_status: DailyReadingImportLedgerStatus,
  error_code: DailyReadingImportPlanningErrorCode | null,
  target_record_id: string | null,
  conflict_record_id: string | null,
  values?: DailyReadingImportPlannedContentValues,
): DailyReadingImportPlan {
  return {
    decision,
    ledger_status,
    error_code,
    target_record_id,
    insert_values: decision === "create_draft" && values ? { ...values, status: "draft", visibility: "member" } : null,
    update_values: decision === "update_draft_from_source" && values ? values : null,
    conflict_record_id,
    preserves_editorial_fields: true,
    auto_publish: false,
  };
}

export function planDailyReadingImport(input: PlanDailyReadingImportInput): DailyReadingImportPlan {
  const values = plannedValues(input);
  const existingBySource = input.existing_by_source;

  if (existingBySource) {
    if (hasManualDrift(existingBySource)) {
      return plan("conflict_manual_drift", "conflict", "manual_drift", existingBySource.id, existingBySource.id);
    }

    if (existingBySource.last_imported_source_hash === input.source.source_hash) {
      return plan("skip_unchanged", "skipped", null, existingBySource.id, null);
    }

    if (isPublished(existingBySource.status)) {
      return plan(
        "conflict_published_source_changed",
        "conflict",
        "published_source_changed",
        existingBySource.id,
        existingBySource.id,
      );
    }

    const collision = findDateLanguageCollision(input);
    if (collision) {
      return plan(
        "conflict_date_language_source_collision",
        "conflict",
        "date_language_collision",
        existingBySource.id,
        collision.id,
      );
    }

    return plan("update_draft_from_source", "imported", null, existingBySource.id, null, values);
  }

  const collision = findDateLanguageCollision(input);
  if (collision) {
    if (hasSourceIdentity(collision)) {
      return plan(
        "conflict_date_language_source_collision",
        "conflict",
        "date_language_collision",
        null,
        collision.id,
      );
    }

    return plan("conflict_manual_content_collision", "conflict", "manual_content_collision", null, collision.id);
  }

  return plan("create_draft", "imported", null, null, null, values);
}
