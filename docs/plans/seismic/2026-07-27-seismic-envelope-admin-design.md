# Design: Envelope coverage & upload in the seismic admin

**Date**: 2026-07-27
**Status**: Approved

## Goal

Add envelope tiles to the seismic admin's coverage workflow:

- Each station section shows an "Envelopes" coverage timeline of which days are covered by
  envelope tiles in S3.
- The existing Update / Update All buttons additionally generate missing envelope tiles from
  locally cached raw data and upload them to S3, **before** running event coverage.
- The envelope timeline fills in live as tiles are uploaded.

Part 2 (separate effort): the Wave Runner tile's "Load Data" button generates and uploads
envelopes using the same service. It is designed for here but built separately.

## Background / current state

- Envelope tiles live at `s3://models-resources/collaborative-learning/envelopes/v{N}/…`
  (`getS3Root` + `getTileS3Key`), currently layout version 2. The `v2/` prefix is **empty**
  today (only stale `v1/` and pre-versioned data exist), so there is no legacy data to merge —
  read-modify-write only matters at boundaries between successive generation runs.
- The admin page (`src/seismic-admin/`) already orchestrates: raw download into OPFS,
  per-model event coverage via `processUncoveredRanges`, three-state `RawTimeline`
  (covered/partial/missing), live fill via `markDayCached`/`markDayCovered`, anonymous
  Firebase auth (`admin-firebase.ts`).
- The only envelope writer today is `scripts/seismic/generate-envelopes.ts` (Node + AWS CLI
  credentials). Browsers have no S3 write path.
- token-service PR #84 (merged 2026-07-20) adds the `authenticated` access rule: any valid
  portal JWT can obtain temporary AWS credentials for an s3Folder resource. Such resources are
  created **by hand in the token-service Firestore** (never via API), with the doc id chosen so
  credentials scope to `{folder}/{id}/`.

## 1. Token-service & ops setup (manual, outside this repo)

In token-service Firestore (staging first, then production):

**Tool settings doc** in `{env}:resourceSettings`:

```js
{
  type: "s3Folder",
  tool: "seismic-envelopes",
  bucket: "models-resources",
  folder: "collaborative-learning/envelopes",
  region: "us-east-1",
  allowedAccessRuleTypes: [],   // no API-created resources for this tool
}
```

**Resource doc** in `{env}:resources` with hand-chosen doc id **`v2`**:

```js
{
  type: "s3Folder",
  tool: "seismic-envelopes",
  name: "Seismic envelope tiles v2",
  description: "CLUE envelope tile cache, layout version 2. Any portal user may write.",
  accessRules: [{ type: "authenticated" }],
}
```

Credentials then scope to exactly `collaborative-learning/envelopes/v2/` — the current
`getS3Root` prefix. A layout-version bump means adding a new resource doc (`v3`).

Caveat: resource ids share one collection across all tools, so the id `v2` is claimed
globally. Accepted — collisions with auto-generated 20-char ids are impossible, and other
hand-created resources are rare.

**Ops checklist** (prerequisites, tracked outside the repo):

1. token-service's STS role must be permitted on `models-resources` (its usual bucket is
   `token-service-files`; likely needs an IAM policy addition).
2. Verify `models-resources` CORS: `PUT` is already allowed; confirm
   `Access-Control-Allow-Headers` covers `authorization` and `x-amz-*` for signed browser PUTs.
3. Register a portal OAuth client for the admin page URLs (production
   `collaborative-learning.concord.org/seismic-admin/` and `localhost:8080` for dev).

## 2. Admin portal login

A "Log in with Portal" button in the admin header, using a hand-rolled OAuth2 implicit flow
(no new OAuth dependency):

1. Redirect to `{portal}/auth/oauth_authorize?response_type=token&client_id=…&redirect_uri=…`.
2. On return, parse `#access_token` from the fragment; keep it in sessionStorage so reloads
   survive within the session.
3. Exchange via `GET {portal}/api/v1/jwt/firebase?firebase_app=token-service` for the portal
   Firebase JWT (nested `claims: {user_id, platform_user_id, platform_id}` — the shape
   token-service verifies against `ADMIN_PUBLIC_KEY`). JWTs last ~1 h; re-exchange on expiry.
4. `new TokenServiceClient({ jwt, env })` → `getCredentials("v2")` → ~1 h STS credentials,
   re-fetched when expired.

Portal defaults to `learn.concord.org`, overridable by URL param for staging testing.

**Gating**: Update / Update All become disabled until portal login (they are already gated on
Firebase `authReady`). Raw download/delete and all coverage displays stay anonymous.

## 3. Envelope coverage display

