import { makeAutoObservable, runInAction } from "mobx";
import { DownloadEvent, DownloadParams, DownloadRunner } from "../../../shared/seismic/seismic-downloader";
import { createOpfsCache } from "../../../shared/seismic/opfs-seismic-cache";
import { StationData } from "../../../shared/seismic/seismic-types";

export const DONE = Symbol("download-done");
export type ReadyDay = number | typeof DONE;

function defaultRunner(): DownloadRunner {
  return (params, onEvent, cancel) => {
    let cancelled = false;
    cancel.onCancel(() => { cancelled = true; });
    // Lazily load the worker here so Jest doesn't try to load it, where it would fail.
    void import("./seismic-download-worker-runner").then(m => {
      if (!cancelled) m.workerRunner(params, onEvent, cancel);
    });
  };
}

export class SeismicDownloadService {
  total = 0;
  completed = 0;
  isDownloading = false;
  error: string | null = null;
  readonly erroredDays: number[] = [];
  readonly emptyDays: number[] = [];

  private readyQueue: number[] = [];
  // Byte size of each freshly-written day, for callers that report disk usage as it grows.
  private bytesByDay = new Map<number, number>();
  private waiters: Array<(day: ReadyDay) => void> = [];
  private finished = false;
  private cancelFn: (() => void) | null = null;
  private station: StationData | null = null;
  private cache = createOpfsCache();

  constructor(private runner: DownloadRunner = defaultRunner()) {
    // `cache` and `bytesByDay` shouldn't be observable. But they're private, and therefore absent from the public
    // `keyof this` the annotations map is typed against. So they must be explicitly added to the type below.
    makeAutoObservable<SeismicDownloadService, "cache" | "bytesByDay">(this,
      { erroredDays: false, emptyDays: false, cache: false, bytesByDay: false },
      { autoBind: true });
  }

  ensureRange(params: DownloadParams): void {
    this.reset();
    this.station = { network: params.network, station: params.station, channel: params.channel };
    this.isDownloading = true;
    this.runner(params, this.handleEvent, { onCancel: fn => { this.cancelFn = fn; } });
  }

  /** Resolves with the next ready day index, or DONE when the download finishes. */
  nextReadyDay(): Promise<ReadyDay> {
    const next = this.readyQueue.shift();
    if (next !== undefined) return Promise.resolve(next);
    if (this.finished) return Promise.resolve(DONE);
    return new Promise<ReadyDay>(resolve => { this.waiters.push(resolve); });
  }

  /** Bytes written for a day during this download. 0 if the day was already cached. */
  bytesForDay(day: number): number {
    return this.bytesByDay.get(day) ?? 0;
  }

  /** Read a downloaded day's raw miniSEED bytes from OPFS. Null if not present. */
  readDay(day: number): Promise<ArrayBuffer | null> {
    if (!this.station) return Promise.resolve(null);
    return this.cache.readDayChunk(this.station, day);
  }

  cancel(): void {
    this.cancelFn?.();
    this.finish();
  }

  private handleEvent(event: DownloadEvent): void {
    runInAction(() => {
      switch (event.type) {
        case "progress":
          this.completed = event.completed;
          this.total = event.total;
          break;
        case "dayWritten":
          // Record the size before pushing, since pushReady may resolve a waiter synchronously.
          if (event.bytes !== undefined) this.bytesByDay.set(event.day, event.bytes);
          this.pushReady(event.day);
          break;
        case "dayEmpty":
          this.emptyDays.push(event.day);
          break;
        case "dayError":
          console.warn(`[seismic-download] day ${event.day} failed: ${event.error}`);
          this.erroredDays.push(event.day);
          break;
        case "error":
          console.error(`[seismic-download] download failed: ${event.error}`);
          this.error = event.error;
          this.finish();
          break;
        case "done":
          this.finish();
          break;
      }
    });
  }

  private pushReady(day: number): void {
    const waiter = this.waiters.shift();
    if (waiter) waiter(day);
    else this.readyQueue.push(day);
  }

  private finish(): void {
    this.isDownloading = false;
    this.finished = true;
    // Empty this.waiters and end any that were left
    for (const waiter of this.waiters.splice(0)) waiter(DONE);
  }

  private reset(): void {
    this.total = 0;
    this.completed = 0;
    this.error = null;
    this.finished = false;
    this.readyQueue = [];
    this.bytesByDay.clear();
    this.waiters = [];
    this.erroredDays.length = 0;
    this.emptyDays.length = 0;
  }
}
