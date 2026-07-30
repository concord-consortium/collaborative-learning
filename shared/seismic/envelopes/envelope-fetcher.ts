import { decodeEnvelopeTile } from "./envelope-codec";
import { S3_PREFIX, TILE_BASE_URL } from "./envelope-config";
import { FetchEnvelopeTileParams, EnvelopeTileData } from "../seismic-types";
import { getTileS3Key, getS3Root } from "./tile-addressing";

const DEFAULT_S3_BASE_URL = `${TILE_BASE_URL}${S3_PREFIX}`;

/**
 * Fetch a single precomputed envelope tile from S3 and decode it.
 * Returns null on 404 (tile doesn't exist for that time range).
 * Throws on other HTTP errors.
 */
export async function fetchEnvelopeTile(params: FetchEnvelopeTileParams): Promise<EnvelopeTileData | null> {
  const { stationData, level, tileIndex, signal } = params;
  const s3BaseUrl = params.s3BaseUrl ?? DEFAULT_S3_BASE_URL;

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
