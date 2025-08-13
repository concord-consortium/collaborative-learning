import {FirestoreEvent, onDocumentCreated, QueryDocumentSnapshot} from "firebase-functions/v2/firestore";
import {getAnalysisQueueFirestorePath, isKnownEvaluator} from "./utils";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// This is one of three functions for AI analysis of documents:
// 1. Watch for changes to the lastUpdatedAt metadata field and write into the queue of docs to process
// 2. (This function) Create screenshots of those documents
// 3. Send those screenshots to the AI service for processing, and create document comments with the results

const clueURL = "https://collaborative-learning.concord.org/branch/shutterbug-support";
const clueUnit = "mods";
const shutterbugURL = "https://api.concord.org/shutterbug-production";

function generateHtml(clueDocument: unknown) {
  return `
    <script>const initialValue=${JSON.stringify(clueDocument)}</script>
    <!-- height will be updated when iframe sends updateHeight message -->
    <iframe id='clue-frame' width='100%' height='500px' style='border:0px'
      allow='serial'
      src='${clueURL}/iframe.html?unit=${clueUnit}&unwrapped&readOnly'
    ></iframe>
    <script>
      const clueFrame = document.getElementById('clue-frame')
      function sendInitialValueToEditor() {
        if (!clueFrame.contentWindow) {
          console.warning("iframe doesn't have contentWindow");
        }
        window.addEventListener("message", (event) => {
          if (event.data.type === "updateHeight") {
            document.getElementById("clue-frame").height = event.data.height + "px";
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
    const queueDoc = event.data?.data();

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

    // Generate screenshot with Shutterbug service

    let responseJSON;
    try {
      const html = generateHtml(JSON.parse(content));
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

    // Write to the "imaged" queue
    const nextQueuePath = getAnalysisQueueFirestorePath("imaged", docId);
    await firestore.doc(nextQueuePath).set({
      ...queueDoc,
      docImaged: admin.firestore.FieldValue.serverTimestamp(),
      docImageUrl: (responseJSON as { url: string }).url,
    });

    // Remove from the "pending" queue
    await firestore.doc(event.document).delete();
  });
