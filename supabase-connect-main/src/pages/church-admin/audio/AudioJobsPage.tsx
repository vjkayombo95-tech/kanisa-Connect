import { memo, useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, Ban, Eye, RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAudioJobs } from "@/hooks/use-audio-jobs";
import { AudioJob, AudioJobStatus, cancelAudioJob, isActiveAudioStatus, retryAudioJob } from "@/lib/audio-cms";
import { AudioPageSkeleton, AudioStatusBadge, EmptyAudioState } from "./AudioCmsShared";

const PAGE_SIZE = 50;
const ALL_STATUSES = "all";
const ROW_HEIGHT = 56;
const OVERSCAN = 4;

export default function AudioJobsPage() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AudioJobStatus | typeof ALL_STATUSES>(ALL_STATUSES);
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const deferredSearch = useDeferredValue(search);

  const { data, isLoading } = useAudioJobs(churchId, {
    search: deferredSearch,
    status,
    sortAsc,
    page,
    pageSize: PAGE_SIZE,
  });
  const jobs = data?.jobs ?? [];
  const totalCount = data?.totalCount ?? 0;

  const retryMutation = useMutation({
    mutationFn: retryAudioJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audio-jobs", churchId] });
      toast({ title: "Retry queued" });
    },
    onError: (error: Error) => toast({ title: "Unable to retry job", description: error.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelAudioJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audio-jobs", churchId] });
      toast({ title: "Job cancelled" });
    },
    onError: (error: Error) => toast({ title: "Unable to cancel job", description: error.message, variant: "destructive" }),
  });

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const virtual = useVirtualRows(jobs.length, scrollTop, 520, ROW_HEIGHT);
  const visible = jobs.slice(virtual.start, virtual.end);

  if (isLoading) return <AudioPageSkeleton />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Audio Jobs</h2>
        <p className="text-sm text-muted-foreground">Search, filter, retry, and inspect processing jobs.</p>
      </div>

      <Card className="glass-card">
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Jobs</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search jobs" className="pl-9 sm:w-64" />
            </div>
            <Select value={status} onValueChange={(value) => { setStatus(value as AudioJobStatus | typeof ALL_STATUSES); setPage(1); }}>
              <SelectTrigger className="sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
                {["QUEUED", "VALIDATING", "TRANSCRIBING", "ALIGNING", "BUILDING_INDEX", "VALIDATING_INDEX", "REVIEW_REQUIRED", "COMPLETED", "FAILED", "CANCELLED"].map((item) => (
                  <SelectItem key={item} value={item}>{item.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="p-4"><EmptyAudioState title="No jobs found" description="Try another filter or start a new upload." /></div>
          ) : (
            <div className="max-h-[520px] overflow-auto" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Chapter</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => setSortAsc((current) => !current)}>
                        Created <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {virtual.top > 0 ? <SpacerRow height={virtual.top} /> : null}
                  {visible.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      retryDisabled={retryMutation.isPending}
                      cancelDisabled={!isActiveAudioStatus(job.status) || cancelMutation.isPending}
                      onRetry={() => retryMutation.mutate(job.id)}
                      onCancel={() => cancelMutation.mutate(job.id)}
                    />
                  ))}
                  {virtual.bottom > 0 ? <SpacerRow height={virtual.bottom} /> : null}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex items-center justify-between border-t p-3 text-sm text-muted-foreground">
            <span>Page {page} of {pageCount} · {totalCount} jobs</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function useVirtualRows(total: number, scrollTop: number, viewportHeight: number, rowHeight: number) {
  return useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + OVERSCAN * 2;
    const end = Math.min(total, start + visibleCount);
    return {
      start,
      end,
      top: start * rowHeight,
      bottom: Math.max(0, (total - end) * rowHeight),
    };
  }, [rowHeight, scrollTop, total, viewportHeight]);
}

function SpacerRow({ height }: { height: number }) {
  return (
    <TableRow aria-hidden="true">
      <TableCell colSpan={7} style={{ height, padding: 0 }} />
    </TableRow>
  );
}

const JobRow = memo(function JobRow({
  job,
  retryDisabled,
  cancelDisabled,
  onRetry,
  onCancel,
}: {
  job: AudioJob;
  retryDisabled: boolean;
  cancelDisabled: boolean;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{job.book} {job.chapter}</TableCell>
      <TableCell className="capitalize">{job.content_type.replace(/_/g, " ")}</TableCell>
      <TableCell><AudioStatusBadge status={job.status} /></TableCell>
      <TableCell className="text-muted-foreground">{job.processing_stage}</TableCell>
      <TableCell className="text-right">{job.progress}%</TableCell>
      <TableCell>{new Date(job.created_at).toLocaleString()}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon" title="View details">
            <Link to={`/church-admin/audio/jobs/${job.id}`}><Eye className="h-4 w-4" /></Link>
          </Button>
          <Button variant="ghost" size="icon" title="Retry" disabled={retryDisabled} onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Cancel" disabled={cancelDisabled} onClick={onCancel}>
            <Ban className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});
