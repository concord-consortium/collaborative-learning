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
import {generateRenderHtml, kMaxFrameHeightPx} from "../../shared/render-page";
import {readPngDimensions} from "../../shared/png-header";
import {isPublicHttpsUrl} from "../../shared/urls";
import {kPlaceholderUnitCode} from "../../shared/shared";
import {classifyDocument, documentHasStudentWork} from "../../shared/ai-analysis-classify";
import {writeEvaluationStatusForRequests} from "./evaluation-status";
import {claimRequestIds} from "./claim-request-ids";

// This is one of three functions for AI analysis of documents:
// 1. Watch for changes to the lastUpdatedAt metadata field and write into the queue of docs to process
// 2. (This function) Summarize and screenshot those documents
// 3. Send what was produced to the AI service for processing, record the summary that was evaluated
//    in `summaries/`, and create document comments with the results

// The released CLUE build. The release workflow copies only a few entry points to the top level
// (see .github/workflows/release.yml), and `iframe.html` is not one of them, so the document
// iframe is reached through the `authoring-iframe` entry point, which is built from the same
// source (src/iframe/iframe.tsx). Rendering against the release means screenshots keep up with
// tiles added or changed in later releases. The cost is that every CLUE release can change the
// screenshots: the page below starts the iframe at 500px and only grows it on a positive
// updateHeight, so a release that breaks height reporting in unwrapped mode (src/iframe) yields
// truncated screenshots, and nothing here can tell. The frame is also capped at kMaxFrameHeightPx
// (shared/render-page.ts): a document past that cap is clipped there, not here.
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

// Only the viewport: Shutterbug applies `height` to Puppeteer's `setViewport`, not as a cap on a
// `fullPage` capture. shared/render-page.ts's frame cap is what actually bounds it.
const shutterbugViewportHeightPx = 500;

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

// The provider's per-image allowance for a URL. A picture over this is omitted rather than sent.
export const maxImageBytes = 20 * 1024 * 1024;

// Budget for the 24-byte range request that checks the returned picture. Kept well inside
// functionTimeoutSeconds alongside shutterbugTimeoutMs, the summarizer and two database reads.
const imageCheckTimeoutMs = 10_000;

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
      body: JSON.stringify({content: html, height: shutterbugViewportHeightPx, fullPage: true}),
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
  // This function fetches that URL itself (see inspectImage): a private or loopback host would
  // mean it fetching somewhere on its own network, not a picture.
  if (!isPublicHttpsUrl(url)) {
    throw new Error(`Shutterbug returned an image URL on a private or loopback host: ${bounded(url)}`);
  }
  return url;
}

/**
 * Reads at most `maxBytes` from a response body and cancels the rest.
 *
 * `response.arrayBuffer()` would read the whole body first, defeating the bound when a server
 * ignores `Range` and sends the whole image. A bodyless response (a test double) falls back to
 * it, since there is nothing to bound.
 *
 * Cancels via the reader, not the stream: `getReader()` locks the stream, so `body.cancel()` would
 * reject instead of cancelling, leaving the rest to download regardless.
 *
 * @param {Response} response the response to read from
 * @param {number} maxBytes how much of the body to keep
 * @return {Promise<Uint8Array>} up to `maxBytes` bytes from the start of the body
 */
export async function readAtMost(response: Response, maxBytes: number): Promise<Uint8Array> {
  const body = response.body;
  if (!body) return new Uint8Array(await response.arrayBuffer());
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const {done, value} = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const result = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.length, result.length - offset);
    result.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  return result;
}

/**
 * The number after "/" in a `Content-Range` header, or `null` when it is missing or malformed.
 *
 * @param {string | null} header the `Content-Range` header value
 * @return {number | null} the total byte count it declares, or `null`
 */
function totalBytesFromContentRange(header: string | null): number | null {
  const total = header?.match(/\/(\d+)$/)?.[1];
  return total ? Number(total) : null;
}

/**
 * A header's declared byte count, or `null` when it is missing or not a number.
 *
 * @param {string | null} header the header value, e.g. `Content-Length`
 * @return {number | null} the byte count it declares, or `null`
 */
