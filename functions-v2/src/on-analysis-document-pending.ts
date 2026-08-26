import {FirestoreEvent, onDocumentCreated, QueryDocumentSnapshot} from "firebase-functions/v2/firestore";
import {getAnalysisQueueFirestorePath, isKnownEvaluator} from "./utils";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {type AnalysisQueueDocument} from "./on-analyzable-doc-written";
import {documentSummarizer} from "../../shared/ai-summarizer/ai-summarizer";
import {escapeHtmlAttribute, escapeJsonForScript} from "../../shared/escape-for-html";

// This is one of three functions for AI analysis of documents:
// 1. Watch for changes to the lastUpdatedAt metadata field and write into the queue of docs to process
// 2. (This function) Create screenshots of those documents
// 3. Send those screenshots to the AI service for processing, and create document comments with the results

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

// Tile types are registered from the loaded unit's configuration, not globally, so the render
// has to use the document's own unit: any tile type the unit does not list is drawn as an
// "unknown tile" placeholder, silently, and the screenshot is a valid image of the wrong thing.
// Only a plain unit code is accepted. The metadata's unit is sometimes null, and a unit loaded
// from a custom URL has a code that does not exist on the curriculum site; either would make
// CLUE load its default unit or show an error page, which Shutterbug would capture just the same.
export function renderUnitFor(unit: unknown) {
  return typeof unit === "string" && /^[A-Za-z0-9_+-]+$/.test(unit) ? unit : fallbackClueUnit;
}

// scripts/shutterbug.ts has a near-copy of this page for rendering a document by hand during
// development. Keep fixes to one in step with the other until they are unified.
export function generateHtml(clueDocument: unknown, unit = fallbackClueUnit) {
  const source = escapeHtmlAttribute(
    `${clueIframeURL}?unit=${encodeURIComponent(unit)}&unwrapped&readOnly`);
  return `
    <script>const initialValue=${escapeJsonForScript(JSON.stringify(clueDocument))}</script>
    <!-- height will be updated when iframe sends updateHeight message -->
    <iframe id='clue-frame' width='100%' height='500px' style='border:0px'
      allow='serial'
      src="${source}"
    ></iframe>
    <script>
      const clueFrame = document.getElementById('clue-frame')
      function sendInitialValueToEditor() {
        if (!clueFrame.contentWindow) {
          console.warn("iframe doesn't have contentWindow");
          return;
        }
        window.addEventListener("message", (event) => {
          if (event.data?.type === "updateHeight") {
            // A height of 0, or anything that is not a positive number, would collapse the
            // iframe and hide the document the screenshot is meant to show. Ignoring it
            // leaves the iframe at its starting height.
            const height = event.data.height;
            if (!Number.isFinite(height) || height <= 0) return;
            document.getElementById("clue-frame").height = height + "px";
          }
        })
        clueFrame.contentWindow.postMessage(
          { initialValue: JSON.stringify(initialValue) },
          "*"
        );
      }
      clueFrame.addEventListener('load', sendInitialValueToEditor);
    </script>
  `;
}

const pendingQueuePath = getAnalysisQueueFirestorePath("pending", "{docId}");

async function error(error: string, event: FirestoreEvent<QueryDocumentSnapshot | undefined, Record<string, string>>) {
  logger.warn("Error processing document", event.document, error);
  const firestore = admin.firestore();
  await firestore.collection(getAnalysisQueueFirestorePath("failedImaging")).add({
    ...event.data?.data(),
    documentId: event.params.docId,
    error,
  });
  await firestore.doc(event.document).delete();
}

export const onAnalysisDocumentPending =
  onDocumentCreated(pendingQueuePath, async (event) => {
    const {docId} = event.params;
    const firestore = admin.firestore();
    const queueDoc = event.data?.data() as AnalysisQueueDocument | undefined;

    if (!isKnownEvaluator(queueDoc?.evaluator)) {
      await error(`Unexpected value for evaluator: ${queueDoc?.evaluator}`, event);
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
      await error(`Could not retrieve document ${documentPath}: ${err}`, event);
      return;
    }

    if (!content) {
      await error(`Could not retrieve document content ${documentPath}`, event);
      return;
    }

    // The document's unit, from its Firestore metadata. It picks the unit the screenshot is
    // rendered with, and until the unit configuration includes the summarizer it also picks the
    // text summarizer for the cas unit.
    // A failure here has to go through error() like the other failures: it removes the pending
    // queue entry, and without that the entry stays put and later edits of the document, which
    // only update it, never trigger this function again.
    let documentUnit: unknown;
    if (queueDoc?.firestoreDocumentPath) {
      try {
        const firestoreDoc = await firestore.doc(queueDoc.firestoreDocumentPath).get();
        documentUnit = firestoreDoc.data()?.unit;
      } catch (err) {
        await error(`Could not retrieve Firestore document ${queueDoc.firestoreDocumentPath}: ${err}`, event);
        return;
      }
    }

    // determine the summarizer to use, defaulting to "image"
    let summarizer = queueDoc?.aiPrompt?.summarizer;
    if (!summarizer && documentUnit === "cas") {
      logger.info(`Firestore doc ${queueDoc?.firestoreDocumentPath} has unit "cas", using text summarizer`);
      summarizer = "text";
    }
    summarizer = summarizer ?? "image";
    let nextQueueDoc: Record<string, unknown> = {...queueDoc, summarizer};

    logger.info(`Using summarizer ${summarizer}`);

    if (summarizer === "text") {
      const docSummary = documentSummarizer(content, {});
      nextQueueDoc = {...nextQueueDoc, docSummary};
    } else if (summarizer === "image") {
      // Generate screenshot with Shutterbug service
      let responseJSON;
      try {
        const unit = renderUnitFor(documentUnit);
        if (unit !== documentUnit) {
          logger.info(`Document unit ${JSON.stringify(documentUnit)} is not usable for rendering, using "${unit}"`);
        }
        const html = generateHtml(JSON.parse(content), unit);
        const response = await fetch(shutterbugURL,
          {
            method: "POST",
            body: JSON.stringify({content: html, height: 1500}),
          }
        );
        responseJSON = await response.json();
      } catch (err) {
        await error(`Shutterbug error: ${err}`, event);
        return;
      }
      nextQueueDoc = {
        ...nextQueueDoc,
        docImaged: admin.firestore.FieldValue.serverTimestamp(),
        docImageUrl: (responseJSON as { url: string }).url,
      };
    } else {
      await error(`Unexpected value for summarizer: ${summarizer}`, event);
      return;
    }

    // Write to the "imaged" queue
    const nextQueuePath = getAnalysisQueueFirestorePath("imaged", docId);
    await firestore.doc(nextQueuePath).set(nextQueueDoc);

    // Remove from the "pending" queue
    await firestore.doc(event.document).delete();
  });
