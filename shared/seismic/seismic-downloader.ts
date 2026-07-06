// shared/seismic/seismic-downloader.ts
import { StationData, StationLocation, StationISOTimeRange, TimeRange } from "./seismic-types";
import { EarthscopeOptions } from "./earthscope-client";
import { daysInRange, dayToISORange } from "./seismic-day";

export interface DownloaderDeps {
  fetchAvailability(query: StationISOTimeRange, signal?: AbortSignal): Promise<TimeRange[]>;
  fetchRaw(query: StationISOTimeRange, signal?: AbortSignal): Promise<ArrayBuffer>;
  cache: {
    scanCachedDays(station: StationData, startDay: number, endDay: number): Promise<Set<number>>;
    writeDayChunk(station: StationData, day: number, bytes: ArrayBuffer): Promise<void>;
  };
}

export interface DownloadParams extends StationLocation, EarthscopeOptions {
  startSec: number; endSec: number;
  concurrency?: number; maxRetries?: number;
}

/** Drives a download and forwards events. The default runner uses the Web Worker;
 *  tests inject a runner that replays scripted events. */
export type DownloadRunner = (
  params: DownloadParams,
  onEvent: (event: DownloadEvent) => void,
  cancel: { onCancel: (fn: () => void) => void }
) => void;

export type DownloadEvent =
  | { type: "dayWritten"; day: number }
  | { type: "dayEmpty"; day: number }
  | { type: "dayError"; day: number; error: string }
  | { type: "progress"; completed: number; total: number }
  | { type: "done" }
  | { type: "error"; error: string };

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_MAX_RETRIES = 3;

/** True if any availability range overlaps the given UTC day. */
function dayIsAvailable(day: number, ranges: TimeRange[]): boolean {
  const { startISO, endISO } = dayToISORange(day);
  const startSec = new Date(startISO).getTime() / 1000;
  const endSec = new Date(endISO).getTime() / 1000;
  return ranges.some(r => r.start < endSec && r.end > startSec);
}

/**
 * Download every available, uncached day-chunk in [startSec, endSec) into the cache,
 * emitting one event per day. Does not throw for per-day failures — those become
 * `dayError` events; a fatal error (e.g. availability failure) becomes `error`.
 */
export async function downloadRange(
  deps: DownloaderDeps,
  params: DownloadParams,
  onEvent: (event: DownloadEvent) => void
): Promise<void> {
  const { network, station, location, channel, startSec, endSec } = params;
  const stationLocation: StationLocation = { network, station, location, channel };
  const concurrency = params.concurrency ?? DEFAULT_CONCURRENCY;
  const maxRetries = params.maxRetries ?? DEFAULT_MAX_RETRIES;

  try {
    const ranges = await deps.fetchAvailability(
      { ...stationLocation,
        startTime: new Date(startSec * 1000).toISOString(),
        endTime: new Date(endSec * 1000).toISOString() },
      params.signal
    );

    const allDays = daysInRange(startSec, endSec);
    const availableDays: number[] = [];
    allDays.forEach(day => {
      if (dayIsAvailable(day, ranges)) {
        availableDays.push(day);
      } else {
        onEvent({ type: "dayEmpty", day });
      }
    });

    const firstDay = availableDays[0];
    const lastDay = availableDays[availableDays.length - 1];
    const cached = availableDays.length
      ? await deps.cache.scanCachedDays(stationLocation, firstDay, lastDay)
      : new Set<number>();

    const total = availableDays.length;
    let completed = 0;
    const emitProgress = () => onEvent({ type: "progress", completed, total });

    const gaps: number[] = [];
    for (const day of availableDays) {
      if (cached.has(day)) {
        // Already-cached days are ready immediately.
        completed++;
        onEvent({ type: "dayWritten", day });
      } else {
        // Stash days that need to be downloaded and cached.
        gaps.push(day);
      }
    }
    if (cached.size) emitProgress();

    const downloadDay = async (day: number) => {
      const { startISO: dStart, endISO: dEnd } = dayToISORange(day);
      let lastErr = "";
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (params.signal?.aborted) return;
        try {
          const bytes = await deps.fetchRaw(
            { ...stationLocation, startTime: dStart, endTime: dEnd }, params.signal
          );
          await deps.cache.writeDayChunk(stationLocation, day, bytes);
          completed++;
          onEvent({ type: "dayWritten", day });
          emitProgress();
          return;
        } catch (err) {
          lastErr = err instanceof Error ? err.message : String(err);
        }
      }
      onEvent({ type: "dayError", day, error: lastErr });
    };

    await runPool(gaps, concurrency, downloadDay);
    onEvent({ type: "done" });
  } catch (err) {
    onEvent({ type: "error", error: err instanceof Error ? err.message : String(err) });
  }
}

/** Run `worker` over `items` with at most `limit` concurrent invocations. */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
}
