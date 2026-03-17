// shared/seismic/envelope-compute.ts
import { NO_DATA_SENTINEL } from "./envelope-config";
import type { EnvelopeTileData } from "./seismic-types";

/**
 * Compute envelope (min/max pairs) from raw samples.
 *
 * @param samples - Raw sample values in physical units
 * @param sampleRate - Samples per second
 * @param windowSeconds - Duration of each envelope window in seconds
 * @returns Arrays of min and max values, one per window
 */
export function computeEnvelopesFromRaw(
  samples: Float64Array,
  sampleRate: number,
  windowSeconds: number
): { mins: number[]; maxs: number[] } {
  if (samples.length === 0) return { mins: [], maxs: [] };

  const samplesPerWindow = Math.round(sampleRate * windowSeconds);
  const numWindows = Math.ceil(samples.length / samplesPerWindow);
  const mins: number[] = [];
  const maxs: number[] = [];

  for (let w = 0; w < numWindows; w++) {
    const start = w * samplesPerWindow;
    const end = Math.min(start + samplesPerWindow, samples.length);
    let min = samples[start];
    let max = samples[start];
    for (let i = start + 1; i < end; i++) {
      if (samples[i] < min) min = samples[i];
      if (samples[i] > max) max = samples[i];
    }
    mins.push(min);
    maxs.push(max);
  }

  return { mins, maxs };
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
