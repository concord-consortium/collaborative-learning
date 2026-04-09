// shared/seismic/envelope-compute.ts
import { NO_DATA_SENTINEL } from "./envelope-config";
import type { EnvelopeTileData } from "./seismic-types";

/**
 * Compute envelope (min/max pairs) from raw samples using grid-aligned windows.
 *
 * Windows are aligned to the global grid (multiples of windowSeconds from Unix epoch 0)
 * rather than using a fixed sample count. This prevents cumulative drift when
 * sampleRate * windowSeconds is not an exact integer.
 *
 * @param samples - Raw sample values in physical units
 * @param sampleRate - Samples per second
 * @param windowSeconds - Duration of each envelope window in seconds
 * @param startTime - Unix timestamp (seconds) of the first sample
 * @returns Arrays of min/max values and their grid-aligned times
 */
export function computeEnvelopesFromRaw(
  samples: Float64Array,
  sampleRate: number,
  windowSeconds: number,
  startTime: number
): { mins: number[]; maxs: number[]; times: number[] } {
  if (samples.length === 0) return { mins: [], maxs: [], times: [] };

  const mins: number[] = [];
  const maxs: number[] = [];
  const times: number[] = [];

  // Find the first grid-aligned window boundary at or before startTime
  const firstGridTime = Math.floor(startTime / windowSeconds) * windowSeconds;
  const endTime = startTime + samples.length / sampleRate;

  for (let gridTime = firstGridTime; gridTime < endTime; gridTime += windowSeconds) {
    const windowEnd = gridTime + windowSeconds;
    // Convert grid window boundaries to sample indices
    const sampleStart = Math.max(0, Math.round((gridTime - startTime) * sampleRate));
    const sampleEnd = Math.min(samples.length, Math.round((windowEnd - startTime) * sampleRate));
    if (sampleStart >= sampleEnd) continue;

    let min = samples[sampleStart];
    let max = samples[sampleStart];
    for (let i = sampleStart + 1; i < sampleEnd; i++) {
      if (samples[i] < min) min = samples[i];
      if (samples[i] > max) max = samples[i];
    }
    mins.push(min);
    maxs.push(max);
    times.push(gridTime);
  }

  return { mins, maxs, times };
}

/**
 * Roll up a finer envelope level to produce a coarser level.
 * Each coarser point is the min/max of k consecutive finer points.
 * Sentinel values are skipped; if all k points are sentinels, the coarser point is also sentinel.
 */
export function rollUpEnvelopes(
  finerMins: Int16Array,
  finerMaxs: Int16Array,
  k: number
): EnvelopeTileData {
  const coarseCount = Math.ceil(finerMins.length / k);
  const mins = new Int16Array(coarseCount);
  const maxs = new Int16Array(coarseCount);

  for (let c = 0; c < coarseCount; c++) {
    const start = c * k;
    const end = Math.min(start + k, finerMins.length);
    let minVal = NO_DATA_SENTINEL;
    let maxVal = NO_DATA_SENTINEL;
    let hasData = false;

    for (let i = start; i < end; i++) {
      if (finerMins[i] === NO_DATA_SENTINEL) continue;
      if (!hasData) {
        minVal = finerMins[i];
        maxVal = finerMaxs[i];
        hasData = true;
      } else {
        if (finerMins[i] < minVal) minVal = finerMins[i];
        if (finerMaxs[i] > maxVal) maxVal = finerMaxs[i];
      }
    }

    mins[c] = minVal;
    maxs[c] = maxVal;
  }

  return { mins, maxs };
}
