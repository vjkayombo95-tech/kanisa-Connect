import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  FileAudio,
  FileJson,
  FileText,
  Pencil,
  RotateCcw,
  XCircle,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AUDIO_PROCESSING_STAGES,
  approveAudioReview,
  getAudioJob,
  getAudioPlaybackUrl,
  getOrCreateAudioReview,
  isActiveAudioStatus,
  isFailedAudioStatus,
  listAudioAssets,
  listAudioJobLogs,
  listAudioReviewAudit,
  listAudioVerseReviews,
  listAudioVersionVerses,
  listAudioVersions,
  readAudioIndex,
  readAudioManifest,
  readAudioReport,
  requestAudioReprocessing,
  saveAudioVerseReview,
  updateAudioReviewStatus,
  type AudioReviewStatus,
  type AudioVerseReview,
} from "@/lib/audio-cms";
import { cn } from "@/lib/utils";
import { AudioMetricCard, AudioPageSkeleton, AudioStatusBadge, EmptyAudioState } from "./AudioCmsShared";

type VerseRow = Omit<AudioVerseReview, "id" | "church_id" | "job_id" | "review_id" | "created_by" | "updated_by" | "created_at" | "updated_at"> & {
  id?: string;
};

const LOW_CONFIDENCE = 0.9;
const ALL = "all";
const VERSE_ROW_HEIGHT = 64;
const VERSE_OVERSCAN = 6;

