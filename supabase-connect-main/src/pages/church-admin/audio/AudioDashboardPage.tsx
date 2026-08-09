import { Link } from "react-router-dom";
import { Upload, ListChecks, Settings, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useAudioDashboard } from "@/hooks/use-audio-jobs";
import { AudioMetricCard, AudioPageSkeleton, AudioStatusBadge, EmptyAudioState } from "./AudioCmsShared";

export default function AudioDashboardPage() {
  const { churchId } = useAuth();
  const { data: summary, isLoading } = useAudioDashboard(churchId);
  const metrics = summary ?? { processing: 0, completed: 0, needsReview: 0, published: 0, failed: 0, recentJobs: [] };
  const recentJobs = metrics.recentJobs;

  if (isLoading) return <AudioPageSkeleton />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Audio Dashboard</h2>
          <p className="text-sm text-muted-foreground">Track chapter processing, QA outputs, and review readiness.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/church-admin/audio/upload"><Upload className="mr-2 h-4 w-4" /> Upload Audio</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/church-admin/audio/jobs"><ListChecks className="mr-2 h-4 w-4" /> View Jobs</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AudioMetricCard title="Processing Jobs" value={metrics.processing} status="active" />
        <AudioMetricCard title="Completed Jobs" value={metrics.completed} status="complete" />
        <AudioMetricCard title="Needs Review" value={metrics.needsReview} status="review" />
        <AudioMetricCard title="Published" value={metrics.published} status="complete" />
        <AudioMetricCard title="Failed" value={metrics.failed} status="failed" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
          <CardContent className="p-0">
            {recentJobs.length === 0 ? (
              <div className="p-4"><EmptyAudioState title="No audio jobs yet" description="Upload a chapter audio file and official text to create the first processing job." /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Content</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.book} {job.chapter}</TableCell>
                      <TableCell className="text-muted-foreground">{job.processing_stage}</TableCell>
                      <TableCell><AudioStatusBadge status={job.status} /></TableCell>
                      <TableCell className="text-right">{job.progress}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start">
              <Link to="/church-admin/audio/upload"><Upload className="mr-2 h-4 w-4" /> New upload</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/church-admin/audio/jobs"><RotateCcw className="mr-2 h-4 w-4" /> Retry failed jobs</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/church-admin/audio/settings"><Settings className="mr-2 h-4 w-4" /> Audio settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
