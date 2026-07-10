// AI chat tutor trigger.
//
// A 1st-gen Firestore onWrite trigger (via firebase-functions/v1 — the 2nd-gen at-least-once /
// Eventarc semantics would reintroduce the infinite re-drain the default no-retry policy
// prevents) on the per-conversation messages subcollection:
//
//   /{root}/{rootId}/chatTutor/{conversationId}/messages/{messageId}
//
//   The root is a two-segment wildcard ({root}/{rootId}) rather than a literal authed/{portal}:
//   the client roots every write under getRootFolder() = /{appMode}/{rootId}/, so an authed build
//   writes under authed/{portal} but a demo build writes under demo/{demoName}. Pinning the
//   trigger to authed/{portal} meant it never fired for demo/dev/qa/test — the message sat
//   unanswered and the client's typing indicator spun forever. The wildcard root matches every
//   appMode; the actual root segments come back in context.params.
//
//   - self-trigger guard: act only on kind:"user" (student message); ignore our own
//     kind:"assistant" writes and deletes.
//   - per-conversation single-in-flight lock (acquireLock) + drain (processAndDrain), both in
//     ./chat/drain.ts (firebase-admin only, so that logic is emulator-testable without
//     firebase-functions).
//
// This file is deliberately thin: it owns only the trigger registration + params/secret + path
// parsing, and delegates every Firestore/OpenAI step to ./chat/drain.
import * as functionsV1 from "firebase-functions/v1";
import {defineSecret, defineString} from "firebase-functions/params";
import {getFirestore} from "firebase-admin/firestore";

import {CHAT_GENERIC_PROMPT} from "../../shared/chat-tutor-generic-prompt";
import {createOpenAIClient} from "./chat/openai";
import {DrainContext, acquireLock, processAndDrain, pickOwnerFields} from "./chat/drain";

// Only the API key is a true secret (defineSecret). OPENAI_MODEL stays a defineString param
// (server-side config, provisioned per environment). The generic tutor prompt is a source
// constant (shared/chat-tutor-generic-prompt), not a param.
const openaiKey = defineSecret("OPENAI_TUTOR_API_KEY");
const openaiModel = defineString("OPENAI_MODEL");

const MESSAGES = "{root}/{rootId}/chatTutor/{conversationId}/messages/{messageId}";

// The region must co-locate with the project's Firestore database (where the existing
// functions-v2 triggers run), or a 1st-gen Firestore trigger won't deploy/fire.
export const chatTutorOnWrite = functionsV1
  .region("us-central1")
  .runWith({secrets: [openaiKey]})
  .firestore.document(MESSAGES)
  .onWrite(async (change, context) => {
    const doc = change.after.data();
    if (!doc) return null; // delete → ignore
    // self-trigger guard: only user messages start/continue a turn; ignore our own assistant
    // writes (and any other kind).
    if (doc.kind !== "user") return null;

    const db = getFirestore();
    const {root, rootId, conversationId} = context.params as Record<string, string>;
    const parentRef = db.doc(`${root}/${rootId}/chatTutor/${conversationId}`);
    const messagesCol = parentRef.collection("messages");
    const ownerFields = pickOwnerFields(doc);

    // acquire the per-conversation lock (compare-and-set idle→generating) with stale reclaim.
    const acquired = await acquireLock(parentRef, ownerFields);
    if (!acquired) return null;

    const ctx: DrainContext = {
      parentRef,
      messagesCol,
      openai: createOpenAIClient(openaiKey.value()),
      model: openaiModel.value(),
      genericText: CHAT_GENERIC_PROMPT,
    };

    try {
      await processAndDrain(ctx);
    } catch (e) {
      // Record the error (status:"error" self-heals — acquire proceeds on anything !=
      // "generating") and re-throw only to surface it in the function logs. This trigger must
      // run with the DEFAULT no-retry policy: with retries enabled, a deterministic failure
      // would re-acquire and re-drain forever, burning OpenAI spend. Do not enable
      // failurePolicy/retries.
      const message = e instanceof Error ? e.message : String(e);
      await parentRef.set({status: "error", error: message}, {merge: true});
      throw e;
    }
    return null;
  });
