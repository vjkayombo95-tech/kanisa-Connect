import type { AudioProcessingStage } from "@/lib/audio-cms";

export type AudioProcessorResult = {
  jobId: string;
  status: AudioProcessingStage;
};

export interface AudioProcessor {
  process(jobId: string): Promise<AudioProcessorResult>;
}

/**
 * Queue-facing processor adapter.
 *
 * This class intentionally does not contain WhisperX or Python orchestration.
 * A production worker can implement the same interface and call the external
 * Audio Processing Engine from a server runtime.
 */
export class QueuedAudioProcessor implements AudioProcessor {
  async process(jobId: string): Promise<AudioProcessorResult> {
    void jobId;
    throw new Error("Audio processing must run through the trusted audio-worker backend.");
  }
}
