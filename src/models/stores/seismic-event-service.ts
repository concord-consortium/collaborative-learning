import firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import {
  BYTES_PER_CHUNK, coveragePath, eventDocId, eventsPath, findUncoveredRanges, getChunkIndex,
  groupWindowsByChunk, setWindowBits
} from "../../../shared/seismic/event-database";
import { SeismicEvent } from "../../../shared/seismic/seismic-model-types";
import { StationData, TimeRange } from "../../../shared/seismic/seismic-types";
import { encodeLocation, getStationPrefix } from "../../../shared/seismic/tile-addressing";

/**
 * Firestore I/O for the seismic event database.
 */

/** Mark a (window-aligned) time range as processed. One transaction per 30-day chunk. */
export async function markCovered(stationData: StationData, model: string, range: TimeRange): Promise<void> {
  const firestore = firebase.firestore();
  for (const [chunkIndex, windows] of groupWindowsByChunk(range)) {
    const docRef = firestore.doc(coveragePath(stationData, model, chunkIndex));
    await firestore.runTransaction(async (txn) => {
      const snap = await txn.get(docRef);
      const bitmap = snap.exists
        ? (snap.data()!.bitmap as firebase.firestore.Blob).toUint8Array()
        : new Uint8Array(BYTES_PER_CHUNK);
      setWindowBits(bitmap, windows);
      txn.set(docRef, {
        bitmap: firebase.firestore.Blob.fromUint8Array(bitmap),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
  }
}

/** Fetch coverage bitmaps for a range and return its uncovered sub-ranges. */
export async function getUncoveredRanges(
  stationData: StationData, model: string, range: TimeRange
): Promise<TimeRange[]> {
  const firestore = firebase.firestore();
  const bitmaps = new Map<number, Uint8Array>();
  const startChunk = getChunkIndex(range.start);
  const endChunk = getChunkIndex(range.end);
  for (let chunk = startChunk; chunk <= endChunk; chunk++) {
    const snap = await firestore.doc(coveragePath(stationData, model, chunk)).get();
    if (snap.exists) {
      bitmaps.set(chunk, (snap.data()!.bitmap as firebase.firestore.Blob).toUint8Array());
    }
  }
  return findUncoveredRanges(bitmaps, range);
}

const MAX_BATCH_SIZE = 500; // Firestore write-batch limit

function getAuthenticatedUid(): string {
  const user = firebase.auth().currentUser;
  if (!user) {
    throw new Error("User must be authenticated to write events");
  }
  return user.uid;
}

/** Write detected events. Doc IDs dedupe re-detections; batches split at the Firestore limit. */
export async function writeEvents(
  stationData: StationData, model: string, events: SeismicEvent[]
): Promise<void> {
  const firestore = firebase.firestore();
  const createdBy = getAuthenticatedUid();
  const eventsRef = firestore.collection(eventsPath(stationData, model));
  for (let i = 0; i < events.length; i += MAX_BATCH_SIZE) {
    const batch = firestore.batch();
    for (const event of events.slice(i, i + MAX_BATCH_SIZE)) {
      batch.set(eventsRef.doc(eventDocId(event)), {
        station: getStationPrefix(stationData),
        location: encodeLocation(stationData.location),
        channel: stationData.channel,
        model,
        windowStart: firebase.firestore.Timestamp.fromMillis(event.windowStart),
        windowEnd: firebase.firestore.Timestamp.fromMillis(event.windowEnd),
        eventType: event.eventType,
        confidence: event.confidence,
        createdBy,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

/** Load stored events with windowStart in `range`, paging through large result sets. */
export async function loadEvents(
  stationData: StationData, model: string, range: TimeRange, pageSize = 500
): Promise<SeismicEvent[]> {
  const eventsRef = firebase.firestore().collection(eventsPath(stationData, model));
  const events: SeismicEvent[] = [];
  let lastDoc: firebase.firestore.QueryDocumentSnapshot | undefined;

  // eslint-disable-next-line no-constant-condition
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
    lastDoc = snap.docs[snap.docs.length - 1] as firebase.firestore.QueryDocumentSnapshot;
  }
  return events;
}
