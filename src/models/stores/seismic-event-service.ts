import firebase from "firebase/app";
import "firebase/firestore";
import {
  BYTES_PER_CHUNK, coveragePath, findUncoveredRanges, getChunkIndex, groupWindowsByChunk, setWindowBits
} from "../../../shared/seismic/event-database";
import { StationData, TimeRange } from "../../../shared/seismic/seismic-types";

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
