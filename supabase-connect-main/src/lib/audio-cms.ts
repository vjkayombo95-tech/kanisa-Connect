import { supabase } from "@/integrations/supabase/client";

export const AUDIO_CONTENT_TYPES = [
  { value: "bible", label: "Bible" },
  { value: "readings", label: "Daily Readings" },
  { value: "saints", label: "Saints" },
  { value: "catechism", label: "Catechism" },
  { value: "homilies", label: "Homilies" },
] as const;

export type AudioContentType = (typeof AUDIO_CONTENT_TYPES)[number]["value"];

export type AudioJobStatus =
  | "draft"
  | "uploading"
  | "validating"
  | "queued"
  | "processing"
  | "needs_review"
  | "completed"
  | "approved"
  | "published"
  | "archived"
  | "failed"
  | "cancelled"
  | "DRAFT"
  | "UPLOADING"
  | "QUEUED"
  | "VALIDATING"
  | "TRANSCRIBING"
  | "ALIGNING"
  | "BUILDING_INDEX"
  | "VALIDATING_INDEX"
  | "COMPLETED"
  | "FAILED"
  | "REVIEW_REQUIRED"
  | "CANCELLED";

export type AudioProcessingStage =
  | "QUEUED"
  | "VALIDATING"
  | "TRANSCRIBING"
  | "ALIGNING"
  | "BUILDING_INDEX"
  | "VALIDATING_INDEX"
  | "COMPLETED"
  | "FAILED"
  | "REVIEW_REQUIRED";

export const AUDIO_PROCESSING_STAGES: Array<{ status: AudioProcessingStage; label: string; progress: number }> = [
  { status: "QUEUED", label: "Queued", progress: 5 },
  { status: "VALIDATING", label: "Validating audio", progress: 15 },
  { status: "TRANSCRIBING", label: "Transcribing", progress: 35 },
  { status: "ALIGNING", label: "Aligning words", progress: 55 },
  { status: "BUILDING_INDEX", label: "Building verse index", progress: 75 },
  { status: "VALIDATING_INDEX", label: "Validating index", progress: 90 },
  { status: "COMPLETED", label: "Completed", progress: 100 },
];

