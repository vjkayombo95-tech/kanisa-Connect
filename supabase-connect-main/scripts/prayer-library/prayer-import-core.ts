export const PRAYER_WORKBOOK_HEADERS = [
  "Prayer Code", "Slug", "Title", "Parent Prayer Code", "Parent Title", "Prayer Type",
  "Category", "Category Slug", "Sort Order", "Language", "Translation Key", "Translation Group ID", "Summary", "Prayer Body",
  "Status", "Visibility", "Featured", "Recommended Time", "Scripture Reference",
  "Liturgical Season", "Audio URL", "Author", "Source", "Content Edition", "Content Version",
  "Source Type", "Source Title", "Source Organization", "Source Reference", "Source URL", "Source Notes",
  "Copyright Holder", "Copyright Notice", "License Type", "License Reference", "Reviewed By",
  "Review Date", "Ecclesial Approval Status", "Ecclesial Approval Authority", "Ecclesial Approval Reference", "Import Notes",
] as const;

export const READ_ONLY_HEADERS = [
  "Prayer Code", "Slug", "Translation Key", "Translation Group ID", "Parent Prayer Code", "Prayer Type", "Category Slug", "Sort Order",
] as const;

export const REQUIRED_HEADERS = ["Prayer Code", "Slug", "Title", "Category", "Language", "Status"] as const;
export const FORBIDDEN_HEADERS = ["church_id", "created_by", "updated_by", "is_global", "parent_prayer_id"] as const;
export const WORKBOOK_STATUSES = ["draft", "review", "published", "archived"] as const;
export const WORKBOOK_VISIBILITIES = ["member", "admin", "private"] as const;
export const APPROVAL_STATUSES = ["pending", "under_review", "approved", "rejected", "revision_required"] as const;
export const SOURCE_TYPES = ["roman_missal", "catechism", "bishops_conference", "diocesan_publication", "parish_publication", "approved_prayer_book", "scripture", "public_domain", "original_parish_content", "user_submitted", "other"] as const;
export const LICENSE_TYPES = ["public_domain", "permission_granted", "licensed", "attribution_required", "internal_church_use", "copyright_restricted", "unknown"] as const;
export const WORKBOOK_LANGUAGES = ["sw", "en", "la"] as const;
export const ALLOWED_PARENT_TYPES = ["collection", "rosary", "stations_of_cross", "mass_collection"] as const;
export const APPROVED_STAGING_PROJECT_REF = "nunfrjcuimaytydnaqtt";
export const PRODUCTION_PROJECT_REF = "cbaxiiqlzrwvmuplhusm";

export function assertApprovedStagingRef(ref: string) {
  if (ref === PRODUCTION_PROJECT_REF) throw new Error("Production project reference is forbidden.");
  if (ref !== APPROVED_STAGING_PROJECT_REF) throw new Error("Project reference is not the approved staging project.");
}

export function assertStagingImportConfirmation(args: string[]) {
  if (!args.includes("--confirm-staging-import")) throw new Error("Actual import requires --confirm-staging-import.");
}

