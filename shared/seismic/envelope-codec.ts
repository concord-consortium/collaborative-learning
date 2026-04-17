// shared/seismic/envelope-codec.ts
import pako from "pako";
import type { EnvelopeTileData } from "./seismic-types";

const MAX_INT16 = 32767;

/**
 * Quantize a physical amplitude value to Int16.
 * Maps [-rangeMax, +rangeMax] → [-32767, +32767].
 * Values outside the range are clamped. Never returns -32768 (sentinel).
 */
export function quantize(physicalValue: number, rangeMax: number): number {
  const scaled = (physicalValue / rangeMax) * MAX_INT16;
  return Math.max(-MAX_INT16, Math.min(MAX_INT16, Math.round(scaled)));
}

/**
 * Dequantize an Int16 value back to physical units.
 */
export function dequantize(int16Value: number, rangeMax: number): number {
  return (int16Value / MAX_INT16) * rangeMax;
}

/**
 * Encode min/max Int16 arrays into a gzipped binary buffer.
 * Layout: [mins (N × 2 bytes)] [maxs (N × 2 bytes)], gzipped.
 * Accepts any array length (tile size varies by level).
 */
export function encodeEnvelopeTile(mins: Int16Array, maxs: Int16Array): ArrayBuffer {
  if (mins.length !== maxs.length) {
    throw new Error(`mins and maxs must have the same length (got ${mins.length} and ${maxs.length})`);
  }
  const pointCount = mins.length;
  const raw = new ArrayBuffer(pointCount * 2 * 2);
  const view = new Int16Array(raw);
  view.set(mins, 0);
  view.set(maxs, pointCount);

  const compressed = pako.gzip(new Uint8Array(raw));
  return compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength);
}

/**
 * Decode a gzipped binary buffer back to min/max Int16 arrays.
 * Infers point count from the decompressed buffer size.
 */
export function decodeEnvelopeTile(buffer: ArrayBuffer): EnvelopeTileData {
  // Envelope files are stored zipped, so we try to unzip them.
  // But they might get unzipped automatically, so if the unzip fails we just use the raw data.
  let decompressed: Uint8Array;
  try {
    decompressed = pako.ungzip(new Uint8Array(buffer));
  } catch {
    decompressed = new Uint8Array(buffer);
  }

  // Each point has 2 Int16 values (min + max) = 4 bytes
  const pointCount = decompressed.byteLength / 4;
  const view = new Int16Array(decompressed.buffer, decompressed.byteOffset, pointCount * 2);
  return {
    mins: view.slice(0, pointCount),
    maxs: view.slice(pointCount, pointCount * 2),
  };
}
