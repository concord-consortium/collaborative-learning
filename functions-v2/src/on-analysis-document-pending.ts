import {FirestoreEvent, onDocumentCreated, QueryDocumentSnapshot} from "firebase-functions/v2/firestore";
import {getAnalysisQueueFirestorePath, isKnownEvaluator} from "./utils";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";
// Modular import: admin.firestore.FieldValue is undefined in the functions emulator.
import {FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {type AnalysisQueueDocument} from "./on-analyzable-doc-written";
import {
  type AnalysisImagedQueueDocument, type ImagedQueueDocument, type MockImagedQueueDocument,
} from "./analysis-queue-types";
import {documentSummarizer} from "../../shared/ai-summarizer/ai-summarizer";
import {generateRenderHtml} from "../../shared/render-page";
import {classifyDocument} from "../../shared/ai-analysis-classify";

// This is one of three functions for AI analysis of documents:
// 1. Watch for changes to the lastUpdatedAt metadata field and write into the queue of docs to process
// 2. (This function) Summarize and screenshot those documents
// 3. Send what was produced to the AI service for processing, and create document comments with the results

// The released CLUE build. The release workflow copies only a few entry points to the top level
// (see .github/workflows/release.yml), and `iframe.html` is not one of them, so the document
// iframe is reached through the `authoring-iframe` entry point, which is built from the same
// source (src/iframe/iframe.tsx). Rendering against the release means screenshots keep up with
// tiles added or changed in later releases. The cost is that every CLUE release can change the
// screenshots: the page below starts the iframe at 500px and only grows it on a positive
// updateHeight, so a release that breaks height reporting in unwrapped mode (src/iframe) yields
// truncated screenshots, and nothing here can tell.
export const clueIframeURL = "https://collaborative-learning.concord.org/authoring-iframe/index.html";
// The unit to render with when the document's own unit is unknown or unusable.
export const fallbackClueUnit = "mods";
const shutterbugURL = "https://api.concord.org/shutterbug-production";

// The runtime switch for screenshots. A missing document or a missing field means enabled: the
// switch only ever turns screenshots off. It lives in Firestore, not in a Firebase parameter,
// because parameters are read at deploy time — this one has to be flippable from the console
// while Shutterbug is struggling. Firestore rules deny clients everything under `analysis`.
export const analysisSettingsPath = "analysis/settings";

// How long to wait for Shutterbug. It loads the CLUE build, renders the document and rasterizes
// it, so a slow answer is ordinary; a missing one is not.
//
// This has to fire before the platform's own timeout below, with room left to write the failure
// down. If the platform gets there first the invocation is killed outright: nothing is recorded,
// the pending entry survives, and because this trigger has no retry the document is never analyzed
// again — later edits only update that entry, so they do not re-trigger either.
const shutterbugTimeoutMs = 45_000;

// Comfortably above shutterbugTimeoutMs, and above the 60s default, which the request alone could
// have used up before the summarizer and two database reads are counted.
const functionTimeoutSeconds = 120;

// How much of a message from outside is kept. A service that has gone wrong can answer with a
// megabyte of HTML, and all of it would otherwise land in the queue record.
const maxErrorTextLength = 500;

// The largest summary worth keeping. The queue record carries it to the next function and on into
// `done`, beside the model's full response, and Firestore refuses a document over 1 MiB — so an
// unbounded summary can fail the write that hands the document on. It would be unusable anyway:
// anything near that size is past what gpt-4o-mini accepts. The largest summary any real document
// in the evaluation corpora produces is about 36,000 bytes, so this leaves room to spare.
const maxSummaryBytes = 200_000;

function bounded(text: string) {
  return text.length > maxErrorTextLength ? `${text.slice(0, maxErrorTextLength)}…` : text;
}

async function imagesAreEnabled(firestore: admin.firestore.Firestore) {
  const settings = await firestore.doc(analysisSettingsPath).get();
  return settings.data()?.imagesEnabled !== false;
}

/**
 * Posts the page to Shutterbug and returns the URL of the picture it made.
 *
 * Every step has a defined failure: a 200 is not evidence of a usable body, a body is not
 * evidence of JSON, and JSON is not evidence of a URL. Each one throws with a message naming
 * what went wrong, which the caller records on the queue record.
 *
 * @param {string} html the render page to screenshot
 * @return {Promise<string>} the https URL of the picture
 */
async function postToShutterbug(html: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(shutterbugURL, {
      method: "POST",
      body: JSON.stringify({content: html, height: 1500}),
      signal: AbortSignal.timeout(shutterbugTimeoutMs),
    });
  } catch (err) {
    if ((err as {name?: string})?.name === "TimeoutError") {
      throw new Error(`Shutterbug did not answer within ${shutterbugTimeoutMs}ms`);
    }
    throw err;
  }
  if (!response.ok) {
    throw new Error(`Shutterbug answered ${response.status} ${response.statusText}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    throw new Error(`Shutterbug's response was not JSON: ${bounded(String(err))}`);
  }
  const url = (body as {url?: unknown})?.url;
  if (typeof url !== "string" || url === "") {
    throw new Error(`Shutterbug returned no image URL: ${bounded(JSON.stringify(body) ?? String(body))}`);
  }
  let protocol;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error(`Shutterbug returned an unusable image URL: ${bounded(url)}`);
  }
  // Student work went up; the picture of it comes back over TLS or not at all.
  if (protocol !== "https:") {
    throw new Error(`Shutterbug returned a non-https image URL: ${bounded(url)}`);
  }
  return url;
}

