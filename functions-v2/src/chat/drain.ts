// Chat-tutor drain engine — the lock + drain + per-turn processing logic, separated from the
// trigger wiring in ../chat-tutor.ts. This module imports firebase-admin (+ the chat helpers),
// NOT firebase-functions, so the drain/lock logic is testable against the Firestore emulator
// with a fake OpenAI.
//
// Uses the modular firebase-admin/firestore imports (not admin.firestore.FieldValue etc.): the
// functions emulator proxies the firebase-admin module and the namespace statics come through
// undefined there, while the modular entry points work in both the emulator and production.
import {
  CollectionReference, DocumentData, DocumentReference, FieldPath as FirestoreFieldPath, FieldValue,
  Query, QueryDocumentSnapshot, getFirestore,
} from "firebase-admin/firestore";

import {
  createOpenAIClient, createConversation, installDeveloperPrompt, createTutorResponse,
} from "./openai";
import {assembleTurnContext} from "./context-assembly";

// reclaim a lock whose owner crashed mid-drain, so a conversation can't wedge forever.
// INVARIANT: STALE_LOCK_MS must exceed the function's configured timeout (default 60s, no
// timeoutSeconds set), or a still-running slow drain could be reclaimed by a racing trigger →
// two concurrent drains. If timeoutSeconds is ever raised, raise this above it.
const STALE_LOCK_MS = 5 * 60 * 1000;
// One drain query page. NOTE: function-written assistant docs (kind filtered out in JS) carry a
// later serverTimestamp() than still-queued older messages, so during a deep backlog they
// accumulate ahead of the cursor and can fill the whole limit(DRAIN_BATCH) window — an empty
// `pending` in a full window is therefore NOT proof the queue is empty. The idle branch handles
// this with an explicit window-saturation guard.
const DRAIN_BATCH = 200;
// Safety valve against a pathological drain loop (see the throw at the end of processAndDrain).
const MAX_DRAIN_TURNS = 100;

type MsgSnap = QueryDocumentSnapshot;
type ParentRef = DocumentReference;
type MsgCol = CollectionReference;

export interface DrainContext {
  parentRef: ParentRef;
  messagesCol: MsgCol;
  openai: ReturnType<typeof createOpenAIClient>;
  model: string;
  genericText: string;
}

// The owner fields the client's rules require on any doc it reads — copied off the triggering
// message onto function-written docs (assistant messages, the function-created parent). This is
// the only channel through which the parent gets its {uid, context_id, problemPath} stamp.
export function pickOwnerFields(data: DocumentData | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data?.uid !== undefined) out.uid = data.uid;
  if (data?.context_id !== undefined) out.context_id = data.context_id;
  if (data?.problemPath !== undefined) out.problemPath = data.problemPath;
  return out;
}

// The side effects of processing one message, for the caller to commit atomically with the
// cursor advance.
interface UnitResult {
  // written even for a userText:null reply so the client's "awaiting" indicator clears
  assistant: Record<string, unknown>;
  // parent-doc fields to persist this turn (conversationId/problemInstalled/seq, once earned)
  parentUpdate: Record<string, unknown>;
}

// Process one user message: ensure the conversation + developer items exist, call OpenAI, and
// RETURN the resulting writes (assistant doc + parent updates). The caller commits them in ONE
// batch together with the cursor advance, so a crash between the reply and the cursor can't
// leave a duplicate assistant doc.
async function processUnit(ctx: DrainContext, doc: MsgSnap): Promise<UnitResult> {
  const {parentRef, openai, model} = ctx;
  const data = doc.data();
  const ownerFields = pickOwnerFields(data);

  // Per-conversation state is read fresh each turn (no in-memory state). The lock serializes
  // turns, so the seq increment below can't race across invocations.
  const parent = (await parentRef.get()).data() ?? {};
  let conversationId: string | undefined = parent.conversationId;
  if (!conversationId) {
    // do NOT persist conversationId yet — only after the install + first response succeed.
    conversationId = await createConversation(openai);
  }
  // "install once" is gated on problemInstalled (not on conversationId existing), so a crash
  // mid-setup re-writes the developer items next turn instead of running context-blind. An
  // empty LEFT leaves the flag unset (see context-assembly), keeping the recovery path open.
  const turn = assembleTurnContext({
    genericText: ctx.genericText,
    problemInstalled: !!parent.problemInstalled,
    parentSeq: parent.seq,
    message: data,
  });
  for (const item of turn.installItems) {
    await installDeveloperPrompt(openai, conversationId, item);
  }

  const {userText} = await createTutorResponse(openai, {model, conversationId, input: turn.input});

  // only NOW (developer items written + response succeeded) is conversationId/problemInstalled/
  // seq earned; the caller persists them (batched with the cursor) so they commit atomically.
  const parentUpdate: Record<string, unknown> = {};
  if (!parent.conversationId) {
    parentUpdate.conversationId = conversationId;
  }
  if (turn.markProblemInstalled) {
    parentUpdate.problemInstalled = true;
  }
  if (turn.seq !== undefined) {
    parentUpdate.seq = turn.seq;
  }

  // Stamp owner fields so the client's owner-only onSnapshot can read the reply; write even a
  // userText:null assistant doc so the client's "awaiting" indicator clears.
  const assistant = {
    kind: "assistant",
    userText,
    createdAt: FieldValue.serverTimestamp(),
    ...ownerFields,
  };

  return {assistant, parentUpdate};
}

