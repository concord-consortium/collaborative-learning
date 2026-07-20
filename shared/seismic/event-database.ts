/**
 * Seismic event database: pure constants, index math, Firestore path builders,
 * and coverage-bitmap helpers.
 */
import { dayIndex, SECONDS_PER_DAY } from "./seismic-day";
import { SeismicEvent } from "./seismic-model-types";
import { StationData, TimeRange } from "./seismic-types";
import { encodeLocation, getStationPrefix } from "./tile-addressing";

/** Coverage epoch: Jan 1 2020 UTC. All coverage math is in seconds. */
export const COVERAGE_EPOCH = Date.UTC(2020, 0, 1) / 1000;
export const CHUNK_DURATION_S = 30 * SECONDS_PER_DAY; // 30 days
export const WINDOW_DURATION_S = 10 * 60; // 10 minutes
export const WINDOWS_PER_CHUNK = CHUNK_DURATION_S / WINDOW_DURATION_S; // 4320
export const BYTES_PER_CHUNK = Math.ceil(WINDOWS_PER_CHUNK / 8); // 540

export function getChunkIndex(timeSec: number): number {
  return Math.floor((timeSec - COVERAGE_EPOCH) / CHUNK_DURATION_S);
}

export function getChunkStart(chunkIndex: number): number {
  return chunkIndex * CHUNK_DURATION_S + COVERAGE_EPOCH;
}

export function getChunkEnd(chunkIndex: number): number {
  return getChunkStart(chunkIndex + 1);
}

export function getWindowIndex(timeSec: number): number {
  const chunkStart = getChunkStart(getChunkIndex(timeSec));
  return Math.floor((timeSec - chunkStart) / WINDOW_DURATION_S);
}

/** Firestore path to a station+location+channel+model container document. */
export function modelPath(stationData: StationData, model: string): string {
  return `services/seismic/stations/${getStationPrefix(stationData)}` +
    `/locations/${encodeLocation(stationData.location)}` +
    `/channels/${stationData.channel}/models/${model}`;
}

/** Firestore path to a coverage chunk document. */
export function coveragePath(stationData: StationData, model: string, chunkIndex: number): string {
  return `${modelPath(stationData, model)}/coverage/${chunkIndex}`;
}

/** Firestore path to a model's events collection. */
export function eventsPath(stationData: StationData, model: string): string {
  return `${modelPath(stationData, model)}/events`;
}

/** Event document ID: windowStart (epoch ms) + eventType. Deduplicates re-detections. */
export function eventDocId(event: SeismicEvent): string {
  return `${event.windowStart}_${event.eventType}`;
}

/**
 * Group the 10-minute windows of a time range by coverage chunk.
 * `range` should be window-aligned (day-aligned ranges always are).
 */
export function groupWindowsByChunk(range: TimeRange): Map<number, number[]> {
  const windowsByChunk = new Map<number, number[]>();
  for (let t = range.start; t < range.end; t += WINDOW_DURATION_S) {
    const chunk = getChunkIndex(t);
    const window = getWindowIndex(t);
    if (!windowsByChunk.has(chunk)) windowsByChunk.set(chunk, []);
    windowsByChunk.get(chunk)!.push(window);
  }
  return windowsByChunk;
}

/** OR the given window bits into the bitmap (mutates). Idempotent. */
export function setWindowBits(bitmap: Uint8Array, windows: number[]): void {
  for (const w of windows) {
    // eslint-disable-next-line no-bitwise
    bitmap[Math.floor(w / 8)] |= (1 << (w % 8));
  }
}

export function isWindowCovered(bitmap: Uint8Array, window: number): boolean {
  // eslint-disable-next-line no-bitwise
  return (bitmap[Math.floor(window / 8)] & (1 << (window % 8))) !== 0;
}