export default function AudioReviewPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<typeof ALL | "low" | "edited" | "flagged">(ALL);
  const [sort, setSort] = useState<"verse" | "confidence" | "duration">("verse");
  const [editingVerse, setEditingVerse] = useState<VerseRow | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [decisionReason, setDecisionReason] = useState("");
  const [compareVersionId, setCompareVersionId] = useState<string>("");
  const [verseScrollTop, setVerseScrollTop] = useState(0);
  const [usePollingFallback, setUsePollingFallback] = useState(false);
  const [requestedArtifacts, setRequestedArtifacts] = useState({ index: false, report: false, manifest: false });

  const { data: job, isLoading } = useQuery({
    queryKey: ["audio-job", id],
    queryFn: () => (id ? getAudioJob(id) : Promise.resolve(null)),
    enabled: !!id,
    refetchInterval: usePollingFallback ? 15000 : false,
  });

  useEffect(() => {
    if (!id) return undefined;
    setUsePollingFallback(false);
    const channel = supabase
      .channel(`audio-job-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audio_jobs", filter: `id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ["audio-job", id] }),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setUsePollingFallback(false);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setUsePollingFallback(true);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);
  const { data: review } = useQuery({
    queryKey: ["audio-review", job?.id, user?.id],
    queryFn: () => (job && user?.id ? getOrCreateAudioReview(job, user.id) : Promise.resolve(null)),
    enabled: !!job && !!user?.id,
  });
  const { data: assets = [] } = useQuery({
    queryKey: ["audio-assets", id],
    queryFn: () => (id ? listAudioAssets(id) : Promise.resolve([])),
    enabled: !!id,
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["audio-job-logs", id],
    queryFn: () => (id ? listAudioJobLogs(id) : Promise.resolve([])),
    enabled: !!id,
  });
  const { data: savedVerses = [] } = useQuery({
    queryKey: ["audio-verse-reviews", id],
    queryFn: () => (id ? listAudioVerseReviews(id) : Promise.resolve([])),
    enabled: !!id,
  });
  const { data: audit = [] } = useQuery({
    queryKey: ["audio-review-audit", id],
    queryFn: () => (id ? listAudioReviewAudit(id) : Promise.resolve([])),
    enabled: !!id,
  });
  const { data: versions = [] } = useQuery({
    queryKey: ["audio-versions", id],
    queryFn: () => (id ? listAudioVersions(id) : Promise.resolve([])),
    enabled: !!id,
  });
  const { data: previousVersionVerses = [] } = useQuery({
    queryKey: ["audio-version-verses", compareVersionId],
    queryFn: () => (compareVersionId ? listAudioVersionVerses(compareVersionId) : Promise.resolve([])),
    enabled: !!compareVersionId,
  });
  const { data: reportContent = "" } = useQuery({
    queryKey: ["audio-report", job?.report_url],
    queryFn: () => (job?.report_url ? readAudioReport(job.report_url) : Promise.resolve("")),
    enabled: !!job?.report_url && requestedArtifacts.report,
  });
  const { data: manifestContent = "" } = useQuery({
    queryKey: ["audio-manifest", job?.manifest_url],
    queryFn: () => (job?.manifest_url ? readAudioManifest(job.manifest_url) : Promise.resolve("")),
    enabled: !!job?.manifest_url && requestedArtifacts.manifest,
  });
  const { data: indexContent = "" } = useQuery({
    queryKey: ["audio-index", job?.index_url],
    queryFn: () => (job?.index_url ? readAudioIndex(job.index_url) : Promise.resolve("")),
    enabled: !!job?.index_url && requestedArtifacts.index,
  });
  const { data: audioUrl } = useQuery({
    queryKey: ["audio-playback-url", job?.audio_url],
    queryFn: () => getAudioPlaybackUrl(job?.audio_url ?? null),
    enabled: !!job?.audio_url,
  });

  const parsedIndexVerses = useMemo(() => parseIndexVerses(indexContent), [indexContent]);
  const verses = useMemo(() => mergeVerseReviews(parsedIndexVerses, savedVerses), [parsedIndexVerses, savedVerses]);
  const summary = useMemo(() => summarizeVerses(verses), [verses]);
  const filteredVerses = useMemo(() => {
    return verses
      .filter((verse) => filter === ALL || (filter === "low" && verse.confidence < LOW_CONFIDENCE) || (filter === "edited" && verse.manually_edited) || (filter === "flagged" && verse.status === "flagged"))
      .sort((left, right) => {
        if (sort === "confidence") return left.confidence - right.confidence;
        if (sort === "duration") return right.duration - left.duration;
        return left.verse_number - right.verse_number;
      });
  }, [filter, sort, verses]);
  const comparisonRows = useMemo(() => buildComparisonRows(verses, previousVersionVerses), [previousVersionVerses, verses]);
  const verseVirtual = useVirtualRows(filteredVerses.length, verseScrollTop, 520, VERSE_ROW_HEIGHT);
  const visibleVerses = filteredVerses.slice(verseVirtual.start, verseVirtual.end);

  const requestArtifact = useCallback((artifact: keyof typeof requestedArtifacts) => {
    setRequestedArtifacts((current) => ({ ...current, [artifact]: true }));
  }, []);

  const invalidateReview = () => {
    queryClient.invalidateQueries({ queryKey: ["audio-review", job?.id, user?.id] });
    queryClient.invalidateQueries({ queryKey: ["audio-verse-reviews", id] });
    queryClient.invalidateQueries({ queryKey: ["audio-review-audit", id] });
    queryClient.invalidateQueries({ queryKey: ["audio-versions", id] });
    queryClient.invalidateQueries({ queryKey: ["audio-job", id] });
  };

  const saveVerseMutation = useMutation({
    mutationFn: async (verse: VerseRow) => {
      if (!job || !user?.id) throw new Error("Review context is missing.");
      return saveAudioVerseReview({
        job,
        reviewId: review?.id ?? null,
        userId: user.id,
        verse,
        reason: verse.notes || "Verse timing edited.",
      });
    },
    onSuccess: () => {
      invalidateReview();
      setEditingVerse(null);
      toast({ title: "Verse timing saved" });
    },
    onError: (error: Error) => toast({ title: "Unable to save verse", description: error.message, variant: "destructive" }),
  });

  const approvalMutation = useMutation({
    mutationFn: async () => {
      if (!job || !review?.id || !user?.id) throw new Error("Review context is missing.");
      return approveAudioReview({ job, reviewId: review.id, userId: user.id, reason: decisionReason || "Approved after admin review.", verses });
    },
    onSuccess: () => {
      invalidateReview();
      setApprovalOpen(false);
      setDecisionReason("");
      toast({ title: "Audio review approved", description: "A new version was created. Publishing remains separate." });
    },
    onError: (error: Error) => toast({ title: "Unable to approve review", description: error.message, variant: "destructive" }),
  });

  const decisionMutation = useMutation({
    mutationFn: async (status: Exclude<AudioReviewStatus, "approved">) => {
      if (!job || !review?.id || !user?.id) throw new Error("Review context is missing.");
      if (status === "needs_reprocessing") {
        await requestAudioReprocessing(job, user.id, decisionReason || "Rejected during review.");
        return;
      }
      await updateAudioReviewStatus({ job, reviewId: review.id, userId: user.id, status, reason: decisionReason || status.replace(/_/g, " ") });
    },
    onSuccess: () => {
      invalidateReview();
      setDecisionReason("");
      toast({ title: "Review updated" });
    },
    onError: (error: Error) => toast({ title: "Unable to update review", description: error.message, variant: "destructive" }),
  });

  if (isLoading) return <AudioPageSkeleton />;
  if (!job) return <EmptyAudioState title="Job not found" description="The selected audio job could not be loaded." />;

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" className="px-0">
        <Link to="/church-admin/audio/jobs"><ArrowLeft className="mr-2 h-4 w-4" /> Back to jobs</Link>
      </Button>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{job.book} {job.chapter}</h2>
          <p className="text-sm text-muted-foreground">Review timing, QA confidence, and version history before publishing.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReviewBadge status={review?.status ?? "pending"} />
          <AudioStatusBadge status={job.status} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AudioMetricCard title="Verses" value={summary.verseCount} status="draft" />
        <AudioMetricCard title="Average Confidence" value={`${Math.round(summary.averageConfidence * 100)}%`} status={summary.averageConfidence < LOW_CONFIDENCE ? "failed" : "complete"} />
        <AudioMetricCard title="Low Confidence" value={summary.lowConfidenceCount} status={summary.lowConfidenceCount ? "review" : "complete"} />
        <AudioMetricCard title="Manual Edits" value={summary.editedCount} status={summary.editedCount ? "review" : "draft"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Audio Review</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {audioUrl ? (
              <audio controls className="w-full" src={audioUrl}>
                <track kind="captions" />
              </audio>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Audio file is not available yet.</div>
            )}
            <Progress value={job.progress} />
            <div className="grid gap-3 md:grid-cols-2">
              <Summary label="Content type" value={job.content_type.replace(/_/g, " ")} />
              <Summary label="Stage" value={job.processing_stage} />
              <Summary label="Started" value={job.started_at ? new Date(job.started_at).toLocaleString() : "-"} />
              <Summary label="Completed" value={job.completed_at ? new Date(job.completed_at).toLocaleString() : "-"} />
            </div>
            {isFailedAudioStatus(job.status) && job.error_message ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                {job.error_message}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Approval Workflow</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Label>Decision reason</Label>
            <Textarea value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Add review notes or a rejection reason" rows={4} />
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <Button onClick={() => setApprovalOpen(true)} disabled={!review?.id || verses.length === 0}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
              </Button>
              <Button variant="outline" onClick={() => decisionMutation.mutate("rejected")} disabled={!review?.id || decisionMutation.isPending}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button variant="outline" onClick={() => decisionMutation.mutate("needs_reprocessing")} disabled={!review?.id || isActiveAudioStatus(job.status) || decisionMutation.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reprocess Chapter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {AUDIO_PROCESSING_STAGES.map((stage) => {
            const reached = job.progress >= stage.progress || job.status === stage.status;
            return (
              <div key={stage.status} className="flex items-start gap-3 rounded-md border p-3">
                {reached ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">{stage.label}</p>
                  <p className="text-xs text-muted-foreground">{stage.progress}% target</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Verse Review</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All verses</SelectItem>
                <SelectItem value="low">Low confidence</SelectItem>
                <SelectItem value="edited">Edited</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="verse">Verse order</SelectItem>
                <SelectItem value="confidence">Confidence</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredVerses.length === 0 ? (
            <div className="space-y-3 p-4">
              <EmptyAudioState title="No verse timings found" description="The verse index has not been generated, uploaded, or loaded yet." />
              {job.index_url && !requestedArtifacts.index ? (
                <Button variant="outline" onClick={() => requestArtifact("index")}>Load verse index</Button>
              ) : null}
            </div>
          ) : (
            <div className="max-h-[520px] overflow-auto" onScroll={(event) => setVerseScrollTop(event.currentTarget.scrollTop)}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Verse</TableHead>
                    <TableHead className="min-w-[260px]">Text</TableHead>
                    <TableHead className="text-right">Start</TableHead>
                    <TableHead className="text-right">End</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verseVirtual.top > 0 ? <SpacerRow height={verseVirtual.top} /> : null}
                  {visibleVerses.map((verse) => (
                    <VerseReviewRow key={verse.verse_number} verse={verse} onEdit={setEditingVerse} />
                  ))}
                  {verseVirtual.bottom > 0 ? <SpacerRow height={verseVirtual.bottom} /> : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <ArtifactPanel
          title="QA Summary"
          isAvailable={!!job.report_url}
          isLoaded={requestedArtifacts.report}
          content={reportContent}
          emptyText="QA report is not available yet."
          onLoad={() => requestArtifact("report")}
        />
        <ArtifactPanel
          title="Manifest"
          isAvailable={!!job.manifest_url}
          isLoaded={requestedArtifacts.manifest}
          content={manifestContent}
          emptyText="Manifest is not available yet."
          onLoad={() => requestArtifact("manifest")}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Versions & Comparison</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select value={compareVersionId} onValueChange={setCompareVersionId}>
              <SelectTrigger><SelectValue placeholder="Compare with previous version" /></SelectTrigger>
              <SelectContent>
                {versions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>Version {version.version_number} - {new Date(version.created_at).toLocaleString()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {comparisonRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Approve a review to create versions for comparison.</p>
            ) : (
              <div className="max-h-72 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Verse</TableHead>
                      <TableHead className="text-right">Start diff</TableHead>
                      <TableHead className="text-right">End diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonRows.map((row) => (
                      <TableRow key={row.verse}>
                        <TableCell>{row.verse}</TableCell>
                        <TableCell className="text-right">{formatSigned(row.startDiff)}</TableCell>
                        <TableCell className="text-right">{formatSigned(row.endDiff)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-auto">
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No review actions recorded yet.</p>
            ) : audit.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{entry.action.replace(/_/g, " ")}</p>
                  <span className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{entry.reason || "No reason provided."}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Uploaded Assets</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {assets.map((asset) => <Artifact key={asset.id} label={asset.asset_type} value={asset.public_url || asset.storage_path} />)}
            {assets.length === 0 ? <p className="text-sm text-muted-foreground">No uploaded assets are registered yet.</p> : null}
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Processing Logs</CardTitle></CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-auto">
            {logs.map((log) => (
              <div key={log.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{log.stage}</p>
                <p className="text-sm text-muted-foreground">{log.message}</p>
                <p className="mt-1 text-xs text-muted-foreground/70">{new Date(log.created_at).toLocaleString()}</p>
              </div>
            ))}
            {logs.length === 0 ? <p className="text-sm text-muted-foreground">No processing logs yet.</p> : null}
          </CardContent>
        </Card>
      </div>

      <VerseEditDialog
        verse={editingVerse}
        onOpenChange={(open) => !open && setEditingVerse(null)}
        onSave={(verse) => saveVerseMutation.mutate(verse)}
        isSaving={saveVerseMutation.isPending}
      />

      <AlertDialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve reviewed audio?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates a new audio version for comparison and future publishing. It will not publish member playback.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => approvalMutation.mutate()} disabled={approvalMutation.isPending}>
              Confirm Approval
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VerseEditDialog({ verse, onOpenChange, onSave, isSaving }: { verse: VerseRow | null; onOpenChange: (open: boolean) => void; onSave: (verse: VerseRow) => void; isSaving: boolean }) {
  const [draft, setDraft] = useState<VerseRow | null>(verse);

  useEffect(() => {
    setDraft(verse);
  }, [verse]);

  return (
    <Dialog open={!!verse} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Edit Verse Timing</DialogTitle></DialogHeader>
        {draft ? (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm text-muted-foreground">{draft.verse_text || `Verse ${draft.verse_number}`}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start time</Label>
                <Input type="number" step="0.01" value={draft.start_time} onChange={(event) => setDraft({ ...draft, start_time: Number(event.target.value), duration: Math.max(0, draft.end_time - Number(event.target.value)) })} />
              </div>
              <div className="space-y-2">
                <Label>End time</Label>
                <Input type="number" step="0.01" value={draft.end_time} onChange={(event) => setDraft({ ...draft, end_time: Number(event.target.value), duration: Math.max(0, Number(event.target.value) - draft.start_time) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={draft.notes || ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={4} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => onSave({ ...draft, manually_edited: true, status: "edited" })} disabled={isSaving || draft.end_time <= draft.start_time}>Save Timing</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium capitalize">{value}</p>
    </div>
  );
}

function Artifact({ label, value }: { label: string; value: string | null }) {
  const Icon = label === "audio" ? FileAudio : label.includes("manifest") || label.includes("index") ? FileJson : FileText;
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-sm font-medium capitalize">{label.replace(/_/g, " ")}</p>
        <p className="break-all text-xs text-muted-foreground">{value || "Not available yet"}</p>
      </div>
    </div>
  );
}

function ReviewBadge({ status }: { status: AudioReviewStatus }) {
  const label = status === "pending" ? "Pending Review" : status.replace(/_/g, " ");
  const className =
    status === "approved"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : status === "rejected" || status === "needs_reprocessing"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-amber-500/30 bg-amber-500/10 text-amber-700";
  return <Badge variant="outline" className={cn("capitalize", className)}>{label}</Badge>;
}

function ConfidenceBadge({ value }: { value: number }) {
  return <Badge variant="outline" className={value < LOW_CONFIDENCE ? "border-amber-500/30 bg-amber-500/10 text-amber-700" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"}>{Math.round(value * 100)}%</Badge>;
}

function VerseStatusBadge({ verse }: { verse: VerseRow }) {
  if (verse.manually_edited) return <Badge variant="outline">Edited</Badge>;
  if (verse.confidence < LOW_CONFIDENCE) return <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">Low confidence</Badge>;
  return <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">Ready</Badge>;
}

function PreBlock({ value }: { value: string }) {
  return <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">{value}</pre>;
}

const ArtifactPanel = memo(function ArtifactPanel({
  title,
  isAvailable,
  isLoaded,
  content,
  emptyText,
  onLoad,
}: {
  title: string;
  isAvailable: boolean;
  isLoaded: boolean;
  content: string;
  emptyText: string;
  onLoad: () => void;
}) {
  return (
    <Card className="glass-card">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {!isAvailable ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null}
        {isAvailable && !isLoaded ? (
          <Button variant="outline" onClick={onLoad}>Load {title}</Button>
        ) : null}
        {isAvailable && isLoaded ? <PreBlock value={content || emptyText} /> : null}
      </CardContent>
    </Card>
  );
});

const VerseReviewRow = memo(function VerseReviewRow({ verse, onEdit }: { verse: VerseRow; onEdit: (verse: VerseRow) => void }) {
  return (
    <TableRow className={cn(verse.confidence < LOW_CONFIDENCE && "bg-amber-500/5")}>
      <TableCell className="font-medium">{verse.verse_number}</TableCell>
      <TableCell className="max-w-[360px] whitespace-normal">{verse.verse_text || "-"}</TableCell>
      <TableCell className="text-right">{formatSeconds(verse.start_time)}</TableCell>
      <TableCell className="text-right">{formatSeconds(verse.end_time)}</TableCell>
      <TableCell className="text-right">{formatSeconds(verse.duration)}</TableCell>
      <TableCell className="text-right"><ConfidenceBadge value={verse.confidence} /></TableCell>
      <TableCell><VerseStatusBadge verse={verse} /></TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={() => onEdit(verse)}>
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
      </TableCell>
    </TableRow>
  );
});

function SpacerRow({ height }: { height: number }) {
  return (
    <TableRow aria-hidden="true">
      <TableCell colSpan={8} style={{ height, padding: 0 }} />
    </TableRow>
  );
}

function useVirtualRows(total: number, scrollTop: number, viewportHeight: number, rowHeight: number) {
  return useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - VERSE_OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + VERSE_OVERSCAN * 2;
    const end = Math.min(total, start + visibleCount);
    return {
      start,
      end,
      top: start * rowHeight,
      bottom: Math.max(0, (total - end) * rowHeight),
    };
  }, [rowHeight, scrollTop, total, viewportHeight]);
}

function parseIndexVerses(indexContent: string): VerseRow[] {
  if (!indexContent.trim()) return [];
  try {
    const parsed = JSON.parse(indexContent) as { verses?: Array<Record<string, unknown>> };
    return (parsed.verses ?? []).map((verse) => {
      const start = Number(verse.start ?? verse.start_time ?? 0);
      const end = Number(verse.end ?? verse.end_time ?? 0);
      return {
        verse_number: Number(verse.verse ?? verse.verse_number ?? 0),
        verse_text: String(verse.text ?? ""),
        start_time: start,
        end_time: end,
        duration: Number(verse.duration ?? Math.max(0, end - start)),
        confidence: Number(verse.confidence ?? 1),
        status: Number(verse.confidence ?? 1) < LOW_CONFIDENCE ? "flagged" : "pending",
        notes: null,
        manually_edited: false,
      };
    }).filter((verse) => verse.verse_number > 0);
  } catch {
    return [];
  }
}

function mergeVerseReviews(indexVerses: VerseRow[], savedVerses: AudioVerseReview[]): VerseRow[] {
  const savedByVerse = new Map(savedVerses.map((verse) => [verse.verse_number, verse]));
  const merged = indexVerses.map((verse) => {
    const saved = savedByVerse.get(verse.verse_number);
    return saved ? { ...verse, ...saved } : verse;
  });
  for (const saved of savedVerses) {
    if (!merged.some((verse) => verse.verse_number === saved.verse_number)) merged.push(saved);
  }
  return merged;
}

function summarizeVerses(verses: VerseRow[]) {
  const averageConfidence = verses.length ? verses.reduce((total, verse) => total + verse.confidence, 0) / verses.length : 0;
  return {
    verseCount: verses.length,
    averageConfidence,
    lowConfidenceCount: verses.filter((verse) => verse.confidence < LOW_CONFIDENCE).length,
    editedCount: verses.filter((verse) => verse.manually_edited).length,
  };
}

function buildComparisonRows(current: VerseRow[], previous: Array<{ verse_number: number; start_time: number; end_time: number }>) {
  const previousByVerse = new Map(previous.map((verse) => [verse.verse_number, verse]));
  return current
    .map((verse) => {
      const previousVerse = previousByVerse.get(verse.verse_number);
      if (!previousVerse) return null;
      return {
        verse: verse.verse_number,
        startDiff: verse.start_time - previousVerse.start_time,
        endDiff: verse.end_time - previousVerse.end_time,
      };
    })
    .filter((row): row is { verse: number; startDiff: number; endDiff: number } => !!row);
}

function formatSeconds(value: number) {
  return `${Number(value || 0).toFixed(2)}s`;
}

function formatSigned(value: number) {
  const rounded = Number(value || 0).toFixed(2);
  return `${value >= 0 ? "+" : ""}${rounded}s`;
}
