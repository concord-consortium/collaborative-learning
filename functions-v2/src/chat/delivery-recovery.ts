import {DocumentReference, FieldValue, QueryDocumentSnapshot} from "firebase-admin/firestore";
import {ChatDelivery, deliveryMessage, readChatDelivery, recoveryAction} from "../../../shared/chat-delivery";
import {FlDeliveryError} from "./fl-delivery-error";
import {createTurnPersistence, readReservedSnapshot} from "./turn-persistence";
import {FlChatArgs} from "./fl-client";

// Errors reserve() itself raises are FlDeliveryErrors and keep their own state (blocked).
const kNotDispatched = "FL_NOT_DISPATCHED";

export async function recordPendingDelivery(parentRef: DocumentReference, source: QueryDocumentSnapshot,
  snapshot: object): Promise<void> {
  const request = (snapshot as {request?: FlChatArgs}).request;
  if (!request) return;
  const delivery: ChatDelivery = {id: crypto.randomUUID(), messageId: source.id,
    state: "unknown", code: "FL_REQUEST_PENDING", requestId: request.context.envelope.trace.request_id};
  const batch = parentRef.firestore.batch();
  batch.set(parentRef, {delivery, status: "generating"}, {merge: true});
  batch.update(createTurnPersistence(source.ref, source.data()).ref, {failure: delivery});
  await batch.commit();
}

export async function recordDeliveryFailure(parentRef: DocumentReference, source: QueryDocumentSnapshot,
  error: unknown): Promise<void> {
  const pending = createTurnPersistence(source.ref, source.data());
  const reserved = await pending.ref.get();
  // With no reservation the request was never dispatched, so a retry can rebuild it safely.
  const failure = error instanceof FlDeliveryError ? error : reserved.exists ?
    new FlDeliveryError("unknown", "FL_DELIVERY_UNCONFIRMED") : new FlDeliveryError("retryable", kNotDispatched);
  let snapshot;
  try {
    snapshot = reserved.exists ? JSON.parse(reserved.get("snapshotJson")) : undefined;
  } catch {/* fenced below */}
  const requestId = snapshot?.request?.context?.envelope?.trace?.request_id;
  const delivery: ChatDelivery = {id: crypto.randomUUID(), messageId: source.id,
    state: failure.state, code: failure.code, ...(requestId ? {requestId} : {})};
  const message = source.data();
  const batch = parentRef.firestore.batch();
  batch.set(parentRef, {delivery, status: "error", lockedAt: FieldValue.delete()}, {merge: true});
  if (reserved.exists) batch.update(pending.ref, {failure: delivery});
  batch.set(parentRef.collection("messages").doc(`delivery-${source.id}`), {
    kind: "delivery", text: deliveryMessage(delivery.state), sourceMessageId: source.id,
    uid: message.uid, context_id: message.context_id, problemPath: message.problemPath,
    code: delivery.code, state: delivery.state, resolved: false, createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

// A recovery command is an immutable client intent, not a learner turn. A fresh delivery id
// makes a delayed/duplicate click stale after the next outcome. Admin-only processedAt consumes
// the control once, even when its original trigger is redelivered.
export async function prepareRecovery(parentRef: DocumentReference, controlRef?: DocumentReference): Promise<boolean> {
  return parentRef.firestore.runTransaction(async (tx) => {
    const parent = (await tx.get(parentRef)).data() ?? {};
    const delivery = readChatDelivery(parent.delivery);
    if (parent.delivery !== undefined && !delivery) throw new Error("Recovery state is invalid; support is required");
    // With a delivery recorded, release the lock and keep the fence; without one, the drain may run.
    const keepFence = () => {
      if (delivery) {
        tx.set(parentRef, {status: delivery.state === "closed" ? "idle" : "error",
          lockedAt: FieldValue.delete()}, {merge: true});
      }
      return !delivery;
    };
    if (!controlRef) return keepFence();
    const control = await tx.get(controlRef);
    const data = control.data();
    const valid = data && !data.processedAt && data.kind === "recovery" &&
      data.uid === parent.uid && data.context_id === parent.context_id && data.problemPath === parent.problemPath &&
      delivery && data.recoveryId === delivery.id && data.action === recoveryAction(delivery.state);
    if (!valid) {
      if (control.exists && !data?.processedAt) {
        tx.update(controlRef,
          {processedAt: FieldValue.serverTimestamp(), disposition: "stale_or_invalid"});
      }
      return keepFence();
    }
    const sourceRef = parentRef.collection("messages").doc(delivery.messageId);
    const source = await tx.get(sourceRef);
    if (!source.exists) throw new Error("Recovery source is missing");
    const pending = createTurnPersistence(sourceRef, source.data()!);
    const saved = await tx.get(pending.ref);
    const notDispatched = delivery.code === kNotDispatched && !saved.exists;
    if (data.action !== "new_session" && !notDispatched &&
        (!saved.exists || saved.get("failure.id") !== delivery.id)) {
      throw new Error("Recovery has no matching server-owned failure receipt");
    }
    tx.update(controlRef, {processedAt: FieldValue.serverTimestamp(), disposition: "accepted"});
    if (data.action === "retry") return true; // keep the fence until a new durable outcome
    if (data.action === "continue") {
      if (saved.get("failure.state") !== "failed") throw new Error("Uncertain work cannot be skipped");
      const snapshot = readReservedSnapshot<{parentUpdate: Record<string, unknown>}>(saved.data()!, sourceRef.path,
        source.data()!);
      const earned = snapshot.parentUpdate;
      const rightContent = source.get("rightContent");
      if (!Number.isInteger(earned?.flTurn) || typeof earned?.flTraceId !== "string") {
        throw new Error("Recovery reservation is invalid");
      }
      tx.set(parentRef, {flTurn: earned.flTurn, flTraceId: earned.flTraceId,
        ...(typeof rightContent === "string" && rightContent ? {flContent: rightContent} : {}),
        lastProcessedMessageId: source.id, lastProcessedCreatedAt: source.get("createdAt"),
        delivery: FieldValue.delete(), error: FieldValue.delete()}, {merge: true});
      tx.delete(pending.ref);
      tx.set(parentRef.collection("messages").doc(`delivery-${source.id}`),
        {resolved: true, resolution: "continued"}, {merge: true});
    } else {
      if (saved.exists) throw new Error("Pending work cannot be bypassed by starting a new session");
      tx.set(parentRef, {flSessionId: FieldValue.delete(), flTraceId: FieldValue.delete(), flTurn: FieldValue.delete(),
        delivery: FieldValue.delete(), error: FieldValue.delete()}, {merge: true});
      tx.set(parentRef.collection("messages").doc(`delivery-${control.id}`), {
        kind: "delivery", text: "A new conversation has started. Earlier messages remain in this history.",
        uid: parent.uid, context_id: parent.context_id, problemPath: parent.problemPath,
        createdAt: FieldValue.serverTimestamp(), resolved: true,
      });
    }
    return true;
  });
}