export async function processAndDrain(ctx: DrainContext): Promise<void> {
  const {parentRef, messagesCol} = ctx;
  const db = getFirestore();
  const FieldPath = FirestoreFieldPath;

  // order on (createdAt, __name__) so the cursor is deterministic even when messages share a
  // serverTimestamp() millisecond; range-only (no kind filter) so it needs NO composite index —
  // `kind` is filtered in JS below.
  const afterCursorQuery = (cursor: MsgSnap | null) => {
    let q: Query = messagesCol
      .orderBy("createdAt")
      .orderBy(FieldPath.documentId())
      .limit(DRAIN_BATCH);
    if (cursor) q = q.startAfter(cursor);
    return q;
  };
  const isPending = (d: MsgSnap) => d.get("kind") === "user";

  // Load the persisted cursor so a cold start / re-trigger continues where the last invocation
  // stopped.
  const p0 = (await parentRef.get()).data() ?? {};
  let lastSnap: MsgSnap | null = null;
  if (p0.lastProcessedMessageId) {
    const cursorSnap = await messagesCol.doc(p0.lastProcessedMessageId).get();
    if (cursorSnap.exists) lastSnap = cursorSnap as MsgSnap;
  }

  for (let i = 0; i < MAX_DRAIN_TURNS; i++) {
    const batch = await afterCursorQuery(lastSnap).get();
    const pending = batch.docs.filter(isPending);

    if (pending.length === 0) {
      // Window saturated with non-pending (assistant) docs? A FULL window with no pending doc is
      // not proof the queue is empty — a genuinely-pending message could sit at position
      // DRAIN_BATCH+1 behind the accumulated assistant docs. So don't idle: advance the
      // IN-MEMORY scan cursor past this block (do NOT persist it — an assistant-doc cursor would
      // skip older-timestamped pending messages) and keep scanning until a partial window proves
      // the tail is reached.
      if (batch.docs.length === DRAIN_BATCH) {
        lastSnap = batch.docs[batch.docs.length - 1];
        continue;
      }
      // atomic idle: re-read the after-cursor query INSIDE the transaction; commit idle only if
      // it is still empty (and not saturated). A message committed into the range forces the
      // idle-commit to serialize/retry, so a message that arrives while its own trigger backs
      // off on "generating" is never orphaned.
      const wentIdle = await db.runTransaction(async (tx) => {
        const check = await tx.get(afterCursorQuery(lastSnap));
        if (check.docs.length === DRAIN_BATCH) return false; // saturated race → keep draining
        const stillPending = check.docs.filter(isPending);
        if (stillPending.length > 0) return false;
        tx.set(parentRef, {
          status: "idle",
          lockedAt: FieldValue.delete(),
        }, {merge: true});
        return true;
      });
      if (wentIdle) return;
      continue; // a message landed during the check → keep draining
    }

    const next = pending[0];
    const {assistant, parentUpdate} = await processUnit(ctx, next);

    lastSnap = next;
    // commit the assistant doc + earned parent state + cursor advance in ONE batch: either all
    // land or none, so a crash between the reply and the cursor can't duplicate the assistant
    // doc (a pre-commit crash re-processes the unit but wrote nothing — only a possible OpenAI
    // re-bill remains, the documented replay risk).
    const writeBatch = db.batch();
    writeBatch.set(messagesCol.doc(), assistant);
    writeBatch.set(parentRef, {
      ...parentUpdate,
      lastProcessedCreatedAt: next.get("createdAt"),
      lastProcessedMessageId: next.id,
    }, {merge: true});
    await writeBatch.commit();
  }

  // Pathological drain length. Throw so the catch sets status:"error" (self-heals — acquire
  // proceeds on anything != "generating"); the persisted cursor means the next trigger
  // continues in order.
  throw new Error("chat drain exceeded MAX_DRAIN_TURNS");
}

// acquire the per-conversation lock: compare-and-set idle→generating in a transaction,
// reclaiming a stale lock (owner crashed mid-drain). Returns true if this invocation won the
// lock. Exported so the single-in-flight + stale-reclaim behavior is testable against the
// emulator.
export async function acquireLock(
  parentRef: ParentRef, ownerFields: Record<string, unknown>
): Promise<boolean> {
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const p = await tx.get(parentRef);
    const status = p.data()?.status ?? "idle";
    const lockedAtMs = p.data()?.lockedAt?.toMillis?.() ?? 0;
    const stale = Date.now() - lockedAtMs > STALE_LOCK_MS;
    if (status === "generating" && !stale) return false; // genuinely busy → back off
    // status/lockedAt are FUNCTION-OWNED (admin write, bypasses rules). If the parent doesn't
    // exist yet, also stamp owner fields so the client can READ it (status indicator / reload).
    const ownerInit = p.exists ? {} : ownerFields;
    tx.set(parentRef, {
      status: "generating",
      lockedAt: FieldValue.serverTimestamp(),
      ...ownerInit,
    }, {merge: true});
    return true;
  });
}