function bytesFromHeader(header: string | null): number | null {
  if (header === null) return null;
  const value = Number(header);
  return Number.isFinite(value) ? value : null;
}

/** What checking a picture without downloading it can learn about it. */
interface ImageInspection {
  widthPx: number;
  heightPx: number;
  /** The file's total size, when the response said so; `null` when it did not. */
  encodedBytes: number | null;
}

/**
 * Checks the picture Shutterbug produced, without downloading it.
 *
 * A `Range: bytes=0-23` request returns the PNG header (for dimensions) and the file's total size
 * via `Content-Range`. S3 always honours `Range` and answers 206; the 200 branch covers a host
 * that does not.
 *
 * @param {string} url the hosted picture to check
 * @return {Promise<ImageInspection>} its dimensions, and its total size when known
 */
async function inspectImage(url: string): Promise<ImageInspection> {
  // Not "follow": a followed redirect has already delivered the request to wherever it pointed —
  // possibly somewhere less safe than the checked `url` — by the time anything could inspect
  // where it went. "manual" means a 3xx never becomes a second request; it lands below as an
  // unrecognized status and fails like any other bad response, url already checked or not.
  const response = await fetch(url, {
    headers: {Range: "bytes=0-23"},
    redirect: "manual",
    signal: AbortSignal.timeout(imageCheckTimeoutMs),
  });
  let encodedBytes: number | null;
  if (response.status === 206) {
    encodedBytes = totalBytesFromContentRange(response.headers.get("content-range"));
  } else if (response.status === 200) {
    encodedBytes = bytesFromHeader(response.headers.get("content-length"));
  } else {
    throw new Error(`Image check answered ${response.status} ${response.statusText}`);
  }
  const bytes = await readAtMost(response, 24);
  const {widthPx, heightPx} = readPngDimensions(bytes);
  return {widthPx, heightPx, encodedBytes};
}

/**
 * Whether a URL's body is larger than `maxBytes`, without reading more than `maxBytes + 1` of it.
 *
 * The fallback for when `inspectImage` could not learn the size cheaply. Essentially never runs
 * against S3, which always sends `Content-Range` or `Content-Length`.
 *
 * @param {string} url the hosted picture to check
 * @param {number} maxBytes the limit to check against
 * @return {Promise<boolean>} whether the body is larger than `maxBytes`
 */
async function bodyExceedsBytes(url: string, maxBytes: number): Promise<boolean> {
  // "manual", not "follow" — see inspectImage.
  const response = await fetch(url, {redirect: "manual", signal: AbortSignal.timeout(imageCheckTimeoutMs)});
  if (!response.ok) {
    throw new Error(`Image check answered ${response.status} ${response.statusText}`);
  }
  const bytes = await readAtMost(response, maxBytes + 1);
  return bytes.length > maxBytes;
}

// Tile types are registered from the loaded unit's configuration, not globally, so the render
// has to use the document's own unit: any tile type the unit does not list is drawn as an
// "unknown tile" placeholder, silently, and the screenshot is a valid image of the wrong thing.
// Only a plain unit code is accepted. The metadata's unit is sometimes null, and a unit loaded
// from a custom URL has a code that does not exist on the curriculum site; either would make
// CLUE load its default unit or show an error page, which Shutterbug would capture just the same.
// A document created before its unit loaded carries the placeholder code, which only has the shape
// of a unit code and fetches nothing, so that one is refused by name.
export function isRenderableUnit(unit: unknown): unit is string {
  return typeof unit === "string" && /^[A-Za-z0-9_+-]+$/.test(unit) && unit !== kPlaceholderUnitCode;
}