/**
 * Scan pre-fetched coverage bitmaps for uncovered sub-ranges of `range`.
 * `bitmaps` maps chunkIndex → bitmap; a missing entry means an unwritten
 * (fully uncovered) chunk. Returns disjoint, sorted gaps.
 * `range` should be window-aligned (day-aligned ranges always are); a
 * mid-window start would silently skip the partial first window.
 */
export function findUncoveredRanges(bitmaps: Map<number, Uint8Array>, range: TimeRange): TimeRange[] {
  const startChunk = getChunkIndex(range.start);
  const endChunk = getChunkIndex(range.end);

  const gaps: TimeRange[] = [];
  let currentGapStart: number | null = null;

  for (let chunk = startChunk; chunk <= endChunk; chunk++) {
    const bitmap = bitmaps.get(chunk);
    const chunkStart = getChunkStart(chunk);
    for (let w = 0; w < WINDOWS_PER_CHUNK; w++) {
      const windowTime = chunkStart + w * WINDOW_DURATION_S;
      if (windowTime < range.start || windowTime >= range.end) continue;

      const covered = !!bitmap && isWindowCovered(bitmap, w);
      if (!covered && currentGapStart === null) {
        currentGapStart = windowTime;
      } else if (covered && currentGapStart !== null) {
        gaps.push({ start: currentGapStart, end: windowTime });
        currentGapStart = null;
      }
    }
  }
  if (currentGapStart !== null) {
    gaps.push({ start: currentGapStart, end: range.end });
  }
  return gaps;
}

export interface DaySpan {
  startDay: number; // UTC day index (days since Unix epoch), inclusive
  endDay: number;   // inclusive
}

/**
 * Convert uncovered ranges into merged spans of UTC day indices, clamped to `range`.
 * The download/model pipeline is day-based, so a day is processed iff it
 * intersects an uncovered range. Assumes `gaps` are disjoint and sorted
 * (as returned by findUncoveredRanges).
 */
export function uncoveredDaySpans(gaps: TimeRange[], range: TimeRange): DaySpan[] {
  const spans: DaySpan[] = [];
  for (const gap of gaps) {
    const start = Math.max(gap.start, range.start);
    const end = Math.min(gap.end, range.end);
    if (end <= start) continue;
    const startDay = dayIndex(start);
    const endDay = dayIndex(end - 1); // end is exclusive
    const last = spans[spans.length - 1];
    if (last && startDay <= last.endDay + 1) {
      last.endDay = Math.max(last.endDay, endDay);
    } else {
      spans.push({ startDay, endDay });
    }
  }
  return spans;
}

export type DayCoverageState = "covered" | "partial" | "uncovered";

/**
 * Classify each UTC day index in [dayIndex(range.start), dayIndex(range.end - 1)]
 * against uncovered gaps (as returned by findUncoveredRanges): "uncovered" when a
 * gap fully spans the day, "covered" when no gap intersects it, else "partial".
 * Two gaps can never jointly span one day — findUncoveredRanges returns maximal
 * gaps separated by covered windows — so per-gap classification is sufficient.
 * For a non-day-aligned range, a boundary day can never classify as "uncovered"
 * (the whole-day test spans the full calendar day) — `range` should be
 * day-aligned like this module's sibling helpers expect.
 */
export function classifyDayCoverage(gaps: TimeRange[], range: TimeRange): Map<number, DayCoverageState> {
  const states = new Map<number, DayCoverageState>();
  for (let day = dayIndex(range.start); day <= dayIndex(range.end - 1); day++) {
    states.set(day, "covered");
  }
  for (const gap of gaps) {
    const start = Math.max(gap.start, range.start);
    const end = Math.min(gap.end, range.end);
    if (end <= start) continue;
    for (let day = dayIndex(start); day <= dayIndex(end - 1); day++) {
      const dayStart = day * SECONDS_PER_DAY;
      const wholeDay = start <= dayStart && end >= dayStart + SECONDS_PER_DAY;
      states.set(day, wholeDay ? "uncovered" : "partial");
    }
  }
  return states;
}
