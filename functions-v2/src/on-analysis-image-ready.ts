import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {getDatabase} from "firebase-admin/database";

// This is one of three functions for AI analysis of documents:
// 1. Watch for changes to the lastUpdatedAt metadata field and write a queue of docs to process
// 2. Create screenshots of those documents
// 3. (This function) Send those screenshots to the AI service for processing, and create comments with the results

// NOTE: these should match the user specified in src/models/stores/user-types.ts
const commenterName = "Ada Insight";
const commenterUid = "ada_insight_1";

// TODO once we have actual screenshots to work with, we can replace this sample data with call to AI service
const sampleMessage = {
  refusal: null,
  content: {
    category: "function",
    keyIndicators: ["Water Saving Idea", "rain barrel"],
    discussion: "The document mentions a 'Water Saving Idea' and refers specifically to a 'rain barrel', " +
      "indicating a focus on the functionality of the design in terms of saving water.",
  },
};

// Make a comment in Firestore
export const onAnalysisImageReady =
  onDocumentWritten("demo/AI/portals/demo/aiProcessingQueue/{docId}",
    async (event) => {
      const {docId} = event.params;
      const queueDocRef = getDatabase().ref(event.document);

      // Document should contain { metadataPath, updated, status }
      const snap = await queueDocRef.once("value");
      if (snap.val().status !== "imaged") return;

      // TODO: do AI analysis here to construct the comment content.
      if (sampleMessage.refusal) {
        logger.info("AI refused to comment on", event.document, sampleMessage.refusal);
        return;
      }
      const tags = [sampleMessage.content.category];
      const message = sampleMessage.content.discussion +
        ` Key Indicators: ${sampleMessage.content.keyIndicators.join(", ")}`;

      const commentsPath = `demo/AI/documents/${docId}/comments`;

      // Look for existing comment
      const firestore = admin.firestore();
      const existing = await firestore.collection(commentsPath)
        .where("uid", "==", commenterUid).get().then((snapshot) => {
          console.log("did query, got", snapshot.size);
          if (snapshot.size > 0) {
            return snapshot.docs[0];
          } else {
            return undefined;
          }
        });

      if (existing) {
        logger.info("Updating existing comment for", event.document);
        await existing.ref.update({
          tags,
          content: message,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        logger.info("Creating comment for", event.document);
        await firestore.collection(commentsPath).add({
          content: message,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          name: commenterName,
          uid: commenterUid,
        });
      }

      await queueDocRef.update({
        status: "done",
      });
    });