// Tile types are registered from the loaded unit's configuration, not globally, so the render
// has to use the document's own unit: any tile type the unit does not list is drawn as an
// "unknown tile" placeholder, silently, and the screenshot is a valid image of the wrong thing.
// Only a plain unit code is accepted. The metadata's unit is sometimes null, and a unit loaded
// from a custom URL has a code that does not exist on the curriculum site; either would make
// CLUE load its default unit or show an error page, which Shutterbug would capture just the same.
export function renderUnitFor(unit: unknown) {
  return typeof unit === "string" && /^[A-Za-z0-9_+-]+$/.test(unit) ? unit : fallbackClueUnit;
}

// The page Shutterbug is given: the document in a script element plus an iframe that loads CLUE
// and is handed it. The page itself is built in shared/render-page.ts, which the harness's render
// modes and scripts/shutterbug.ts also use, so all three render the same page and only the CLUE
// build and unit differ.
export function generateHtml(clueDocument: unknown, unit = fallbackClueUnit) {
  return generateRenderHtml({content: clueDocument, clueUrl: clueIframeURL, unit});
}

const pendingQueuePath = getAnalysisQueueFirestorePath("pending", "{docId}");

/**
 * Files the document under `failedImaging` and takes it off the pending queue.
 *
 * `accumulated` carries whatever had been worked out before the failure — the classification, the
 * render target, a summary that was produced but had nothing to go with it. A failed record is
 * then as informative as a successful one, which is the difference between diagnosing a failure
 * from the record and having to reproduce it.
 *
 * Never throws. It is the last thing standing between a failed document and a stranded queue
 * entry, so a failure inside it is logged rather than raised: raising would escape the handler,
 * leave `pending` untouched, and — with no retry configured — mean the document is never analyzed
 * again, because later edits only update that entry and do not re-trigger this function.
 *
 * @param {string} error what went wrong
 * @param {FirestoreEvent} event the pending-queue event being handled
 * @param {Partial<AnalysisImagedQueueDocument>} accumulated what had been worked out so far
 */
async function error(
  error: string,
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, Record<string, string>>,
  accumulated: Partial<AnalysisImagedQueueDocument> = {}
) {
  logger.warn("Error processing document", event.document, error);
  const firestore = admin.firestore();
  const failedImaging = firestore.collection(getAnalysisQueueFirestorePath("failedImaging"));
  const documentId = event.params.docId;
  try {
    await failedImaging.add({...event.data?.data(), ...accumulated, documentId, error});
  } catch (err) {
    // The record explaining a failure must not fail for the same reason the work did. An oversized
    // summary is the case in mind: it would be spread into this write too, so the retry carries
    // nothing over.
    logger.warn("Could not record the accumulated fields, retrying without them", err);
    try {
      await failedImaging.add({
        documentId,
        error: `${error} (accumulated fields omitted: ${bounded(String(err))})`,
      });
    } catch (retryErr) {
      logger.error("Could not write a failure record at all", retryErr);
    }
  }
  try {
    await firestore.doc(event.document).delete();
  } catch (err) {
    logger.error("Could not remove the pending queue entry, which will not be retried", err);
  }
}

/**
 * Writes to the "imaged" queue and removes the document from "pending".
 *
 * @param {admin.firestore.Firestore} firestore the Firestore instance
 * @param {string} docId the queue document's id
 * @param {ImagedQueueDocument} queueDoc the record to hand to the next function
 * @param {FirestoreEvent} event the pending-queue event being handled
 */
