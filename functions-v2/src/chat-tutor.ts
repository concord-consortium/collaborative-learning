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
// This file is deliberately thin: it owns the trigger registration, the params/secret, the path
// parsing, and the choice of which backend answers. The Firestore machinery lives in ./chat/drain
// and the OpenAI calls in ./chat/openai-provider.
import * as functionsV1 from "firebase-functions/v1";
import {defineSecret, defineString} from "firebase-functions/params";
import {getFirestore} from "firebase-admin/firestore";

import {CHAT_GENERIC_PROMPT} from "../../shared/chat-tutor-generic-prompt";
import {ProtectionClass, kProtectionClasses} from "../../shared/fl-packet/envelope";
import {createOpenAIClient} from "./chat/openai";
import {createOpenAIProvider} from "./chat/openai-provider";
import {createFlProvider} from "./chat/fl-provider";
import {createRoutingProvider} from "./chat/routing-provider";
import {DrainContext, acquireLock, processAndDrain, pickOwnerFields} from "./chat/drain";

// Only the API keys are true secrets (defineSecret). Everything else is server-side config
// provisioned per environment (defineString). The generic tutor prompt is a source constant
// (shared/chat-tutor-generic-prompt), not a param.
const openaiKey = defineSecret("OPENAI_TUTOR_API_KEY");
const openaiModel = defineString("OPENAI_MODEL");

// ForeverLearning. The answer-protection refs are params rather than source because the CLUE
// curriculum repo is public and what a unit protects must not be readable there; the refs
// themselves are opaque, and the values behind them are resolved on FL's side and never travel.
const flKey = defineSecret("FL_CONCORDCLUE_API_KEY");
const flBaseUrl = defineString("FL_BASE_URL");
const flSolutionId = defineString("FL_SOLUTION_ID");
const flCatalogCommit = defineString("FL_CATALOG_COMMIT");
const flProtectionClasses = defineString("FL_PROTECTION_CLASSES");
const flProtectionPatternRefs = defineString("FL_PROTECTION_PATTERN_REFS");

const kDefaultProvider = "openai";

// Comma-separated because a Cloud Functions param is a string. Empty entries are dropped rather
// than passed along as "", which buildEnvelope would take for a real ref.
function splitParam(value: string): string[] {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

// Unknown class names are dropped here rather than sent. buildEnvelope refuses a policy with no
// classes at all, so a wholly mistyped param fails the turn loudly instead of declaring a
// protection we do not have.
function protectionClasses(value: string): ProtectionClass[] {
  const known = new Set<string>(kProtectionClasses);
  return splitParam(value).filter((entry): entry is ProtectionClass => known.has(entry));
}

const MESSAGES = "{root}/{rootId}/chatTutor/{conversationId}/messages/{messageId}";

// The region must co-locate with the project's Firestore database (where the existing
// functions-v2 triggers run), or a 1st-gen Firestore trigger won't deploy/fire.
export const chatTutorOnWrite = functionsV1
  .region("us-central1")
  .runWith({secrets: [openaiKey, flKey]})
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

    // Factories, not instances: each backend needs its own credential, and only the one this
    // conversation belongs to gets built. The choice is made from the conversation's first
    // message and held on the parent thereafter — see chat/routing-provider.
    const ctx: DrainContext = {
      parentRef,
      messagesCol,
      provider: createRoutingProvider({
        defaultProvider: kDefaultProvider,
        providers: {
          openai: () => createOpenAIProvider({
            openai: createOpenAIClient(openaiKey.value()),
            model: openaiModel.value(),
            genericText: CHAT_GENERIC_PROMPT,
          }),
          fl: () => createFlProvider({
            config: {
              baseUrl: flBaseUrl.value(),
              apiKey: flKey.value(),
              solutionId: flSolutionId.value(),
            },
            catalogCommit: flCatalogCommit.value(),
            protection: {
              classes: protectionClasses(flProtectionClasses.value()),
              patternRefs: splitParam(flProtectionPatternRefs.value()),
            },
            // Not yet plumbed: the server cannot reach the student's document. rightContext is a
            // markdown summary rather than content, and the RTDB path needs a documentKey the
            // message does not carry. Until that is settled the packet carries its envelope and
            // says it has no workspace, rather than describing one it cannot see.
            readDocument: async () => undefined,
          }),
        },
      }),
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
