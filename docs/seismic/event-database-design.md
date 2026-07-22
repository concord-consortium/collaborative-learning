# Seismic Event Database Design

## Overview

ML models running in the browser (or on a server pipeline) detect seismic events in waveform data. These detections need to be stored so that all CLUE users benefit from previously processed data — if one student runs the model on a station for a time range, every other student sees those results immediately.

This document describes the Firestore-based event database that stores ML-detected events and tracks which time ranges have been processed (coverage).

Related: [CLUE-463](https://concord-consortium.atlassian.net/browse/CLUE-463)

## Firestore Structure

### Events

One document per detected event, organized by station, channel, and model:

```
services/seismic/versions/{version}/stations/{station}/locations/{location}/channels/{channel}/models/{model}/events/{windowStart}_{eventType}
  station: string          // e.g., "AK_K204" — denormalized for collection group queries
  location: string         // e.g., "00" ("--" for blank) — denormalized for collection group queries
  channel: string          // e.g., "BHZ" — denormalized for collection group queries
  model: string            // e.g., "compact-v1" — denormalized for collection group queries
  windowStart: Timestamp
  windowEnd: Timestamp
  eventType: string        // e.g., "earthquake", "traffic"
  confidence: number       // 0.0–1.0
  createdBy: string        // Firebase auth UID
  createdAt: Timestamp
```

The `{version}` segment is `v{EVENT_LAYOUT_VERSION}` (e.g., `v1`), mirroring the envelope cache's `ENVELOPE_LAYOUT_VERSION`: bump the constant in [event-database.ts](../../shared/seismic/event-database.ts) whenever the layout constants (coverage epoch, window/chunk durations) or the event document schema change, and all clients switch to a fresh subtree rather than misinterpreting old data. The security rules match `{version}` as a wildcard, so a bump does not require a rules deploy.

The `{station}` key uses the FDSN network+station format: `{network}_{station}` (e.g., `AK_K204`), as produced by `getStationPrefix` in [tile-addressing.ts](../../shared/seismic/tile-addressing.ts). This is globally unique across data providers — station codes alone are only unique within a network. The `{location}` is the SEED location code encoded with `encodeLocation` (blank becomes `--`, since Firestore path segments cannot be empty); it is its own segment because a station can host multiple instruments that share a channel code but differ by location. The `{channel}` is a separate path segment because different channels (e.g., BHZ vs BNZ) have different sample rates and physical units, and the ML model produces different results for each. The station/location/channel ordering matches the envelope tile cache (`getStationChannelPrefix`). See [seismic-tiles-plan.md](seismic-tiles-plan.md#station-identification-across-systems) for the full convention.

The document ID is `{windowStart}_{eventType}` (e.g., `1710720000000_earthquake`), where `windowStart` is epoch ms, matching `SeismicEvent.windowStart`. The composite key supports multiple events per window (a multi-class model may detect both traffic and earthquake in the same window) while providing natural deduplication — two users detecting the same event just overwrite with the same data.

The primary query pattern is single station + single model + time range. The denormalized `station` and `model` fields exist to support future collection group queries across stations if needed.

### Coverage

Bitmap-based tracking of which time ranges have been processed. Each bit represents a 10-minute coverage window. Documents are chunked into 30-day periods.

```
services/seismic/versions/{version}/stations/{station}/locations/{location}/channels/{channel}/models/{model}/coverage/{chunkIndex}
  bitmap: Bytes            // Uint8Array, 1 bit per 10-min window, 540 bytes per 30-day chunk
  updatedAt: Timestamp
```

`chunkIndex` is computed from a fixed epoch:

```
epoch = Jan 1 2020 UTC
chunkIndex = floor((timestamp - epoch) / (30 days))
```

Coverage means "processed", independent of whether events were found. Days where the
station simply has no data (empty days) ARE marked covered — no data is a processed
result. Days whose download or processing errored are NOT marked covered, so later
runs retry them.

Write ordering contract: events are written before coverage is marked. A failed event
write therefore never strands covered-but-eventless windows — the day stays uncovered
and a later run re-detects and re-writes its events.

#### Why bitmaps

Coverage needs to track "has this time range been processed?" independently of whether events were found — a time range with no detected events must be distinguishable from an unprocessed range. The bitmap approach:

- **Compact**: 540 bytes per 30-day chunk. At 1,000 station-years, total coverage data is ~6.5 MB.
- **Efficient reads**: checking a full year of coverage is 13 document reads.
- **Concurrent writes handled by transactions**: read the bitmap, OR in new bits, write it back. Idempotent — processing the same range twice produces the same result.

#### Why 10-minute coverage windows

The coverage window granularity is independent of the ML model's classification window (which may be 15s or 60s). 10 minutes was chosen as a balance:

- Small enough that students aren't forced to process much extra data when filling gaps.
- Large enough to keep the bitmap compact.
- Worst-case waste when filling a partial gap: ~2.5 MB of raw data download, < 1 second of model time.

#### Alternative considered: arrayUnion

Firestore's `arrayUnion` would avoid transactions by storing coverage as an array of window indices. However, at 1,000 station-years fully covered, this approach uses ~408 MB vs. ~6.5 MB for bitmaps — a 63x difference. The bitmap approach with transactions is more storage-efficient, and concurrent writes to the same station+model+chunk are rare in practice.

## Security Rules

```javascript
match /services/seismic/versions/{version}/stations/{station}/locations/{location}/channels/{channel}/models/{model} {

  match /events/{eventId} {
    allow read: if request.auth != null;
    allow write: if request.auth != null
                 && request.resource.data.createdBy == request.auth.uid
                 && request.resource.data.station == station
                 && request.resource.data.location == location
                 && request.resource.data.channel == channel
                 && request.resource.data.model == model;
  }

  match /coverage/{chunkId} {
    allow read: if request.auth != null;
    allow write: if request.auth != null
                 && request.resource.data.bitmap is bytes
                 && request.resource.data.updatedAt is timestamp;
  }
}
```

- **Read**: any authenticated CLUE user (including anonymous Firebase auth).
- **Event writes**: authenticated, `createdBy` must match the Firebase auth UID, denormalized `station`, `location`, `channel`, and `model` fields must match the collection path.
- **Coverage writes**: authenticated, validates `bitmap` is bytes and `updatedAt` is a timestamp.
- **Server-side writes** (future batch pipeline): use the Firebase Admin SDK, which bypasses security rules.

**Privacy note on `createdBy`:** The `createdBy` field stores the Firebase auth UID (`request.auth.uid`). For anonymous users this is a random Firebase-generated ID with no identity attached. For portal-launched users it is the `uid` from the portal-issued Firebase JWT — a portal-derived identifier. Since all authenticated CLUE users can read events, these IDs are exposed in globally readable data. This is acceptable because the IDs are opaque — connecting one to an actual user requires portal admin access. In theory, someone could cross-reference the same ID across multiple systems to build a footprint for a user, but mitigating that would require maintaining a mapping from random anonymous IDs to actual user IDs, which adds significant complexity. We've evaluated this tradeoff in other Concord systems and concluded it is acceptable.

## Browser Code

Code samples use the Firebase 8 namespaced API (what CLUE is on) and the existing shared seismic types:

```typescript
import firebase from "firebase/app";
import { StationData, TimeRange } from "shared/seismic/seismic-types";
import { SeismicEvent } from "shared/seismic/seismic-model-types";
import { encodeLocation, getStationPrefix } from "shared/seismic/tile-addressing";
```

(Import paths shown from the repo root for brevity; the codebase uses relative imports, e.g. `../../../shared/seismic/seismic-types` from `src/models/stores/`.)

**Unit convention:** `TimeRange` is in Unix **seconds** (per its definition in seismic-types.ts), so all coverage math below works in seconds. `SeismicEvent` timestamps are epoch **ms**. Conversion to ms happens only at the Firestore `Timestamp` boundary and in event document IDs.

### Constants and paths

```typescript
/** Layout version -- update this when the constants below or the event doc schema change */
const EVENT_LAYOUT_VERSION = 1;

const COVERAGE_EPOCH = Date.UTC(2020, 0, 1) / 1000; // Jan 1 2020, Unix seconds
const CHUNK_DURATION_S = 30 * 24 * 60 * 60; // 30 days
const WINDOW_DURATION_S = 10 * 60; // 10 minutes
const WINDOWS_PER_CHUNK = CHUNK_DURATION_S / WINDOW_DURATION_S; // 4320
const BYTES_PER_CHUNK = Math.ceil(WINDOWS_PER_CHUNK / 8); // 540

/** Firestore path to a station+location+channel+model container document. */
function modelPath(stationData: StationData, model: string): string {
  return `services/seismic/versions/v${EVENT_LAYOUT_VERSION}` +
    `/stations/${getStationPrefix(stationData)}` +
    `/locations/${encodeLocation(stationData.location)}` +
    `/channels/${stationData.channel}/models/${model}`;
}

/** Firestore path to a coverage chunk document. */
function coveragePath(stationData: StationData, model: string, chunkIndex: number): string {
  return `${modelPath(stationData, model)}/coverage/${chunkIndex}`;
}

/** Firestore path to a model's events collection. */
function eventsPath(stationData: StationData, model: string): string {
  return `${modelPath(stationData, model)}/events`;
}
```

### Authentication

```typescript
function getAuthenticatedUid(): string {
  const user = firebase.auth().currentUser;
  if (!user) {
    throw new Error("User must be authenticated to write events");
  }
  return user.uid;
}
```

**Decision:** CLUE supports anonymous Firebase auth (students using CLUE without a portal login). Anonymous users have a Firebase UID, so they pass the `request.auth != null` security rule, and they **are** allowed to contribute events and coverage to the shared database — their `createdBy` is a random Firebase UID. If this is revisited later, the security rules would need to additionally check for a portal-linked account (e.g., via a custom claim such as `request.auth.token.platform_user_id`, the pattern used elsewhere in firestore.rules), and the client code would gate the "Run Model" button on portal authentication.

### Coverage: index computation

```typescript
// All times in Unix seconds, matching TimeRange.

function getChunkIndex(timeSec: number): number {
  return Math.floor((timeSec - COVERAGE_EPOCH) / CHUNK_DURATION_S);
}

function getChunkStart(chunkIndex: number): number {
  return chunkIndex * CHUNK_DURATION_S + COVERAGE_EPOCH;
}

function getChunkEnd(chunkIndex: number): number {
  return getChunkStart(chunkIndex + 1);
}

function getWindowIndex(timeSec: number): number {
  const chunkStart = getChunkStart(getChunkIndex(timeSec));
  return Math.floor((timeSec - chunkStart) / WINDOW_DURATION_S);
}
```

### Coverage: writing (after running the model)

```typescript
async function markCovered(stationData: StationData, model: string, range: TimeRange) {
  // Group windows by chunk
  const chunkUpdates = new Map<number, number[]>();
  for (let t = range.start; t < range.end; t += WINDOW_DURATION_S) {
    const chunk = getChunkIndex(t);
    const window = getWindowIndex(t);
    if (!chunkUpdates.has(chunk)) chunkUpdates.set(chunk, []);
    chunkUpdates.get(chunk)!.push(window);
  }

  // Transaction per chunk: read bitmap, OR in new bits, write back
  const firestore = firebase.firestore();
  for (const [chunkIndex, windows] of chunkUpdates) {
    const docRef = firestore.doc(coveragePath(stationData, model, chunkIndex));
    await firestore.runTransaction(async (txn) => {
      const snap = await txn.get(docRef);
      const bitmap = snap.exists
        ? (snap.data()!.bitmap as firebase.firestore.Blob).toUint8Array()
        : new Uint8Array(BYTES_PER_CHUNK);
      for (const w of windows) {
        bitmap[Math.floor(w / 8)] |= (1 << (w % 8));
      }
      txn.set(docRef, {
        bitmap: firebase.firestore.Blob.fromUint8Array(bitmap),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
  }
}
```

### Coverage: reading (to find gaps)

```typescript
async function getUncoveredRanges(
  stationData: StationData, model: string, range: TimeRange
): Promise<TimeRange[]> {
  const firestore = firebase.firestore();
  const startChunk = getChunkIndex(range.start);
  const endChunk = getChunkIndex(range.end);

  const gaps: TimeRange[] = [];
  let currentGapStart: number | null = null;

  for (let chunk = startChunk; chunk <= endChunk; chunk++) {
    const docRef = firestore.doc(coveragePath(stationData, model, chunk));
    const snap = await docRef.get();
    const bitmap = snap.exists
      ? (snap.data()!.bitmap as firebase.firestore.Blob).toUint8Array()
      : new Uint8Array(BYTES_PER_CHUNK);

    const chunkStart = getChunkStart(chunk);
    for (let w = 0; w < WINDOWS_PER_CHUNK; w++) {
      const windowTime = chunkStart + w * WINDOW_DURATION_S;
      if (windowTime < range.start || windowTime >= range.end) continue;

      const covered = (bitmap[Math.floor(w / 8)] & (1 << (w % 8))) !== 0;
      if (!covered && currentGapStart === null) {
        currentGapStart = windowTime;
      } else if (covered && currentGapStart !== null) {
        gaps.push({ start: currentGapStart, end: windowTime });
        currentGapStart = null;
      }
    }
  }
  if (currentGapStart !== null) {
    gaps.push({ start: currentGapStart, end: Math.min(range.end, getChunkEnd(endChunk)) });
  }
  return gaps;
}
```

### Events: writing (after running the model)

Events use the existing `SeismicEvent` type from [seismic-model-types.ts](../../shared/seismic/seismic-model-types.ts) (`windowStart`/`windowEnd` in epoch ms), which is what the model runner already produces.

```typescript
function eventDocId(event: SeismicEvent): string {
  return `${event.windowStart}_${event.eventType}`;
}

async function writeEvents(stationData: StationData, model: string, events: SeismicEvent[]) {
  const firestore = firebase.firestore();
  const batch = firestore.batch();
  for (const event of events) {
    const docRef = firestore.collection(eventsPath(stationData, model)).doc(eventDocId(event));
    batch.set(docRef, {
      station: getStationPrefix(stationData),
      location: encodeLocation(stationData.location),
      channel: stationData.channel,
      model,
      windowStart: firebase.firestore.Timestamp.fromMillis(event.windowStart),
      windowEnd: firebase.firestore.Timestamp.fromMillis(event.windowEnd),
      eventType: event.eventType,
      confidence: event.confidence,
      createdBy: getAuthenticatedUid(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}
```

Firestore batches are limited to 500 writes. If a model run produces more than 500 events, split into multiple batches. In practice this is unlikely for a single run — 500 events in a time range would mean ~167 hours at 5% event rate with 60s windows.

### Events: reading (when user clicks "Load Data")

```typescript
async function loadEvents(
  stationData: StationData, model: string, range: TimeRange, pageSize = 500
): Promise<SeismicEvent[]> {
  const eventsRef = firebase.firestore().collection(eventsPath(stationData, model));
  const events: SeismicEvent[] = [];
  let lastDoc: firebase.firestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let q = eventsRef
      .where("windowStart", ">=", firebase.firestore.Timestamp.fromMillis(range.start * 1000))
      .where("windowStart", "<", firebase.firestore.Timestamp.fromMillis(range.end * 1000))
      .orderBy("windowStart")
      .limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    for (const d of snap.docs) {
      events.push({
        windowStart: d.data().windowStart.toMillis(),
        windowEnd: d.data().windowEnd.toMillis(),
        eventType: d.data().eventType,
        confidence: d.data().confidence,
      });
    }
    if (snap.docs.length < pageSize) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }
  return events;
}
```

## Typical UI Flow

1. User selects a station (network + station + location + channel, i.e. a `StationData`), model, and time range in the Wave Runner tile.
2. User clicks "Run Model" → prior events and coverage are loaded from the database → the model runs only on uncovered days → new events are written and coverage marked per completed day → prior + new events populate the SharedDataSet → Timeline tile renders events.

Future work: a coverage-preview UI (showing what's been modeled vs. gaps before running) and a separate "Load Data" action that fetches stored events without running the model.

## Cost Estimates

At 1,000 station-years (the large scale scenario from [seismic-cost-estimates.md](seismic-cost-estimates.md)):

**Coverage storage**: 13 docs × 540 bytes × 1,000 = ~7 MB. Negligible.

**Event storage**: At 5% event rate with 60s windows, ~26 million event documents. Each doc is small (~200 bytes), total ~5.2 GB. Firestore storage at $0.18/GB = ~$0.94/month.

**Event reads**: Loading a year of events for one station+model = ~26K reads = $0.016. Coverage check for a year = 13 reads = negligible.

**Event writes**: 26 million writes at $0.18/100K = ~$47 one-time. This is spread across all users contributing model results.