export function renderUnitFor(unit: unknown) {
  return isRenderableUnit(unit) ? unit : fallbackClueUnit;
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
  const queueDoc = event.data?.data() as AnalysisQueueDocument | undefined;
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
  let requestIds = queueDoc?.requestIds;
  try {
    requestIds = await claimRequestIds(firestore.doc(event.document)) ?? requestIds;
  } catch (err) {
    logger.error("Could not remove the pending queue entry, which will not be retried", err);
  }
  if (queueDoc?.metadataPath && queueDoc?.evaluator) {
    await writeEvaluationStatusForRequests(queueDoc.metadataPath, queueDoc.evaluator, requestIds, {
      outcome: "failed",
      docUpdated: queueDoc.docUpdated,
    });
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
// Combines two possibly-absent requestIds arrays, deduped — order doesn't matter, since
// writeEvaluationStatusForRequests just writes the same outcome under each one.
function unionRequestIds(a: unknown, b: string[] | undefined): string[] {
  const ids = new Set<string>();
  if (Array.isArray(a)) {
    a.forEach((id) => {
      if (typeof id === "string") ids.add(id);
    });
  }
  b?.forEach((id) => ids.add(id));
  return Array.from(ids);
}

async function writeImaged(
  firestore: admin.firestore.Firestore,
  docId: string,
  queueDoc: ImagedQueueDocument,
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, Record<string, string>>
) {
  const pendingDocRef = firestore.doc(event.document);
  const imagedDocRef = firestore.doc(getAnalysisQueueFirestorePath("imaged", docId));
  // One transaction: the next function's own trigger fires the instant this document is created
  // and never looks again, so the requestIds it carries have to be complete from that first write —
  // a later `.update()` would arrive too late for a trigger that already fired.
  await firestore.runTransaction(async (transaction) => {
    const currentRequestIds = (await transaction.get(pendingDocRef)).data()?.requestIds;
    const pendingRequestIds = Array.isArray(currentRequestIds) ? currentRequestIds : queueDoc.requestIds;

    const existingImaged = await transaction.get(imagedDocRef);
    if (existingImaged.exists) {
      // A document already sitting here means an evaluation for this document is already in
      // progress, using that document's own content — only the ids need to reach it, not this
      // run's own (redundant, and by now possibly stale) work.
      const requestIds = unionRequestIds(existingImaged.data()?.requestIds, pendingRequestIds);
      if (requestIds.length > 0) {
        transaction.update(imagedDocRef, {requestIds});
      }
    } else {
      transaction.set(
        imagedDocRef,
        pendingRequestIds && pendingRequestIds.length > 0 ? {...queueDoc, requestIds: pendingRequestIds} : queueDoc
      );
    }
    transaction.delete(pendingDocRef);
  });
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
      //
      // Deliberately wider than the fill rule in readDocumentMetadata, which serves personal
      // documents only: any document with no usable unit is better drawn with the unit the student
      // was running than with the fallback.
      const requestUnit = queueDoc?.requestContext?.unit;
      const unit = renderUnitFor(isRenderableUnit(documentUnit) ? documentUnit : requestUnit);
      // Two levels: using the request's unit is the ordinary path for every personal document,
      // while reaching the fallback means the picture may show placeholders instead of the work.
      if (!isRenderableUnit(documentUnit)) {
        if (isRenderableUnit(requestUnit)) {
          logger.info(`Document has no usable unit (${JSON.stringify(documentUnit)}); ` +
            `rendering with the unit the student was running: "${unit}"`);
        } else {
          logger.warn(`Document unit ${JSON.stringify(documentUnit)} and request unit ` +
            `${JSON.stringify(requestUnit)} are both unusable for rendering, using "${unit}"`);
        }
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
      // modality/needsImage are type-level facts and can disagree with the instance-level skip
      // decision at step 2 below — see AnalysisClassification.modality for why that's expected.
      accumulated.classification = {
        modality: classified.computedModality, hasStudentText, summaryCarriesStudentWork, needsImage,
        promptNeedsImage,
      };

      // 2. Skip empty documents. The client shows its own nudge instead of requesting an
      //    evaluation, but can't intercept every route (document close, disconnect); this covers
      //    those using the same documentHasStudentWork check.
      if (!documentHasStudentWork(parsed)) {
        const doc = queueDoc as AnalysisQueueDocument;
        await firestore.collection(getAnalysisQueueFirestorePath("done")).add({
          ...doc,
          documentId: docId,
          completedAt: FieldValue.serverTimestamp(),
          analysisVersion: 2,
          classification: accumulated.classification,
          renderTarget: accumulated.renderTarget,
          sendSummary: false,
          sendImage: false,
          summaryOmittedReason: "empty-document",
          imageOmittedReason: "empty-document",
        });
        let claimedRequestIds = doc.requestIds;
        try {
          claimedRequestIds = await claimRequestIds(firestore.doc(event.document)) ?? claimedRequestIds;
        } catch (err) {
          logger.error("Could not remove the pending queue entry, which will not be retried", err);
        }

        // A late id must not be answered by this skip — the document may have gained work since.
        // Only the snapshot's own ids get "skipped-empty"; a late one goes back onto a fresh
        // pending document, to be judged by its own run.
        const ownRequestIds = new Set(doc.requestIds ?? []);
        const lateRequestIds = (claimedRequestIds ?? []).filter((id) => !ownRequestIds.has(id));

        await writeEvaluationStatusForRequests(doc.metadataPath, doc.evaluator, doc.requestIds, {
          outcome: "skipped-empty",
          docUpdated: doc.docUpdated,
        });

        if (lateRequestIds.length > 0) {
          const pendingDocRef = firestore.doc(event.document);
          const newPendingDoc: AnalysisQueueDocument = {
            metadataPath: doc.metadataPath,
            documentPath: doc.documentPath,
            commentsPath: doc.commentsPath,
            docUpdated: doc.docUpdated,
            evaluator: doc.evaluator,
            firestoreDocumentPath: doc.firestoreDocumentPath,
          };
          if (doc.aiPrompt) newPendingDoc.aiPrompt = doc.aiPrompt;
          if (doc.requestContext) newPendingDoc.requestContext = doc.requestContext;

          // A transaction, as on-analyzable-doc-written.ts uses: a plain `set()` could overwrite a
          // document created in the meantime instead of joining ids to it. Keeping that document's
          // own fields (docUpdated, requestContext) rather than this skipped run's older ones,
          // when it exists, since nothing here makes this run's copy the fresher one.
          await firestore.runTransaction(async (transaction) => {
            const existing = (await transaction.get(pendingDocRef)).data() as AnalysisQueueDocument | undefined;
            const priorRequestIds = Array.isArray(existing?.requestIds) ? existing.requestIds : [];
            const requestIds = [...priorRequestIds, ...lateRequestIds];
            transaction.set(pendingDocRef, {...(existing ?? newPendingDoc), requestIds});
          });
        }

        logger.info(`Document ${documentPath} is empty; skipped evaluation`);
        return;
      }

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
      if (docSummary !== undefined && summaryCarriesStudentWork) {
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
          } catch (err) {
            accumulated.sendImage = false;
            accumulated.imageError = `Shutterbug error: ${bounded(String(err))}`;
          }

          // Not sent unverified. A separate try: a failure here is an image-check error, not a
          // Shutterbug one.
          if (accumulated.docImageUrl !== undefined) {
            try {
              const inspected = await inspectImage(accumulated.docImageUrl);
              let encodedBytes = inspected.encodedBytes;
              let overLimit = encodedBytes !== null && encodedBytes > maxImageBytes;
              if (encodedBytes === null) {
                overLimit = await bodyExceedsBytes(accumulated.docImageUrl, maxImageBytes);
                if (overLimit) encodedBytes = maxImageBytes + 1;
              }
              if (overLimit) {
                accumulated.sendImage = false;
                accumulated.imageOmittedReason = "image-too-large";
                logger.warn(`Screenshot of ${documentPath} is ${encodedBytes} bytes, over the ` +
                  `${maxImageBytes} limit; sending the summary alone`);
              } else {
                accumulated.sendImage = true;
                // >=, not >: a clipped capture can land a few pixels past the ceiling (the outer
                // page's own margin, outside the clamped iframe), which is still a clip, not a bug.
                if (inspected.heightPx >= kMaxFrameHeightPx) {
                  accumulated.imageClipped = {capturedHeightPx: inspected.heightPx, ceilingPx: kMaxFrameHeightPx};
                  logger.warn(`Screenshot of ${documentPath} was clipped at ${kMaxFrameHeightPx}px ` +
                    `(captured ${inspected.heightPx}px)`);
                }
              }
            } catch (err) {
              accumulated.sendImage = false;
              accumulated.imageError = `Image check error: ${bounded(String(err))}`;
            }
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
