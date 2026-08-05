import { decodeEnvelopeTile } from "./envelope-codec";
import { S3_PREFIX, getTileBaseUrl } from "./envelope-config";
import { FetchEnvelopeTileParams, EnvelopeTileData } from "../seismic-types";
import { getTileS3Key, getS3Root } from "./tile-addressing";

/**
 * Fetch a single precomputed envelope tile from S3 and decode it.
 * Returns null on 404 (tile doesn't exist for that time range).
 * Throws on other HTTP errors.
 */
export async function fetchEnvelopeTile(params: FetchEnvelopeTileParams): Promise<EnvelopeTileData | null> {
  const { stationData, level, tileIndex, signal } = params;
  const s3BaseUrl = params.s3BaseUrl ?? `${getTileBaseUrl()}${S3_PREFIX}`;

  const key = getTileS3Key(stationData, level, tileIndex);
  const url = `${getS3Root(s3BaseUrl)}${key}`;

  const response = await fetch(url, { signal });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Envelope tile fetch failed: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return decodeEnvelopeTile(buffer);
}
