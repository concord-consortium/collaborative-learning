/**
 * Seismic event database: pure constants, index math, Firestore path builders,
 * and coverage-bitmap helpers.
 */

/** Coverage epoch: Jan 1 2020 UTC. All coverage math is in seconds. */
export const COVERAGE_EPOCH = Date.UTC(2020, 0, 1) / 1000;
export const CHUNK_DURATION_S = 30 * 24 * 60 * 60; // 30 days
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