export type PrayerCatalogRecord = {
  id: string;
  prayer_code: string | null;
  slug: string;
  title: string;
  parent_prayer_id: string | null;
  prayer_type: string;
  category_id: string | null;
  language_id: string | null;
  sort_order: number;
  summary: string | null;
  body: string | null;
  status: string;
  visibility: string;
  featured: boolean;
  recommended_time: string | null;
  scripture_reference: string | null;
  liturgical_season: string | null;
  audio_url: string | null;
  author: string | null;
  source: string | null;
  source_title: string | null;
  source_type: string | null;
  source_organization: string | null;
  source_reference: string | null;
  source_url: string | null;
  source_notes: string | null;
  copyright_holder: string | null;
  copyright_notice: string | null;
  license_type: string | null;
  license_reference: string | null;
  content_edition: string | null;
  content_version_label: string | null;
  ecclesial_approval_status: string;
  ecclesial_approval_authority: string | null;
  ecclesial_approval_reference: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  translation_group_id: string;
  translation_key: string | null;
  metadata: Record<string, unknown> | null;
  is_global: boolean;
  church_id: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PrayerReferenceData = {
  categories: Array<{ id: string; name: string; slug: string }>;
  languages: Array<{ id: string; code: string; name: string }>;
};

export type PrayerWorkbookRow = Record<(typeof PRAYER_WORKBOOK_HEADERS)[number], string | number | boolean> & {
  __rowNumber: number;
};

export type PrayerImportError = {
  rowNumber: number;
  prayerCode: string;
  title: string;
  field: string;
  message: string;
  code: string;
};

export type PrayerImportChange = {
  rowNumber: number;
  prayerCode: string;
  title: string;
  recordId: string;
  changedFields: string[];
  next: PrayerCatalogRecord;
};

export type PrayerImportPlan = {
  totalWorkbookRows: number;
  matchedRecords: number;
  unchangedRecords: number;
  recordsThatWouldUpdate: number;
  bodiesThatWouldUpdate: number;
  summariesThatWouldUpdate: number;
  statusChanges: number;
  recordsThatWouldPublish: number;
  validationFailures: number;
  duplicateIdentifiers: number;
  unknownIdentifiers: number;
  parentChildValidationErrors: number;
  provenanceFieldUpdates: number;
  licenseValidationFailures: number;
  translationGroupValidationFailures: number;
  contentVersionLabelChanges: number;
  approvalChanges: number;
  sourceChanges: number;
  copyrightChanges: number;
  potentialPublicationBlockers: number;
  versionRecordsThatWouldBeCreated: number;
  errors: PrayerImportError[];
  changes: PrayerImportChange[];
  matchedIds: string[];
  forceDraft: boolean;
};

export type PrayerPlanOptions = { forceDraft?: boolean; allowReviewedPublish?: boolean };

export function cellText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizedHeader(value: unknown) {
  return cellText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function validateWorkbookHeaders(headers: string[]) {
  const missing = PRAYER_WORKBOOK_HEADERS.filter((header) => !headers.includes(header));
  const forbiddenKeys = new Set(FORBIDDEN_HEADERS.map(normalizedHeader));
  const forbidden = headers.filter((header) => forbiddenKeys.has(normalizedHeader(header)));
  return { missing, forbidden };
}

function normalizedKey(value: unknown) {
  return cellText(value).toLowerCase();
}

function isBlank(value: unknown) {
  return cellText(value) === "";
}

function parseBoolean(value: unknown) {
  const normalized = normalizedKey(value);
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return null;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function matchPrayerRecord(
  row: Pick<PrayerWorkbookRow, "Prayer Code" | "Slug">,
  catalog: PrayerCatalogRecord[],
) {
  const code = normalizedKey(row["Prayer Code"]);
  const slug = normalizedKey(row.Slug);
  if (code) return catalog.find((record) => normalizedKey(record.prayer_code) === code) ?? null;
  if (slug) return catalog.find((record) => normalizedKey(record.slug) === slug) ?? null;
  return null;
}

function addError(
  errors: PrayerImportError[],
  row: PrayerWorkbookRow,
  field: string,
  message: string,
  code: string,
) {
  errors.push({
    rowNumber: row.__rowNumber,
    prayerCode: cellText(row["Prayer Code"]),
    title: cellText(row.Title),
    field,
    message,
    code,
  });
}

function replaceIfProvided<T extends keyof PrayerCatalogRecord>(
  next: PrayerCatalogRecord,
  field: T,
  value: PrayerCatalogRecord[T],
  provided: boolean,
  changedFields: string[],
) {
  if (!provided || Object.is(next[field], value)) return;
  next[field] = value;
  changedFields.push(String(field));
}

export function buildPrayerImportPlan(
  rows: PrayerWorkbookRow[],
  catalog: PrayerCatalogRecord[],
  reference: PrayerReferenceData,
  options: PrayerPlanOptions = {},
): PrayerImportPlan {
  const forceDraft = options.forceDraft !== false && !options.allowReviewedPublish;
  const errors: PrayerImportError[] = [];
  const changes: PrayerImportChange[] = [];
  const matchedIds = new Set<string>();
  const seenCodes = new Set<string>();
  const seenSlugs = new Set<string>();
  const seenTranslationLanguages = new Set<string>();
  const byId = new Map(catalog.map((record) => [record.id, record]));
  const categoryById = new Map(reference.categories.map((item) => [item.id, item]));
  const categoryLookup = new Map<string, (typeof reference.categories)[number]>();
  reference.categories.forEach((item) => [item.id, item.name, item.slug].forEach((key) => categoryLookup.set(normalizedKey(key), item)));
  const languageLookup = new Map<string, (typeof reference.languages)[number]>();
  reference.languages.forEach((item) => [item.id, item.name, item.code].forEach((key) => languageLookup.set(normalizedKey(key), item)));

  for (const row of rows) {
    const code = normalizedKey(row["Prayer Code"]);
    const slug = normalizedKey(row.Slug);
    const title = cellText(row.Title);

    for (const header of REQUIRED_HEADERS) {
      if (isBlank(row[header])) addError(errors, row, header, `${header} is required.`, "required");
    }
    if (code && seenCodes.has(code)) addError(errors, row, "Prayer Code", "Duplicate Prayer Code in this workbook.", "duplicate_prayer_code");
    if (slug && seenSlugs.has(slug)) addError(errors, row, "Slug", "Duplicate Slug in this workbook.", "duplicate_slug");
    if (code) seenCodes.add(code);
    if (slug) seenSlugs.add(slug);

    const record = matchPrayerRecord(row, catalog);
    if (!record) {
      addError(errors, row, "Prayer Code", code ? "Unknown Prayer Code; creation mode is disabled." : "No record matched the supplied identifiers.", code ? "unknown_prayer_code" : "unknown_identifier");
      continue;
    }
    if (code && normalizedKey(record.prayer_code) !== code) {
      addError(errors, row, "Prayer Code", "Unknown Prayer Code; slug fallback cannot override a supplied code.", "unknown_prayer_code");
      continue;
    }
    matchedIds.add(record.id);

    if (slug !== normalizedKey(record.slug)) addError(errors, row, "Slug", `Slug must remain ${record.slug}.`, "identity_mismatch");
    if (cellText(row["Translation Key"]) !== cellText(record.translation_key)) addError(errors, row, "Translation Key", "Translation Key is immutable for an existing record.", "translation_key_immutable");
    if (cellText(row["Translation Group ID"]).toLowerCase() !== cellText(record.translation_group_id).toLowerCase()) addError(errors, row, "Translation Group ID", "Translation Group ID is immutable for an existing record.", "translation_group_immutable");
    if (cellText(row["Prayer Type"]) !== record.prayer_type) addError(errors, row, "Prayer Type", `Prayer Type must remain ${record.prayer_type}.`, "identity_mismatch");
    const currentCategory = record.category_id ? categoryById.get(record.category_id) : null;
    if (currentCategory && normalizedKey(row["Category Slug"]) !== normalizedKey(currentCategory.slug)) {
      addError(errors, row, "Category Slug", `Category Slug must remain ${currentCategory.slug}.`, "identity_mismatch");
    }
    const sortOrder = Number(row["Sort Order"]);
    if (!Number.isFinite(sortOrder) || sortOrder !== record.sort_order) addError(errors, row, "Sort Order", `Sort Order must remain ${record.sort_order}.`, "identity_mismatch");

    const expectedParent = record.parent_prayer_id ? byId.get(record.parent_prayer_id) : null;
    const parentCode = normalizedKey(row["Parent Prayer Code"]);
    if (parentCode !== normalizedKey(expectedParent?.prayer_code)) addError(errors, row, "Parent Prayer Code", "Parent Prayer Code does not match the validated database relationship.", "parent_mismatch");
    if (expectedParent && !ALLOWED_PARENT_TYPES.includes(expectedParent.prayer_type as never)) addError(errors, row, "Parent Prayer Code", "Parent is not an allowed structured collection type.", "invalid_parent_type");
    if (expectedParent && (expectedParent.is_global !== record.is_global || expectedParent.church_id !== record.church_id)) addError(errors, row, "Parent Prayer Code", "Parent and child ownership do not match.", "parent_ownership_mismatch");

    const category = categoryLookup.get(normalizedKey(row.Category));
    if (!category) addError(errors, row, "Category", `Unknown category: ${cellText(row.Category)}.`, "unknown_category");
    const language = languageLookup.get(normalizedKey(row.Language));
    if (!language || !WORKBOOK_LANGUAGES.includes(normalizedKey(row.Language) as never)) addError(errors, row, "Language", `Unsupported language: ${cellText(row.Language)}.`, "unknown_language");
    if (language) {
      const familyId = record.translation_group_id || record.id;
      const familyLanguage = `${familyId}:${language.id}`;
      if (seenTranslationLanguages.has(familyLanguage)) addError(errors, row, "Language", "A translation family can contain only one record per language.", "duplicate_group_language");
      seenTranslationLanguages.add(familyLanguage);
      const conflicts = catalog.filter((candidate) => candidate.id !== record.id && (candidate.translation_group_id || candidate.id) === familyId && candidate.language_id === language.id);
      if (conflicts.length) addError(errors, row, "Language", "This translation family already contains that language.", "duplicate_group_language");
      const incompatible = catalog.filter((candidate) => candidate.id !== record.id && (candidate.translation_group_id || candidate.id) === familyId && (candidate.prayer_type !== record.prayer_type || candidate.is_global !== record.is_global || candidate.church_id !== record.church_id));
      if (incompatible.length) addError(errors, row, "Translation Group ID", "Translation family crosses incompatible type or tenant ownership.", "translation_family_incompatible");
    }
    const status = normalizedKey(row.Status);
    if (!WORKBOOK_STATUSES.includes(status as never)) addError(errors, row, "Status", `Status must be one of: ${WORKBOOK_STATUSES.join(", ")}.`, "invalid_status");
    if (forceDraft && status !== "draft") addError(errors, row, "Status", "The first staging import requires Status = draft.", "first_import_draft_required");
    const visibilityInput = normalizedKey(row.Visibility);
    if (!WORKBOOK_VISIBILITIES.includes(visibilityInput as never)) addError(errors, row, "Visibility", `Visibility must be one of: ${WORKBOOK_VISIBILITIES.join(", ")}.`, "invalid_visibility");
    const featured = parseBoolean(row.Featured);
    if (featured === null) addError(errors, row, "Featured", "Featured must be true or false.", "invalid_boolean");
    const approval = normalizedKey(row["Ecclesial Approval Status"] || "pending");
    if (!APPROVAL_STATUSES.includes(approval as never)) addError(errors, row, "Ecclesial Approval Status", "Unknown ecclesial approval status.", "invalid_approval_status");
    const reviewDate = cellText(row["Review Date"]);
    if (reviewDate && !isIsoDate(reviewDate)) addError(errors, row, "Review Date", "Review Date must use YYYY-MM-DD.", "invalid_review_date");
    const sourceType = normalizedKey(row["Source Type"]);
    if (sourceType && !SOURCE_TYPES.includes(sourceType as never)) addError(errors, row, "Source Type", "Unknown Source Type.", "invalid_source_type");
    const licenseType = normalizedKey(row["License Type"]);
    if (licenseType && !LICENSE_TYPES.includes(licenseType as never)) addError(errors, row, "License Type", "Unknown License Type.", "invalid_license_type");
    const approvalAuthority = cellText(row["Ecclesial Approval Authority"]) || cellText(record.ecclesial_approval_authority);
    const approvalReference = cellText(row["Ecclesial Approval Reference"]) || cellText(record.ecclesial_approval_reference);
    if (approval === "approved" && !approvalAuthority && !approvalReference) addError(errors, row, "Ecclesial Approval Authority", "Approved content requires an approval authority or reference.", "approval_evidence_required");

    const effectiveBody = cellText(row["Prayer Body"]) || cellText(record.body);
    const effectiveSource = cellText(row.Source) || cellText(record.source);
    const effectiveSourceType = sourceType || cellText(record.source_type);
    const effectiveSourceTitle = cellText(row["Source Title"]) || cellText(record.source_title);
    const effectiveSourceReference = cellText(row["Source Reference"]) || cellText(record.source_reference);
    const effectiveSourceNotes = cellText(row["Source Notes"]) || cellText(record.source_notes);
    const effectiveLicense = licenseType || cellText(record.license_type);
    const effectiveLicenseReference = cellText(row["License Reference"]) || cellText(record.license_reference);
    const effectiveReviewer = cellText(row["Reviewed By"]) || cellText(record.reviewed_by);
    const effectiveReviewDate = reviewDate || cellText(record.reviewed_at);
    const effectiveApproval = approval || cellText(record.ecclesial_approval_status);
    const effectiveEdition = cellText(row["Content Edition"]) || cellText(record.content_edition);
    const effectiveVersionLabel = cellText(row["Content Version"]) || cellText(record.content_version_label);
    if (status === "review") {
      if (!effectiveBody) addError(errors, row, "Prayer Body", "Prayer Body is required for review.", "review_body_required");
      if (!effectiveSource) addError(errors, row, "Source", "Source is required for review.", "review_source_required");
    }
    if (status === "published") {
      if (!effectiveBody) addError(errors, row, "Prayer Body", "Prayer Body is required for publication.", "publish_body_required");
      if (!effectiveSourceType) addError(errors, row, "Source Type", "Source Type is required for publication.", "publish_source_type_required");
      if (!effectiveSourceTitle && !effectiveSourceReference) addError(errors, row, "Source Title", "Source Title or Source Reference is required for publication.", "publish_traceable_source_required");
      if (!effectiveLicense || effectiveLicense === "unknown") addError(errors, row, "License Type", "A known License Type is required for publication.", "publish_license_required");
      if (!effectiveReviewer) addError(errors, row, "Reviewed By", "Reviewed By is required for publication.", "publish_reviewer_required");
      if (!effectiveReviewDate || !isIsoDate(effectiveReviewDate)) addError(errors, row, "Review Date", "A valid Review Date is required for publication.", "publish_review_date_required");
      if (effectiveApproval !== "approved") addError(errors, row, "Ecclesial Approval Status", "Ecclesial Approval Status must be approved for publication.", "publish_approval_required");
      if (!approvalAuthority && !approvalReference) addError(errors, row, "Ecclesial Approval Authority", "Approval authority or reference is required for publication.", "publish_approval_evidence_required");
      if (effectiveLicense === "public_domain" && !effectiveSourceReference && !effectiveSourceNotes) addError(errors, row, "Source Reference", "Public-domain content requires a source reference or notes explaining the basis.", "public_domain_basis_required");
      if (effectiveLicense === "copyright_restricted" && !effectiveLicenseReference) addError(errors, row, "License Reference", "Copyright-restricted content requires permission or license evidence.", "copyright_permission_required");
      if (["roman_missal", "catechism", "bishops_conference", "diocesan_publication", "parish_publication", "approved_prayer_book"].includes(effectiveSourceType) && !effectiveEdition && !effectiveVersionLabel) addError(errors, row, "Content Edition", "An edition or content version is required for this identifiable source.", "publish_edition_required");
    }

    if (errors.some((error) => error.rowNumber === row.__rowNumber)) continue;

    const next: PrayerCatalogRecord = { ...record, metadata: { ...(record.metadata ?? {}) } };
    const changedFields: string[] = [];
    replaceIfProvided(next, "title", title, true, changedFields);
    replaceIfProvided(next, "summary", cellText(row.Summary), !isBlank(row.Summary), changedFields);
    replaceIfProvided(next, "body", cellText(row["Prayer Body"]), !isBlank(row["Prayer Body"]), changedFields);
    replaceIfProvided(next, "category_id", category?.id ?? record.category_id, Boolean(category), changedFields);
    replaceIfProvided(next, "language_id", language?.id ?? record.language_id, Boolean(language), changedFields);
    const targetStatus = forceDraft ? "draft" : status;
    replaceIfProvided(next, "status", targetStatus, true, changedFields);
    const targetVisibility = visibilityInput === "private" ? "admin" : visibilityInput;
    replaceIfProvided(next, "visibility", targetVisibility, true, changedFields);
    replaceIfProvided(next, "featured", forceDraft ? false : Boolean(featured), true, changedFields);
    replaceIfProvided(next, "recommended_time", cellText(row["Recommended Time"]), !isBlank(row["Recommended Time"]), changedFields);
    replaceIfProvided(next, "scripture_reference", cellText(row["Scripture Reference"]), !isBlank(row["Scripture Reference"]), changedFields);
    replaceIfProvided(next, "liturgical_season", cellText(row["Liturgical Season"]), !isBlank(row["Liturgical Season"]), changedFields);
    replaceIfProvided(next, "audio_url", cellText(row["Audio URL"]), !isBlank(row["Audio URL"]), changedFields);
    replaceIfProvided(next, "author", cellText(row.Author), !isBlank(row.Author), changedFields);
    replaceIfProvided(next, "source", cellText(row.Source), !isBlank(row.Source), changedFields);

    const explicitFields: Array<[keyof PrayerCatalogRecord, (typeof PRAYER_WORKBOOK_HEADERS)[number]]> = [
      ["content_edition", "Content Edition"], ["content_version_label", "Content Version"],
      ["source_type", "Source Type"], ["source_title", "Source Title"], ["source_organization", "Source Organization"],
      ["source_reference", "Source Reference"], ["source_url", "Source URL"], ["source_notes", "Source Notes"],
      ["copyright_holder", "Copyright Holder"], ["copyright_notice", "Copyright Notice"],
      ["license_type", "License Type"], ["license_reference", "License Reference"],
      ["reviewed_by", "Reviewed By"], ["reviewed_at", "Review Date"],
      ["ecclesial_approval_status", "Ecclesial Approval Status"],
      ["ecclesial_approval_authority", "Ecclesial Approval Authority"], ["ecclesial_approval_reference", "Ecclesial Approval Reference"],
    ];
    for (const [field, header] of explicitFields) {
      const value = cellText(row[header]);
      if (!value) continue;
      replaceIfProvided(next, field, value as never, true, changedFields);
    }

    const metadataUpdates: Record<string, unknown> = {
      import_notes: row["Import Notes"],
    };
    for (const [field, raw] of Object.entries(metadataUpdates)) {
      const value = cellText(raw);
      if (field === "ecclesial_approval_status" && value === "pending" && changedFields.length === 0 && !next.metadata?.[field]) continue;
      if (!value || next.metadata?.[field] === value) continue;
      next.metadata = { ...(next.metadata ?? {}), [field]: value };
      changedFields.push(`metadata.${field}`);
    }

    if (changedFields.length) changes.push({ rowNumber: row.__rowNumber, prayerCode: code, title, recordId: record.id, changedFields, next });
  }

  const duplicateIdentifiers = errors.filter((error) => error.code.startsWith("duplicate_")).length;
  const unknownIdentifiers = errors.filter((error) => error.code.startsWith("unknown_")).length;
  const parentChildValidationErrors = errors.filter((error) => error.code.includes("parent")).length;
  const provenanceFields = new Set(["source_title", "source_type", "source_organization", "source_reference", "source_url", "source_notes", "license_type", "license_reference", "content_edition", "content_version_label", "ecclesial_approval_authority", "ecclesial_approval_reference", "reviewed_by", "reviewed_at"]);
  const sourceFields = new Set(["source", "source_title", "source_type", "source_organization", "source_reference", "source_url", "source_notes"]);
  const copyrightFields = new Set(["copyright_holder", "copyright_notice", "license_type", "license_reference"]);
  return {
    totalWorkbookRows: rows.length,
    matchedRecords: matchedIds.size,
    unchangedRecords: Math.max(0, matchedIds.size - changes.length),
    recordsThatWouldUpdate: changes.length,
    bodiesThatWouldUpdate: changes.filter((change) => change.changedFields.includes("body")).length,
    summariesThatWouldUpdate: changes.filter((change) => change.changedFields.includes("summary")).length,
    statusChanges: changes.filter((change) => change.changedFields.includes("status")).length,
    recordsThatWouldPublish: changes.filter((change) => change.next.status === "published").length,
    validationFailures: errors.length,
    duplicateIdentifiers,
    unknownIdentifiers,
    parentChildValidationErrors,
    provenanceFieldUpdates: changes.reduce((sum, change) => sum + change.changedFields.filter((field) => provenanceFields.has(field)).length, 0),
    licenseValidationFailures: errors.filter((error) => error.code.includes("license") || error.code.includes("copyright") || error.code.includes("public_domain")).length,
    translationGroupValidationFailures: errors.filter((error) => error.code.includes("translation") || error.code === "duplicate_group_language").length,
    contentVersionLabelChanges: changes.filter((change) => change.changedFields.includes("content_version_label")).length,
    approvalChanges: changes.filter((change) => change.changedFields.some((field) => field.startsWith("ecclesial_approval"))).length,
    sourceChanges: changes.filter((change) => change.changedFields.some((field) => sourceFields.has(field))).length,
    copyrightChanges: changes.filter((change) => change.changedFields.some((field) => copyrightFields.has(field))).length,
    potentialPublicationBlockers: errors.filter((error) => error.code.startsWith("publish_") || error.code.endsWith("_required")).length,
    versionRecordsThatWouldBeCreated: changes.length,
    errors,
    changes,
    matchedIds: [...matchedIds],
    forceDraft,
  };
}

export function safeDryRunReport(plan: PrayerImportPlan) {
  return {
    totalWorkbookRows: plan.totalWorkbookRows,
    matchedRecords: plan.matchedRecords,
    unchangedRecords: plan.unchangedRecords,
    recordsThatWouldUpdate: plan.recordsThatWouldUpdate,
    bodiesThatWouldUpdate: plan.bodiesThatWouldUpdate,
    summariesThatWouldUpdate: plan.summariesThatWouldUpdate,
    statusChanges: plan.statusChanges,
    recordsThatWouldPublish: plan.recordsThatWouldPublish,
    validationFailures: plan.validationFailures,
    duplicateIdentifiers: plan.duplicateIdentifiers,
    unknownIdentifiers: plan.unknownIdentifiers,
    parentChildValidationErrors: plan.parentChildValidationErrors,
    provenanceFieldUpdates: plan.provenanceFieldUpdates,
    licenseValidationFailures: plan.licenseValidationFailures,
    translationGroupValidationFailures: plan.translationGroupValidationFailures,
    contentVersionLabelChanges: plan.contentVersionLabelChanges,
    approvalChanges: plan.approvalChanges,
    sourceChanges: plan.sourceChanges,
    copyrightChanges: plan.copyrightChanges,
    potentialPublicationBlockers: plan.potentialPublicationBlockers,
    versionRecordsThatWouldBeCreated: plan.versionRecordsThatWouldBeCreated,
    forceDraft: plan.forceDraft,
    changes: plan.changes.map(({ rowNumber, prayerCode, title, changedFields }) => ({ rowNumber, prayerCode, title, changedFields })),
    errors: plan.errors,
  };
}
