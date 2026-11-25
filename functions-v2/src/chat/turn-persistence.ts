import {createHash} from "node:crypto";
import {DocumentData, DocumentReference, FieldValue} from "firebase-admin/firestore";
import {FlDeliveryError} from "./fl-delivery-error";
import {TurnPersistence} from "./provider";

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonical(record[key])]));
  }
  return value;
}
function sourceHashOf(message: DocumentData | null): string {
  return hash(JSON.stringify(canonical(JSON.parse(JSON.stringify(message)))));
}

export function readReservedSnapshot<T extends object>(data: DocumentData, sourcePath: string,
  message: DocumentData): T {
  const sourceHash = sourceHashOf(message);
  if (data.version !== 1 || data.sourcePath !== sourcePath || data.sourceHash !== sourceHash ||
      typeof data.snapshotJson !== "string" || hash(data.snapshotJson) !== data.snapshotHash) {
    throw new FlDeliveryError("blocked", "FL_RESERVATION_CONFLICT", undefined,
      "Tutor pending request conflicts with its source message; refusing dispatch");
  }
  return JSON.parse(data.snapshotJson) as T;
}

// A top-level private collection is deliberate: qa/dev roots allow client writes to arbitrary
// descendants. No client rule grants access here, even for those modes. The drain deletes a
// reservation in the same commit as its reply (drain.ts).
export function createTurnPersistence(messageRef: DocumentReference, message: DocumentData,
  onReserved?: (snapshot: object) => Promise<void>):
    TurnPersistence & {ref: DocumentReference; reserved: boolean} {
  const db = messageRef.firestore;
  const ref = db.collection("chatTutorPendingRequests").doc(hash(messageRef.path));
  const sourceHash = sourceHashOf(message);
  let reserved = false;
  return {
    ref,
    get reserved() {
      return reserved;
    },
    async reserve<T extends object>(prepare: () => Promise<T>): Promise<T> {
      const snapshot = await db.runTransaction(async (tx) => {
        const existing = await tx.get(ref);
        const source = await tx.get(messageRef);
        const currentSourceHash = sourceHashOf(source.data() ?? null);
        if (!source.exists || currentSourceHash !== sourceHash) {
          throw new FlDeliveryError("blocked", "FL_SOURCE_CHANGED", undefined,
            "Tutor source message changed before reservation; refusing dispatch");
        }
        if (existing.exists) {
          reserved = true;
          return readReservedSnapshot<T>(existing.data()!, messageRef.path, message);
        }
        // No external/model calls in this callback. A transaction retry may prepare again but
        // only one candidate is persisted, and dispatch happens after this promise resolves.
        const snapshotJson = JSON.stringify(await prepare());
        if (Buffer.byteLength(snapshotJson, "utf8") > 980000) {
          throw new FlDeliveryError("blocked", "FL_RESERVATION_TOO_LARGE", undefined,
            "Tutor pending request exceeds the durable snapshot limit");
        }
        tx.create(ref, {version: 1, sourcePath: messageRef.path, sourceHash,
          snapshotJson, snapshotHash: hash(snapshotJson), createdAt: FieldValue.serverTimestamp()});
        reserved = true;
        return JSON.parse(snapshotJson) as T;
      });
      await onReserved?.(snapshot);
      return snapshot;
    },
  };
}
