import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileAudio, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AUDIO_CONTENT_TYPES, AudioContentType, createAudioJob, startAudioProcessing, uploadAudioAsset } from "@/lib/audio-cms";

type WizardState = {
  contentType: AudioContentType | "";
  book: string;
  chapter: string;
  audioFile: File | null;
  textFile: File | null;
  pastedText: string;
};

const steps = ["Content Type", "Book", "Chapter", "MP3", "Official Text", "Review", "Start"];

export default function AudioUploadPage() {
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({ contentType: "", book: "", chapter: "", audioFile: null, textFile: null, pastedText: "" });

  const canContinue = useMemo(() => validateStep(step, state), [state, step]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!churchId || !user?.id || !state.contentType || !state.audioFile) throw new Error("Missing upload details");
      const officialText = state.textFile ?? new File([state.pastedText], `${state.book}_${state.chapter}.txt`, { type: "text/plain" });
      const job = await createAudioJob({
        churchId,
        userId: user.id,
        contentType: state.contentType,
        book: state.book,
        chapter: Number(state.chapter),
      });
      await uploadAudioAsset({ churchId, userId: user.id, jobId: job.id, bucket: "audio", assetType: "audio", file: state.audioFile });
      await uploadAudioAsset({ churchId, userId: user.id, jobId: job.id, bucket: "audio-transcripts", assetType: "text", file: officialText });
      await startAudioProcessing(job.id);
      return job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audio-jobs", churchId] });
      toast({ title: "Audio job queued", description: "The processing engine can now pick up this job." });
      setStep(0);
      setState({ contentType: "", book: "", chapter: "", audioFile: null, textFile: null, pastedText: "" });
    },
    onError: (error: Error) => toast({ title: "Unable to create audio job", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Upload Audio</h2>
        <p className="text-sm text-muted-foreground">Create a processing job with chapter audio and official text.</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {steps.map((label, index) => (
              <span key={label} className={`rounded-full border px-3 py-1 text-xs ${index === step ? "border-primary bg-primary/10 text-primary" : index < step ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-border text-muted-foreground"}`}>
                {index < step ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : null}
                {index + 1}. {label}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 0 && (
            <FieldBlock title="Select Content Type">
              <Select value={state.contentType} onValueChange={(value) => setState((current) => ({ ...current, contentType: value as AudioContentType }))}>
                <SelectTrigger><SelectValue placeholder="Choose content type" /></SelectTrigger>
                <SelectContent>
                  {AUDIO_CONTENT_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldBlock>
          )}
          {step === 1 && (
            <FieldBlock title="Select Book">
              <Input value={state.book} onChange={(event) => setState((current) => ({ ...current, book: event.target.value }))} placeholder="Genesis" />
            </FieldBlock>
          )}
          {step === 2 && (
            <FieldBlock title="Select Chapter">
              <Input value={state.chapter} onChange={(event) => setState((current) => ({ ...current, chapter: event.target.value.replace(/\D/g, "") }))} placeholder="1" inputMode="numeric" />
            </FieldBlock>
          )}
          {step === 3 && (
            <FieldBlock title="Upload MP3">
              <Input type="file" accept="audio/mpeg,.mp3" onChange={(event) => setState((current) => ({ ...current, audioFile: event.target.files?.[0] ?? null }))} />
              {state.audioFile ? <p className="text-sm text-muted-foreground"><FileAudio className="mr-1 inline h-4 w-4" /> {state.audioFile.name}</p> : null}
            </FieldBlock>
          )}
          {step === 4 && (
            <FieldBlock title="Upload Official Text">
              <Input type="file" accept=".txt,.json,text/plain,application/json" onChange={(event) => setState((current) => ({ ...current, textFile: event.target.files?.[0] ?? null }))} />
              <Textarea value={state.pastedText} onChange={(event) => setState((current) => ({ ...current, pastedText: event.target.value }))} placeholder="Or paste official chapter text here" rows={6} />
              {state.textFile ? <p className="text-sm text-muted-foreground"><FileText className="mr-1 inline h-4 w-4" /> {state.textFile.name}</p> : null}
            </FieldBlock>
          )}
          {step === 5 && <ReviewState state={state} />}
          {step === 6 && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
              <p className="font-medium">Ready to start processing</p>
              <p className="mt-1 text-sm text-muted-foreground">This creates a queued job. The processing engine remains separate and will pick up work from the job record and uploaded assets.</p>
            </div>
          )}

          <div className="flex justify-between border-t pt-4">
            <Button variant="outline" disabled={step === 0 || createMutation.isPending} onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</Button>
            {step < steps.length - 1 ? (
              <Button disabled={!canContinue} onClick={() => setStep((current) => current + 1)}>Continue</Button>
            ) : (
              <Button disabled={!canContinue || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Start Processing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <Label className="text-base">{title}</Label>
      {children}
    </div>
  );
}

function ReviewState({ state }: { state: WizardState }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Summary label="Content type" value={state.contentType || "-"} />
      <Summary label="Book" value={state.book || "-"} />
      <Summary label="Chapter" value={state.chapter || "-"} />
      <Summary label="Audio" value={state.audioFile?.name || "-"} />
      <Summary label="Official text" value={state.textFile?.name || (state.pastedText ? "Pasted text" : "-")} />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function validateStep(step: number, state: WizardState) {
  if (step === 0) return !!state.contentType;
  if (step === 1) return state.book.trim().length > 0;
  if (step === 2) return Number(state.chapter) > 0;
  if (step === 3) return !!state.audioFile && state.audioFile.name.toLowerCase().endsWith(".mp3");
  if (step === 4) return !!state.textFile || state.pastedText.trim().length > 0;
  return true;
}
