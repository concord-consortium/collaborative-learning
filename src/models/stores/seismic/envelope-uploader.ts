import { AwsClient } from "aws4fetch";
import { Credentials, EnvironmentName, TokenServiceClient } from "@concord-consortium/token-service";
import {
  decodeEnvelopeTile, encodeEnvelopeTile, mergeEnvelopeTileData
} from "../../../../shared/seismic/envelopes/envelope-codec";
import {
  AWS_REGION, ENVELOPE_LAYOUT_VERSION, S3_PREFIX, TILE_BASE_URL
} from "../../../../shared/seismic/envelopes/envelope-config";
import { EnvelopeTileData, StationData } from "../../../../shared/seismic/seismic-types";
import { getS3Root, getTileS3Key } from "../../../../shared/seismic/envelopes/tile-addressing";

/** The subset of token-service `Credentials` the uploader needs to sign requests. */
export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

type SignFetchFn = (url: string, init: {
  method: string; body: ArrayBuffer; headers: Record<string, string>;
}) => Promise<Pick<Response, "ok" | "status">>;

export interface EnvelopeUploaderDeps {
  getCredentials: () => Promise<AwsCredentials>;
  /** Plain (anonymous) fetch used for the read side; tests inject a fake. */
  fetchFn?: typeof fetch;
  /** Signed fetch used for PUTs; the default signs with aws4fetch. Tests inject a fake. */
  signFetch?: SignFetchFn;
}

const MAX_CONFLICT_RETRIES = 3;

export interface EnvelopeUploader {
  uploadTile(stationData: StationData, level: number, tileIndex: number, tile: EnvelopeTileData): Promise<void>;
}

/**
 * Uploads envelope tiles to S3 with read-merge-conditional-write semantics:
 * the existing tile (if any) is fetched and merged with the new data, then the
 * PUT is guarded with If-Match/If-None-Match so concurrent writers can't
 * silently overwrite each other. On a 412 conflict the read-merge-write is
 * retried with fresh data.
 */
export function createEnvelopeUploader(deps: EnvelopeUploaderDeps): EnvelopeUploader {
  const fetchFn = deps.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const signFetch: SignFetchFn = deps.signFetch ?? (async (url, init) => {
    const { accessKeyId, secretAccessKey, sessionToken } = await deps.getCredentials();
    const aws = new AwsClient({ accessKeyId, secretAccessKey, sessionToken, service: "s3", region: AWS_REGION });
    // aws.fetch signs the request and also retries transient 5xx/429 responses internally.
    return aws.fetch(url, init);
  });

  return {
    async uploadTile(stationData, level, tileIndex, tile) {
      const url = `${TILE_BASE_URL}${getS3Root(S3_PREFIX)}${getTileS3Key(stationData, level, tileIndex)}`;
      for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt++) {
        // no-store: a cached GET would produce a stale ETag and a spurious 412 loop.
        // TODO: This line logs a console error when the tile is missing. Figure out another way to determine if a
        // tile is missing that doesn't pollute the console.
        const existing = await fetchFn(url, { cache: "no-store" });
        let merged = tile;
        let etag: string | null = null;
        if (existing.ok) {
          etag = existing.headers.get("ETag");
          if (!etag) {
            // Without the ETag the guarded PUT below would 412 on every attempt.
            const errorText = `Envelope tile ETag not readable — check the bucket CORS ExposeHeaders config (${url})`;
            throw new Error(errorText);
          }
          merged = mergeEnvelopeTileData(decodeEnvelopeTile(await existing.arrayBuffer()), tile);
        } else if (existing.status !== 404) {
          throw new Error(`Envelope tile read failed: ${existing.status}`);
        }
        const put = await signFetch(url, {
          method: "PUT",
          body: encodeEnvelopeTile(merged.mins, merged.maxs),
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "gzip",
            ...(etag ? { "If-Match": etag } : { "If-None-Match": "*" }),
          },
        });
        if (put.ok) return;
        // 412 = precondition failed, 409 = ConditionalRequestConflict (racing an in-flight
        // write); AWS documents both as retryable for conditional PUTs.
        if (put.status !== 412 && put.status !== 409) {
          throw new Error(`Envelope tile upload failed: ${put.status} (${url})`);
        }
      }
      throw new Error(`Envelope tile upload conflicted ${MAX_CONFLICT_RETRIES + 1} times (${url})`);
    },
  };
}

// ---- Credentials ----

/** Token-service resource id for the envelope tile folder, tied to the layout version. */
export const ENVELOPE_RESOURCE_ID = `v${ENVELOPE_LAYOUT_VERSION}`;
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

type GetCredentialsClient = Pick<TokenServiceClient, "getCredentials">;

export interface EnvelopeCredentialsDeps {
  /** Returns a fresh portal-signed Firebase JWT (admin: via OAuth token; Wave Runner: rawFirebaseJWT). */
  getJwt: () => Promise<string>;
  env?: EnvironmentName;
  /** Test seam. */
  createClient?: (jwt: string, env: EnvironmentName) => GetCredentialsClient;
}

/** getCredentials source for createEnvelopeUploader: token-service STS credentials, cached until near expiry. */
export function createEnvelopeCredentialsProvider(deps: EnvelopeCredentialsDeps) {
  const { getJwt, env = "production" } = deps;
  const createClient = deps.createClient ?? ((jwt, e) => new TokenServiceClient({ jwt, env: e }));
  let cached: Credentials | undefined;
  return async (): Promise<AwsCredentials> => {
    // `expiration` is typed as Date but arrives as an ISO string over JSON; new Date() handles both.
    if (cached && new Date(cached.expiration).getTime() - Date.now() > EXPIRY_MARGIN_MS) {
      return cached;
    }
    const client = createClient(await getJwt(), env);
    cached = await client.getCredentials(ENVELOPE_RESOURCE_ID);
    return cached;
  };
}
