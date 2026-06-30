import { useState } from "react";
import { Activity, Eye, Loader2, PauseCircle, PlayCircle } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export type SystemJobActionJob = {
  id: string;
  job_name: string;
  enabled: boolean;
};

type SystemJobActionsProps = {
  job: SystemJobActionJob;
  onCompleted: () => Promise<unknown> | unknown;
  onViewDetails?: () => void;
  onRunStarted?: () => void;
  showRetryFailedRun?: boolean;
  className?: string;
};

type RunAction = "run" | "retry";

export function SystemJobActions({
  job,
  onCompleted,
  onViewDetails,
  onRunStarted,
  showRetryFailedRun = false,
  className = "",
}: SystemJobActionsProps) {
  const { toast } = useToast();
  const [pendingToggle, setPendingToggle] = useState(false);
  const [pendingRun, setPendingRun] = useState<RunAction | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const handleToggleJob = async () => {
    const nextEnabled = !job.enabled;
    setIsToggling(true);

    try {
      const { error } = await supabase.rpc("toggle_system_job" as never, {
        p_job_id: job.id,
        p_enabled: nextEnabled,
      } as never);

      if (error) throw error;

      await onCompleted();
      toast({
        title: nextEnabled ? "Job enabled" : "Job disabled",
        description: `${job.job_name} is now ${nextEnabled ? "enabled" : "disabled"}.`,
      });
      setPendingToggle(false);
    } catch (err) {
      toast({
        title: "Unable to update job",
        description: err instanceof Error ? err.message : "The scheduled job could not be updated.",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleRunNow = async () => {
    setIsRunning(true);
    onRunStarted?.();

    try {
      const { data, error } = await supabase.functions.invoke("daily-automations", {
        method: "POST",
      });

      if (error) throw error;

      if (data && typeof data === "object" && "success" in data && data.success === false) {
        throw new Error(
          "error" in data && typeof data.error === "string" ? data.error : "Daily automations did not complete.",
        );
      }

      await onCompleted();
      toast({
        title: "Daily automations started",
        description: "The scheduled job completed successfully.",
      });
      setPendingRun(null);
    } catch (err) {
      toast({
        title: "Unable to run job",
        description: err instanceof Error ? err.message : "Daily automations could not be started.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {onViewDetails && (
          <Button variant="outline" size="sm" className="gap-2" onClick={onViewDetails}>
            <Eye className="h-4 w-4" />
            View Details
          </Button>
        )}
        <Button
          variant={job.enabled ? "outline" : "default"}
          size="sm"
          className="gap-2"
          onClick={() => setPendingToggle(true)}
          disabled={isRunning}
        >
          {job.enabled ? (
            <>
              <PauseCircle className="h-4 w-4" />
              Disable
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" />
              Enable
            </>
          )}
        </Button>
        {job.job_name === "Daily Automations" && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setPendingRun("run")}
            disabled={isToggling || isRunning}
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Run Now
          </Button>
        )}
        {showRetryFailedRun && job.job_name === "Daily Automations" && (
          <Button
            variant="default"
            size="sm"
            className="gap-2"
            onClick={() => setPendingRun("retry")}
            disabled={isToggling || isRunning}
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Retry Failed Run
          </Button>
        )}
      </div>

      <AlertDialog
        open={pendingToggle}
        onOpenChange={(open) => {
          if (!open && !isToggling) setPendingToggle(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{job.enabled ? "Disable scheduled job?" : "Enable scheduled job?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {job.job_name} will be {job.enabled ? "disabled" : "enabled"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isToggling}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleJob} disabled={isToggling}>
              {isToggling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {job.enabled ? "Disable" : "Enable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingRun !== null}
        onOpenChange={(open) => {
          if (!open && !isRunning) setPendingRun(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRun === "retry" ? "Retry failed Daily Automations run?" : "Run Daily Automations now?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will invoke the existing daily automations Edge Function immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRunning}
              onClick={(event) => {
                event.preventDefault();
                void handleRunNow();
              }}
            >
              {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pendingRun === "retry" ? "Retry Failed Run" : "Run Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