**Detection approach: anonymous S3 listing** (verified working: `models-resources` allows
unauthenticated `ListObjectsV2` with CORS `Access-Control-Allow-Origin: *`).

Rejected alternatives: a coverage manifest object (second write path that can drift from the
actual tiles, needs its own conflict handling) and per-tile HEAD probes (~85 requests per
station-month).

New shared module (browser-safe, usable by Wave Runner later), e.g.
`shared/seismic/envelope-coverage.ts`:

- `listEnvelopeTileIndices(stationData): Promise<Set<number>>` — `ListObjectsV2` on
  `{getS3Root}{getStationChannelPrefix}/L2/`, paginated via continuation tokens, XML parsed
  with `DOMParser`. L2 alone determines coverage (a station-year is ~1,000 keys — one or two
  requests).
- `classifyEnvelopeDayCoverage(tileIndices, range): Map<number, DayCoverageState>` — a UTC day
  is `covered` when all of its ~3–4 overlapping L2 tiles (tiles are 8.75 h) exist, `partial`
  when some do, else missing. Same `DayCoverageState` shape as event coverage.

**Store**: `envelopeCoverage: Map<stationKey, CoverageStats>` — loaded alongside
`loadAllCoverageStats` but *not* gated on auth (listing is anonymous). The stats entry keeps
the tile-index `Set` so day states can be re-derived as uploads land.

**UI**: an "Envelopes" section rendered between Local Raw Data and the model coverage
sections — same header/stats/`RawTimeline` structure ("N / M days"), aggregate counts in the
all-stations section. Envelope coverage joins `isFullyCovered`: "Ready" now requires envelope
*and* all selected models covered, and Update stays enabled when only envelopes are missing.

## 4. Update flow: generate & upload envelopes

`updateSingleStation` becomes: **① download raw → ② envelope coverage → ③ event coverage per
model** (envelopes first — they are the cheap byproduct of the raw data the events step also
needs).

Step ② is a new `processEnvelopeCoverage` service in `src/models/stores/seismic/`, mirroring
`processUncoveredRanges`'s shape (options object, progress callbacks, injectable seams for
tests):

1. List existing L2 tiles; compute uncovered day spans within the range.
2. Per span: fresh `PipelineState`; stream OPFS raw day files →
   `computeEnvelopesFromRaw` → `quantize` → `processL2Point`, flushing per day and
   force-flushing at span end (the Node script's flow, minus ROVER file discovery). Channel
   sensitivity via the existing proxied `fetchStationMetadata`.
3. Per flushed tile: **merge-upload** —
   - GET the existing tile (noting its ETag), or confirm 404.
   - Merge elementwise: a sentinel yields to data; where both sides have data, take
     min-of-mins / max-of-maxes. This is exactly correct envelope semantics for two partial
     computations of the same window, which is what makes boundary L2 tiles and
     partially-covered L0/L1 tiles (an L0 tile spans ~6 months) safe to write incrementally.
   - Encode and `PUT` with `If-Match: <etag>` (or `If-None-Match: *` for new tiles), signed
     with the token-service STS credentials via **aws4fetch** (~6 KB; the one new runtime
     dependency besides `@concord-consortium/token-service`). On 412: re-read, re-merge,
     bounded retries.
4. `onTileUploaded(tileIndex)` after each successful PUT: the store folds the tile into that
   station's tile set and re-derives day states, so the envelope timeline fills in live
   (matching `markDayCached`/`markDayCovered`).

Failures follow the events pattern: per-span errors are logged and reported in feedback and
never mark coverage; a final listing reload per station reconciles the timeline with reality.

## Part 2 (Wave Runner — designed for, not built here)

The Wave Runner tile's "Load Data" button calls the same `processEnvelopeCoverage` service
(built separately; see `2026-07-30-wave-runner-envelope-load-data.md`). Credentials come from
exchanging the session's portal JWT for a `firebase_app=token-service` firebase JWT at click
time — the user's existing `rawFirebaseJWT` is minted for the `collaborative-learning`
firebase app, whose signature token-service's `ADMIN_PUBLIC_KEY` does not verify. In
dev/demo/qa modes no portal JWT exists, so the button is disabled.

## Testing

- Unit: coverage classification (tile↔day math), tile merge (sentinel/min/max cases), listing
  pagination + XML parsing (injected fetch), conditional-PUT retry on 412.
- Store: `processEnvelopeCoverage` injected as a dep (like `processCoverage`), live-fill
  behavior, `isFullyCovered` incorporating envelopes, auth gating of Update.
- Service: fake OPFS (existing `fake-opfs.ts`), fake uploader; verify generated tile bytes
  round-trip through `decodeEnvelopeTile`.