async function writeImaged(
  firestore: admin.firestore.Firestore,
  docId: string,
  queueDoc: ImagedQueueDocument,
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, Record<string, string>>
) {
  await firestore.doc(getAnalysisQueueFirestorePath("imaged", docId)).set(queueDoc);
  await firestore.doc(event.document).delete();
}

export const onAnalysisDocumentPending =
  onDocumentCreated({document: pendingQueuePath, timeoutSeconds: functionTimeoutSeconds}, async (event) => {
    const {docId} = event.params;
    const firestore = admin.firestore();
    const queueDoc = event.data?.data() as AnalysisQueueDocument | undefined;

    if (!isKnownEvaluator(queueDoc?.evaluator)) {
      await error(`Unexpected value for evaluator: ${queueDoc?.evaluator}`, event);
      return;
    }

    // Everything the document teaches us as we go, so a failure at any point below still files a
    // record that says what had been worked out. Also what the outer boundary hands to error().
    const accumulated: Partial<AnalysisImagedQueueDocument> = {};

    // Firestore triggers here have no retry configured, so an exception escaping this handler
    // would leave the pending entry stranded with nothing recorded anywhere. Nothing below throws.
    try {
      // 5d: the mock evaluator is a test fixture. It carries no representations, and the next
      // function ignores them for it, so there is nothing to produce and nothing to send.
      if (queueDoc?.evaluator === "mock") {
        const mockQueueDoc: MockImagedQueueDocument = {
          ...(queueDoc as AnalysisQueueDocument),
          evaluator: "mock",
          analysisVersion: 2,
          sendSummary: false,
          sendImage: false,
        };
        await writeImaged(firestore, docId, mockQueueDoc, event);
        return;
      }

      // Retrieve the document content
      const documentPath = (queueDoc?.documentPath as string);
      let content = undefined;
      try {
        await (getDatabase().ref(documentPath).once("value", (snapshot) => {
          content = snapshot.child("content").val() as string;
        }));
      } catch (err) {
        await error(`Could not retrieve document ${documentPath}: ${err}`, event, accumulated);
        return;
      }

      if (!content) {
        await error(`Could not retrieve document content ${documentPath}`, event, accumulated);
        return;
      }

      // The document's unit, from its Firestore metadata. It picks the unit the screenshot is
      // rendered with.
      // A failure here has to go through error() like the other failures: it removes the pending
      // queue entry, and without that the entry stays put and later edits of the document, which
      // only update it, never trigger this function again.
      let documentUnit: unknown;
      if (queueDoc?.firestoreDocumentPath) {
        try {
          const firestoreDoc = await firestore.doc(queueDoc.firestoreDocumentPath).get();
          documentUnit = firestoreDoc.data()?.unit;
        } catch (err) {
          await error(`Could not retrieve Firestore document ${queueDoc.firestoreDocumentPath}: ${err}`,
            event, accumulated);
          return;
        }
      }

      // The build and unit any screenshot of this document is rendered with. Recorded on the queue
      // record whether or not a screenshot is taken, so a record always says what a picture of this
      // document would have been a picture of.
      const unit = renderUnitFor(documentUnit);
      if (unit !== documentUnit) {
        logger.warn(`Document unit ${JSON.stringify(documentUnit)} is not usable for rendering, using "${unit}"`);
      }
      accumulated.renderTarget = {clueUrl: clueIframeURL, unit};
      accumulated.analysisVersion = 2;

      // 1. Parse and classify. The parse has its own catch so a malformed document is named as
      //    such rather than reaching the boundary below as an unattributed failure.
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        await error(`invalid document JSON: ${err}`, event, accumulated);
        return;
      }
      const classified = classifyDocument(parsed);
      const hasStudentText = classified.tiles.some((tile) => tile.hasStudentText);
      const summaryCarriesStudentWork = classified.summaryCarriesStudentWork;
      const needsImage = classified.tiles.some((tile) => tile.requiresVisualRepresentation);
      const promptNeedsImage = classified.promptNeedsImage;
      accumulated.classification = {
        modality: classified.computedModality, hasStudentText, summaryCarriesStudentWork, needsImage,
        promptNeedsImage,
      };

      // 2. An empty document is still evaluated, as it was before this work.
      //
      //    Turning it away is the better answer on its own terms — the summarizer emits only a
      //    preamble and headings for a blank document, so the model is paid to comment on nothing.
      //    But the client has no way to say so. It queues an "Ada is thinking about it…"
      //    placeholder when the student clicks Ideas, and nothing clears that placeholder except
      //    an arriving comment, so a student who asks for ideas before doing any work waits for a
      //    comment that is never coming. Leaving them there is worse than one wasted evaluation.
      //
      //    The fix belongs in the client — a plain message saying the document is empty — and that
      //    is a design decision for the team. Until it is made, empty documents are evaluated.
      const isEmpty = classified.computedModality === "empty";

      // 3. Summary. Always produced, and stored whenever it was
      //    produced, sent or not: an investigator reading a `done` record can then see the summary
      //    the model was not given. It is sent when it carries student work in any form — typed
      //    text, or a detailed description of something the student made, such as a drawing tile's
      //    table of a drawing's objects.
      let docSummary;
      try {
        docSummary = documentSummarizer(content, {});
      } catch (err) {
        accumulated.summaryError = `summarizer error: ${err}`;
      }
      if (docSummary !== undefined && Buffer.byteLength(docSummary) > maxSummaryBytes) {
        // Treated as a summarizer failure rather than a document failure: the picture may still
        // carry the work, and one representation is better than none.
        accumulated.summaryError =
          `summary is ${Buffer.byteLength(docSummary)} bytes, over the ${maxSummaryBytes} byte limit`;
        docSummary = undefined;
      }
      if (docSummary !== undefined) {
        accumulated.docSummary = docSummary;
      }
      if (docSummary !== undefined && (summaryCarriesStudentWork || isEmpty)) {
        // An empty document's summary carries no student work, and is sent anyway so that a
        // comment comes back and the student's placeholder clears. See step 2.
        accumulated.sendSummary = true;
      } else if (docSummary !== undefined) {
        accumulated.sendSummary = false;
        accumulated.summaryOmittedReason = "no-student-work-in-summary";
      } else {
        accumulated.sendSummary = false;
      }

      // 4. Screenshot. A failure here is recorded and the document carries on with whatever else
      //    it has; only step 5 decides whether that is enough.
      // A picture is worth taking when the student's own work needs one, and also when the
      // question does: an image used as a question prompt contributes nothing a summary can carry,
      // so an answer sent without it would be judged without the question it answers. The second
      // case needs student work to be context *for* — a picture of a prompt is never a substitute
      // for an answer, so a document holding only an authored prompt gets no screenshot.
      const wantsImage = needsImage || (summaryCarriesStudentWork && promptNeedsImage);
      if (!wantsImage) {
        // Asked first, so a document that has no use for a screenshot never reads the switch.
        accumulated.sendImage = false;
        accumulated.imageOmittedReason = "no-visual-content";
      } else {
        // A settings read that fails must not cost the document its summary, so it is guarded
        // separately and defaults to enabled — the switch only ever turns screenshots off, and an
        // unreadable setting is closest to an absent one.
        let enabled = true;
        try {
          enabled = await imagesAreEnabled(firestore);
        } catch (err) {
          logger.warn(`Could not read ${analysisSettingsPath}, leaving screenshots on: ${err}`);
        }
        if (!enabled) {
          accumulated.sendImage = false;
          accumulated.imageOmittedReason = "images-disabled";
        } else {
          try {
            accumulated.docImageUrl = await postToShutterbug(generateHtml(parsed, unit));
            accumulated.docImaged = FieldValue.serverTimestamp();
            accumulated.sendImage = true;
          } catch (err) {
            accumulated.sendImage = false;
            accumulated.imageError = `Shutterbug error: ${bounded(String(err))}`;
          }
        }
      }

      // 5. Nothing to send is the only failure this function has left.
      if (!accumulated.sendSummary && !accumulated.sendImage) {
        const summaryReason = accumulated.summaryOmittedReason ?? accumulated.summaryError;
        const imageReason = accumulated.imageOmittedReason ?? accumulated.imageError;
        await error(`nothing to send — summary: ${summaryReason}; image: ${imageReason}`, event, accumulated);
        return;
      }

      // 6. The compatibility hint for the previous version of the next function.
      const nextQueueDoc: AnalysisImagedQueueDocument = {
        ...(queueDoc as AnalysisQueueDocument),
        ...accumulated,
        evaluator: queueDoc?.evaluator as "categorize-design" | "custom",
        analysisVersion: 2,
        summarizer: accumulated.sendImage ? "image" : "text",
        classification: accumulated.classification,
        renderTarget: accumulated.renderTarget,
        sendSummary: accumulated.sendSummary ?? false,
        sendImage: accumulated.sendImage ?? false,
      };

      // 7. Hand it to the next function.
      await writeImaged(firestore, docId, nextQueueDoc, event);
    } catch (err) {
      await error(`unhandled: ${err}`, event, accumulated);
    }
  });