export type AudioJob = {
  id: string;
  church_id: string;
  created_by: string | null;
  content_type: AudioContentType;
  book: string;
  chapter: number;
  status: AudioJobStatus;
  processing_stage: string;
  progress: number;
  audio_url: string | null;
  text_url: string | null;
  index_url: string | null;
  report_url: string | null;
  manifest_url: string | null;
  error_message?: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AudioAsset = {
  id: string;
  church_id: string;
  job_id: string;
  created_by: string | null;
  asset_type: "audio" | "text" | "transcript" | "alignment" | "index" | "report" | "manifest";
  storage_bucket: string;
  storage_path: string;
  public_url: string | null;
  content_type: string | null;
  file_name: string | null;
  file_size: number | null;
  checksum_sha256: string | null;
  status: string;
  processing_stage: string;
  progress: number;
  created_at: string;
  updated_at: string;
};

export type AudioJobLog = {
  id: string;
  church_id: string;
  job_id: string;
  level: "debug" | "info" | "warning" | "error";
  stage: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AudioReviewStatus = "pending" | "approved" | "rejected" | "needs_reprocessing" | "changes_requested";

export type AudioReview = {
  id: string;
  church_id: string;
  job_id: string;
  created_by: string | null;
  reviewer_id: string | null;
  status: AudioReviewStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AudioVerseReview = {
  id: string;
  church_id: string;
  job_id: string;
  review_id: string | null;
  verse_number: number;
  verse_text: string;
  start_time: number;
  end_time: number;
  duration: number;
  confidence: number;
  status: "pending" | "approved" | "flagged" | "edited";
  notes: string | null;
  manually_edited: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AudioReviewAudit = {
  id: string;
  church_id: string;
  job_id: string;
  review_id: string | null;
  verse_review_id: string | null;
  reviewer_id: string | null;
  action: string;
  reason: string | null;
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  created_at: string;
};

export type AudioVersion = {
  id: string;
  church_id: string;
  job_id: string;
  created_by: string | null;
  version_number: number;
  status: string;
  audio_url: string | null;
  text_url: string | null;
  index_url: string | null;
  report_url: string | null;
  manifest_url: string | null;
  created_at: string;
};

export type AudioVersionVerse = {
  id: string;
  version_id: string;
  job_id: string;
  verse_number: number;
  verse_text: string;
  start_time: number;
  end_time: number;
  duration: number;
  confidence: number;
  notes: string | null;
  manually_edited: boolean;
};

export type AudioJobInput = {
  churchId: string;
  userId: string;
  contentType: AudioContentType;
  book: string;
  chapter: number;
};

export type AudioUploadResult = {
  storagePath: string;
};

export type AudioJobsPageInput = {
  churchId: string;
  search?: string;
  status?: AudioJobStatus | "all";
  sortAsc?: boolean;
  page?: number;
  pageSize?: number;
};

export type AudioJobsPageResult = {
  jobs: AudioJob[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type AudioDashboardSummary = {
  processing: number;
  completed: number;
  needsReview: number;
  published: number;
  failed: number;
  recentJobs: AudioJob[];
};

type AudioJobRpcRow = AudioJob & { total_count?: number | string | null };

export async function listAudioJobs(input: AudioJobsPageInput): Promise<AudioJobsPageResult> {
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const { data, error } = await supabase.rpc("list_audio_jobs_page" as never, {
    _church_id: input.churchId,
    _search: input.search?.trim() || null,
    _status: input.status && input.status !== "all" ? input.status : null,
    _sort_asc: !!input.sortAsc,
    _limit: pageSize,
    _offset: (page - 1) * pageSize,
  } as never);

  if (error) throw error;
  const rows = (data ?? []) as unknown as AudioJobRpcRow[];
  return {
    jobs: rows.map(({ total_count, ...job }) => job),
    totalCount: Number(rows[0]?.total_count ?? 0),
    page,
    pageSize,
  };
}

export async function getAudioDashboardSummary(churchId: string): Promise<AudioDashboardSummary> {
  const { data, error } = await supabase.rpc("get_audio_dashboard_summary" as never, {
    _church_id: churchId,
    _recent_limit: 6,
  } as never);

  if (error) throw error;
  const summary = (data ?? {}) as Partial<AudioDashboardSummary>;
  return {
    processing: Number(summary.processing ?? 0),
    completed: Number(summary.completed ?? 0),
    needsReview: Number(summary.needsReview ?? 0),
    published: Number(summary.published ?? 0),
    failed: Number(summary.failed ?? 0),
    recentJobs: (summary.recentJobs ?? []) as AudioJob[],
  };
}

export async function getAudioJob(jobId: string): Promise<AudioJob | null> {
  const { data, error } = await supabase
    .from("audio_jobs" as never)
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as AudioJob | null;
}

export async function listAudioAssets(jobId: string): Promise<AudioAsset[]> {
  const { data, error } = await supabase
    .from("audio_assets" as never)
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as AudioAsset[];
}

export async function listAudioJobLogs(jobId: string): Promise<AudioJobLog[]> {
  const { data, error } = await supabase
    .from("audio_job_logs" as never)
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as AudioJobLog[];
}

export async function getOrCreateAudioReview(job: AudioJob, userId: string): Promise<AudioReview> {
  const { data: existing, error: existingError } = await supabase
    .from("audio_reviews" as never)
    .select("*")
    .eq("job_id", job.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as unknown as AudioReview;

  const { data, error } = await supabase
    .from("audio_reviews" as never)
    .insert({
      church_id: job.church_id,
      job_id: job.id,
      created_by: userId,
      reviewer_id: userId,
      status: "pending",
      processing_stage: "review",
      progress: 0,
      audio_url: job.audio_url,
      text_url: job.text_url,
      index_url: job.index_url,
      report_url: job.report_url,
      manifest_url: job.manifest_url,
      started_at: new Date().toISOString(),
    } as never)
    .select("*")
    .single();

  if (error) throw error;
  await createAudioNotification(job, "Review assigned", `${job.book} ${job.chapter} is ready for review.`, "info");
  return data as unknown as AudioReview;
}

export async function listAudioVerseReviews(jobId: string): Promise<AudioVerseReview[]> {
  const { data, error } = await supabase
    .from("audio_verse_reviews" as never)
    .select("*")
    .eq("job_id", jobId)
    .order("verse_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as AudioVerseReview[];
}

export async function listAudioReviewAudit(jobId: string): Promise<AudioReviewAudit[]> {
  const { data, error } = await supabase
    .from("audio_review_audit" as never)
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as AudioReviewAudit[];
}

export async function saveAudioVerseReview(params: {
  job: AudioJob;
  reviewId: string | null;
  userId: string;
  verse: Omit<AudioVerseReview, "id" | "church_id" | "job_id" | "review_id" | "created_by" | "updated_by" | "created_at" | "updated_at">;
  reason?: string;
}): Promise<AudioVerseReview> {
  const { data, error } = await supabase.rpc("save_audio_verse_review" as never, {
    _job_id: params.job.id,
    _review_id: params.reviewId,
    _verse_number: params.verse.verse_number,
    _verse_text: params.verse.verse_text,
    _start_time: params.verse.start_time,
    _end_time: params.verse.end_time,
    _confidence: params.verse.confidence,
    _notes: params.reason || params.verse.notes,
  } as never);

  if (error) throw error;
  return data as unknown as AudioVerseReview;
}

async function getAudioVerseReview(jobId: string, verseNumber: number): Promise<AudioVerseReview | null> {
  const { data, error } = await supabase
    .from("audio_verse_reviews" as never)
    .select("*")
    .eq("job_id", jobId)
    .eq("verse_number", verseNumber)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as AudioVerseReview | null;
}

export async function createAudioJob(input: AudioJobInput): Promise<AudioJob> {
  const { data, error } = await supabase.rpc("create_audio_job_draft" as never, {
    _church_id: input.churchId,
    _content_type: input.contentType,
    _book: input.book,
    _chapter: input.chapter,
  } as never);

  if (error) throw error;
  return data as unknown as AudioJob;
}

export async function uploadAudioAsset(params: {
  churchId: string;
  jobId: string;
  userId: string;
  bucket: "audio" | "audio-reports" | "audio-indexes" | "audio-transcripts" | "audio-alignments";
  assetType: "audio" | "text" | "transcript" | "alignment" | "index" | "report" | "manifest";
  file: File;
}): Promise<AudioUploadResult> {
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${params.churchId}/${params.jobId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(params.bucket)
    .upload(storagePath, params.file, { upsert: true, contentType: params.file.type || undefined });

  if (uploadError) throw uploadError;

  const { error: assetError } = await supabase.rpc("register_audio_asset" as never, {
    _job_id: params.jobId,
    _asset_type: params.assetType,
    _storage_bucket: params.bucket,
    _storage_path: storagePath,
    _content_type: params.file.type || null,
    _file_name: params.file.name,
    _file_size: params.file.size,
  } as never);

  if (assetError) throw assetError;
  return { storagePath };
}

export async function updateAudioJobProgress(
  jobId: string,
  updates: Partial<Pick<AudioJob, "status" | "processing_stage" | "progress" | "audio_url" | "text_url" | "index_url" | "report_url" | "manifest_url" | "started_at" | "completed_at" | "error_message">>,
): Promise<void> {
  void jobId;
  void updates;
  throw new Error("Audio job execution fields are worker-controlled. Use retry, cancel, enqueue, or the trusted worker API.");
}

export async function startAudioProcessing(jobId: string): Promise<void> {
  const { error } = await supabase.rpc("enqueue_audio_job" as never, { _job_id: jobId } as never);
  if (error) throw error;
}

export async function retryAudioJob(jobId: string): Promise<void> {
  const { error } = await supabase.rpc("retry_audio_job" as never, { _job_id: jobId } as never);
  if (error) throw error;
}

export async function requestAudioReprocessing(job: AudioJob, userId: string, reason: string): Promise<void> {
  const review = await getOrCreateAudioReview(job, userId);
  await updateAudioReviewStatus({ job, reviewId: review.id, userId, status: "needs_reprocessing", reason });
  await retryAudioJob(job.id);
}

export async function cancelAudioJob(jobId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_audio_job" as never, { _job_id: jobId } as never);
  if (error) throw error;
}

export async function completeAudioStage(jobId: string, stage: AudioProcessingStage, extraUpdates: Partial<AudioJob> = {}): Promise<void> {
  void jobId;
  void stage;
  void extraUpdates;
  throw new Error("Audio stage advancement requires the trusted audio-worker endpoint.");
}

export async function readAudioReport(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("audio-reports").download(path);
  if (error) throw error;
  return data.text();
}

export async function readAudioManifest(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("audio-reports").download(path);
  if (error) throw error;
  return data.text();
}

export async function readAudioIndex(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("audio-indexes").download(path);
  if (error) throw error;
  return data.text();
}

export async function getAudioPlaybackUrl(pathOrUrl: string | null): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const { data, error } = await supabase.storage.from("audio").createSignedUrl(pathOrUrl, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}

export async function listAudioVersions(jobId: string): Promise<AudioVersion[]> {
  const { data, error } = await supabase
    .from("audio_versions" as never)
    .select("*")
    .eq("job_id", jobId)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as AudioVersion[];
}

export async function listAudioVersionVerses(versionId: string): Promise<AudioVersionVerse[]> {
  const { data, error } = await supabase
    .from("audio_version_verses" as never)
    .select("*")
    .eq("version_id", versionId)
    .order("verse_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as AudioVersionVerse[];
}

export async function updateAudioReviewStatus(params: {
  job: AudioJob;
  reviewId: string;
  userId: string;
  status: AudioReviewStatus;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc("update_audio_review_decision" as never, {
    _review_id: params.reviewId,
    _status: params.status,
    _reason: params.reason,
  } as never);
  if (error) throw error;
}

export async function approveAudioReview(params: {
  job: AudioJob;
  reviewId: string;
  userId: string;
  reason: string;
  verses: Array<Pick<AudioVerseReview, "verse_number" | "verse_text" | "start_time" | "end_time" | "duration" | "confidence" | "notes" | "manually_edited">>;
}): Promise<AudioVersion> {
  for (const verse of params.verses) {
    await saveAudioVerseReview({
      job: params.job,
      reviewId: params.reviewId,
      userId: params.userId,
      verse: { ...verse, status: "edited" },
      reason: "Approval timing snapshot.",
    });
  }

  const { data, error } = await supabase.rpc("approve_audio_review" as never, {
    _review_id: params.reviewId,
    _reason: params.reason,
  } as never);
  if (error) throw error;
  return data as unknown as AudioVersion;
}

export async function writeAudioReviewAudit(params: {
  job: AudioJob;
  reviewId: string | null;
  verseReviewId?: string | null;
  reviewerId: string;
  action: string;
  reason?: string;
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("audio_review_audit" as never).insert({
    church_id: params.job.church_id,
    job_id: params.job.id,
    review_id: params.reviewId,
    verse_review_id: params.verseReviewId ?? null,
    reviewer_id: params.reviewerId,
    action: params.action,
    reason: params.reason ?? null,
    previous_values: params.previousValues,
    new_values: params.newValues,
  } as never);
  if (error) throw error;
}

export async function createAudioNotification(job: AudioJob, title: string, message: string, type: "info" | "warning" | "success" | "error"): Promise<void> {
  if (!job.created_by) return;
  const { error } = await supabase.from("notifications" as never).insert({
    church_id: job.church_id,
    user_id: job.created_by,
    title,
    message,
    type,
  } as never);
  if (error) throw error;
}

export function statusLabel(status: AudioJobStatus) {
  return status.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isActiveAudioStatus(status: AudioJobStatus) {
  return ["queued", "processing", "QUEUED", "VALIDATING", "TRANSCRIBING", "ALIGNING", "BUILDING_INDEX", "VALIDATING_INDEX"].includes(status);
}

export function isCompletedAudioStatus(status: AudioJobStatus) {
  return status === "completed" || status === "COMPLETED";
}

export function isFailedAudioStatus(status: AudioJobStatus) {
  return status === "failed" || status === "FAILED";
}

export function isReviewAudioStatus(status: AudioJobStatus) {
  return status === "needs_review" || status === "REVIEW_REQUIRED";
}
