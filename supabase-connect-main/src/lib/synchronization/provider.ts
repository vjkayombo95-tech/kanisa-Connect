import { SynchronizationEngine } from "./engine";
import type {
  SynchronizationIndexAdapter,
  SynchronizationIndex,
  SynchronizationProvider,
  SynchronizationSegmentType,
} from "@/types/synchronization";

type IndexSource = SynchronizationIndex | (() => Promise<SynchronizationIndex>);

export class IndexedContentSynchronizationProvider implements SynchronizationProvider {
  protected engine: SynchronizationEngine | null = null;

  constructor(protected readonly indexSource: IndexSource) {}

  static fromAdapter<TInput>(adapter: SynchronizationIndexAdapter<TInput>, input: TInput) {
    return new IndexedContentSynchronizationProvider(() => Promise.resolve(adapter.adapt(input)));
  }

  async load() {
    if (!this.engine) {
      const index = typeof this.indexSource === "function" ? await this.indexSource() : this.indexSource;
      this.engine = new SynchronizationEngine(index);
    }
    return this.engine.index;
  }

  currentSegment(time: number, type?: SynchronizationSegmentType) {
    return this.requireEngine().currentSegment(time, type);
  }

  currentWord(time: number) {
    return this.requireEngine().currentWord(time);
  }

  segmentAt(time: number, type?: SynchronizationSegmentType) {
    return this.requireEngine().segmentAt(time, type);
  }

  timestampFor(segmentId: string) {
    return this.requireEngine().timestampFor(segmentId);
  }

  next(time: number, type?: SynchronizationSegmentType) {
    return this.requireEngine().next(time, type);
  }

  previous(time: number, type?: SynchronizationSegmentType) {
    return this.requireEngine().previous(time, type);
  }

  search(query: string, type?: SynchronizationSegmentType) {
    return this.requireEngine().search(query, type);
  }

  progress(time: number) {
    return this.requireEngine().progress(time);
  }

  protected requireEngine() {
    if (!this.engine) throw new Error("Synchronization provider must be loaded before use.");
    return this.engine;
  }
}

export class StaticSynchronizationProvider extends IndexedContentSynchronizationProvider {}
