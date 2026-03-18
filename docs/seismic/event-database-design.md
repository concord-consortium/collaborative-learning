# Seismic Event Database Design

## Overview

ML models running in the browser (or on a server pipeline) detect seismic events in waveform data. These detections need to be stored so that all CLUE users benefit from previously processed data — if one student runs the model on a station for a time range, every other student sees those results immediately.

This document describes the Firestore-based event database that stores ML-detected events and tracks which time ranges have been processed (coverage).

Related: [CLUE-463](https://concord-consortium.atlassian.net/browse/CLUE-463)

## Firestore Structure

### Events

One document per detected event, organized by station and model:

```
services/seismic/stations/{station}/models/{model}/events/{windowStart}_{eventType}
  station: string          // e.g., "K204" — denormalized for collection group queries
  model: string            // e.g., "compact-v1" — denormalized for collection group queries
  windowStart: Timestamp
  windowEnd: Timestamp
  eventType: string        // e.g., "earthquake", "traffic"
  confidence: number       // 0.0–1.0
  createdBy: string        // user ID
  createdAt: Timestamp
```

The `{station}` key uses the FDSN network+station format: `{network}_{station}` (e.g., `AK_K204`). This is globally unique across data providers — station codes alone are only unique within a network.

The document ID is `{windowStart}_{eventType}` (e.g., `1710720000000_earthquake`). The composite key supports multiple events per window (a multi-class model may detect both traffic and earthquake in the same window) while providing natural deduplication — two users detecting the same event just overwrite with the same data.

The primary query pattern is single station + single model + time range. The denormalized `station` and `model` fields exist to support future collection group queries across stations if needed.

### Coverage

Bitmap-based tracking of which time ranges have been processed. Each bit represents a 10-minute coverage window. Documents are chunked into 30-day periods.

```
services/seismic/stations/{station}/models/{model}/coverage/{chunkIndex}
  bitmap: Bytes            // Uint8Array, 1 bit per 10-min window, 540 bytes per 30-day chunk
  updatedAt: Timestamp
```

`chunkIndex` is computed from a fixed epoch:

```
epoch = Jan 1 2020 UTC
chunkIndex = floor((timestamp - epoch) / (30 days))
```

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
match /services/seismic/stations/{station}/models/{model} {

  match /events/{eventId} {
    allow read: if request.auth != null;
    allow write: if request.auth != null
                 && request.resource.data.createdBy == request.auth.uid
                 && request.resource.data.station == station
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

- **Read**: any authenticated CLUE user.
- **Event writes**: authenticated, `createdBy` must match auth UID, denormalized `station` and `model` fields must match the collection path.
- **Coverage writes**: authenticated, validates `bitmap` is bytes and `updatedAt` is a timestamp.
- **Server-side writes** (future batch pipeline): use the Firebase Admin SDK, which bypasses security rules.

## Browser Code

### Constants

```typescript
const COVERAGE_EPOCH = Date.UTC(2020, 0, 1); // Jan 1 2020
const CHUNK_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const WINDOW_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const WINDOWS_PER_CHUNK = 4320;
const BYTES_PER_CHUNK = Math.ceil(WINDOWS_PER_CHUNK / 8); // 540
```

### Coverage: index computation

```typescript
function getChunkIndex(timestamp: number): number {
  return Math.floor((timestamp - COVERAGE_EPOCH) / CHUNK_DURATION_MS);
}

function getWindowIndex(timestamp: number): number {
  const chunkStart = getChunkIndex(timestamp) * CHUNK_DURATION_MS + COVERAGE_EPOCH;
  return Math.floor((timestamp - chunkStart) / WINDOW_DURATION_MS);
}
```

### Coverage: writing (after running the model)

```typescript
async function markCovered(
  station: string, model: string, startTime: number, endTime: number
) {
  // Group windows by chunk
  const chunkUpdates = new Map<number, number[]>();
  for (let t = startTime; t < endTime; t += WINDOW_DURATION_MS) {
    const chunk = getChunkIndex(t);
    const window = getWindowIndex(t);
    if (!chunkUpdates.has(chunk)) chunkUpdates.set(chunk, []);
    chunkUpdates.get(chunk)!.push(window);
  }

  // Transaction per chunk: read bitmap, OR in new bits, write back
  for (const [chunkIndex, windows] of chunkUpdates) {
    const docRef = doc(db, "services", "seismic", "stations", station, "models", model, "coverage", String(chunkIndex));
    await runTransaction(db, async (txn) => {
      const snap = await txn.get(docRef);
      const bitmap = snap.exists()
        ? snap.data().bitmap.toUint8Array()
        : new Uint8Array(BYTES_PER_CHUNK);
      for (const w of windows) {
        bitmap[Math.floor(w / 8)] |= (1 << (w % 8));
      }
      txn.set(docRef, { bitmap: Bytes.fromUint8Array(bitmap), updatedAt: serverTimestamp() });
    });
  }
}
```

### Coverage: reading (to find gaps)

```typescript
async function getUncoveredRanges(
  station: string, model: string, startTime: number, endTime: number
): Promise<Array<{ start: number; end: number }>> {
  const startChunk = getChunkIndex(startTime);
  const endChunk = getChunkIndex(endTime);

  const gaps: Array<{ start: number; end: number }> = [];
  let currentGapStart: number | null = null;

  for (let chunk = startChunk; chunk <= endChunk; chunk++) {
    const docRef = doc(db, "services", "seismic", "stations", station, "models", model, "coverage", String(chunk));
    const snap = await get(docRef);
    const bitmap = snap.exists()
      ? snap.data().bitmap.toUint8Array()
      : new Uint8Array(BYTES_PER_CHUNK);

    const chunkStart = chunk * CHUNK_DURATION_MS + COVERAGE_EPOCH;
    for (let w = 0; w < WINDOWS_PER_CHUNK; w++) {
      const windowTime = chunkStart + w * WINDOW_DURATION_MS;
      if (windowTime < startTime || windowTime >= endTime) continue;

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
    gaps.push({ start: currentGapStart, end: Math.min(endTime, (endChunk + 1) * CHUNK_DURATION_MS + COVERAGE_EPOCH) });
  }
  return gaps;
}
```

### Events: writing (after running the model)

```typescript
interface SeismicEvent {
  windowStart: number;
  windowEnd: number;
  eventType: string;
  confidence: number;
}

async function writeEvents(
  station: string, model: string, events: SeismicEvent[]
) {
  const batch = writeBatch(db);
  for (const event of events) {
    const docId = `${event.windowStart}_${event.eventType}`;
    const docRef = doc(
      db, "services", "seismic", "stations", station, "models", model, "events", docId
    );
    batch.set(docRef, {
      station,
      model,
      windowStart: Timestamp.fromMillis(event.windowStart),
      windowEnd: Timestamp.fromMillis(event.windowEnd),
      eventType: event.eventType,
      confidence: event.confidence,
      createdBy: auth.currentUser!.uid,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}
```

Firestore batches are limited to 500 writes. If a model run produces more than 500 events, split into multiple batches. In practice this is unlikely for a single run — 500 events in a time range would mean ~167 hours at 5% event rate with 60s windows.

### Events: reading (when user clicks "Load Data")

```typescript
async function loadEvents(
  station: string, model: string, startTime: number, endTime: number,
  pageSize = 500
): Promise<SeismicEvent[]> {
  const eventsRef = collection(db, "services", "seismic", "stations", station, "models", model, "events");
  const events: SeismicEvent[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    let q = query(
      eventsRef,
      where("windowStart", ">=", Timestamp.fromMillis(startTime)),
      where("windowStart", "<", Timestamp.fromMillis(endTime)),
      orderBy("windowStart"),
      limit(pageSize),
      ...(lastDoc ? [startAfter(lastDoc)] : [])
    );
    const snap = await getDocs(q);
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

1. User selects station, model, and time range in the Wave Runner tile.
2. UI fetches coverage bitmaps → shows preview of what's been modeled vs. gaps.
3. User clicks "Load Data" → paged query fetches events → populates SharedDataSet → Timeline tile renders events.
4. User clicks "Run Model" → model runs on uncovered time ranges → writes events + marks coverage → SharedDataSet updated.

## Cost Estimates

At 1,000 station-years (the large scale scenario from [seismic-cost-estimates.md](seismic-cost-estimates.md)):

**Coverage storage**: 13 docs × 540 bytes × 1,000 = ~7 MB. Negligible.

**Event storage**: At 5% event rate with 60s windows, ~26 million event documents. Each doc is small (~200 bytes), total ~5.2 GB. Firestore storage at $0.18/GB = ~$0.94/month.

**Event reads**: Loading a year of events for one station+model = ~26K reads = $0.016. Coverage check for a year = 13 reads = negligible.

**Event writes**: 26 million writes at $0.18/100K = ~$47 one-time. This is spread across all users contributing model results.
