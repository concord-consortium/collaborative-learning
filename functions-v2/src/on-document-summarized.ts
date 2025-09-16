import {FirestoreEvent, onDocumentWritten} from "firebase-functions/v2/firestore";
import {Change, DocumentSnapshot} from "firebase-functions/lib/v2/providers/firestore";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import {defineSecret} from "firebase-functions/params";
import {getEmbeddings} from "../lib/src/ai-categorize-document";
import {documentSummarizer} from "../../shared/ai-summarizer";

interface Summary {
  key: string;
  context_id: string;
  problem: string;
  investigation: string;
  unit: string;
  offeringId: string;
  createdAt: number;
  summary: string;
  summaryEmbedding: FieldValue
  numAiAgreements: number;
  aiAgreements: Record<string, AiAgreement>;
}

export interface AiAgreement {
  version: 1;
  value: string;
  content: string;
  tags: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const logInfo = (...message: any[]) => logger.info("ON DOCUMENT SUMMARIZED:", ...message);

const openaiApiKey = defineSecret("OPENAI_API_KEY");

/*
 * onDocumentSummarized
 * Listens for changes to comments and creates/updates the document summary along with its ai agreements.
*/
export const onDocumentSummarized = onDocumentWritten({
  document: "{root}/{space}/documents/{documentId}/comments/{commentId}",
  secrets: [openaiApiKey],
}, async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined>) => {
  if (!event.data) return;

  logInfo("START");

  // ensure the comment either has a uid and has or had agreeWithAi set - we don't care about comments that don't
  const before = event.data.before?.data();
  const after = event.data.after?.data();
  const commentUid = before?.uid ?? after?.uid;
  if (!commentUid || !(before?.agreeWithAi || after?.agreeWithAi)) {
    logInfo("EARLY EXIT: no uid or agreeWithAi not set:", {commentUid, before, after});
    return;
  }

  // get the source document
  const {root, space, documentId} = event.params;
  const documentPath = `${root}/${space}/documents/${documentId}`;
  const firestore = admin.firestore();
  logInfo("Firestore document path:", documentPath);
  const docSnapshot = await firestore.doc(documentPath).get();
  if (!docSnapshot.exists) {
    // sanity check
    logInfo("EARLY EXIT: Document for comment does not exist:", documentPath);
    return;
  }
  const docData = docSnapshot.data();

  if (!docData || !docData.context_id || !docData.uid) {
    logInfo("EARLY EXIT: Document is missing required fields");
    return;
  }

  // FOR NOW: only summarize the cas unit documents
  if (docData.unit !== "cas") {
    logInfo("EARLY EXIT: document is not a cas unit:", {unit: docData.unit});
    return;
  }

  if (["authed", "demo"].includes(root)) {
    logInfo("EARLY EXIT: Document is in authed or demo root:", {root});
  }
  const prefix = root === "authed" ? `authed/portals/${space}` : `demo/${space}/portals/demo`;
  const firebaseDocumentPath = `${prefix}/classes/${docData.context_id}/users/${docData.uid}/documents/${documentId}`;
  logInfo("Firebase document path:", firebaseDocumentPath);
  let content: string|undefined = undefined;
  try {
    await (getDatabase().ref(firebaseDocumentPath).once("value", (snapshot) => {
      content = snapshot.child("content").val() as string;
    }));
  } catch (err) {
    logInfo(`Could not retrieve document ${firebaseDocumentPath}: ${err}`);
    return;
  }

  // get document summary from the current content
  const summary = documentSummarizer(content ?? "NO CONTENT!", {});

  const summaryPath = `summaries/${root}-${space}-${documentId}`;
  const summaryRef = firestore.doc(summaryPath);
  logInfo("Summary path:", summaryPath);

  // before we run the transaction see if we need new embeddings so that we don't
  // block waiting for them inside the transaction
  const existingSummaryData = await summaryRef.get().then((s) => s.data() as Summary | undefined);
  let summaryEmbedding = existingSummaryData?.summaryEmbedding;
  if (!summaryEmbedding || existingSummaryData?.summary !== summary) {
    logInfo("Generating new summary embedding");
    const embeddings = await getEmbeddings(summary, openaiApiKey.value());
    summaryEmbedding = FieldValue.vector(embeddings);
  }
  const summaryFields = {summary, summaryEmbedding};

  await firestore.runTransaction(async (transaction) => {
    const summarySnapshot = await transaction.get(summaryRef);
    const summaryData = summarySnapshot.data() as Summary | undefined;
    const aiAgreementsKey = `aiAgreements.${commentUid}`;
    const hasExistingAiAgreement = !!summaryData?.aiAgreements[commentUid];
    let numAiAgreements = Object.keys(summaryData?.aiAgreements || {}).length;

    if (before && !after) {
      // comment was deleted
      logInfo("Comment was deleted:", commentUid);

      if (hasExistingAiAgreement) {
        if (numAiAgreements === 1) {
          // delete the whole summary since this is the only comment
          logInfo("Deleting entire summary since this was the only ai agreement");
          transaction.delete(summaryRef);
        } else {
          // delete the ai agreement
          logInfo("Deleting ai agreement for comment:", commentUid);
          numAiAgreements = Math.max(0, numAiAgreements - 1);
          transaction.update(summaryRef, {[aiAgreementsKey]: FieldValue.delete(), numAiAgreements});
        }
      } else {
        // nothing to do since there is no summary for this comment
        logInfo("No existing ai agreement for deleted comment:", commentUid);
      }
    } else if (after) {
      // comment was added or updated
      logInfo("Comment was created or updated:", commentUid);

      const aiAgreement: AiAgreement = {
        version: 1,
        value: after.agreeWithAi.value,
        content: after.content,
        tags: after.tags,
      };

      if (!hasExistingAiAgreement) {
        numAiAgreements += 1;
      }

      if (summarySnapshot.exists) {
        // Update existing document
        logInfo("Updating existing summary document");
        transaction.update(summaryRef, {...summaryFields, [aiAgreementsKey]: aiAgreement, numAiAgreements});
      } else {
        // Create new document
        logInfo("Creating new summary document");
        const {key, problem, investigation, unit, offeringId} = docData;
        const newSummaryData: Summary = {
          key,
          context_id: docData.context_id,
          problem,
          investigation,
          unit,
          offeringId,
          createdAt: Date.now(),
          ...summaryFields,
          numAiAgreements,
          aiAgreements: {[commentUid]: aiAgreement},
        };
        transaction.set(summaryRef, newSummaryData);
      }
    }
  });
});
