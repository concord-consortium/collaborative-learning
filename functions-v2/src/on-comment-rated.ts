import {FirestoreEvent, onDocumentWritten} from "firebase-functions/v2/firestore";
import {Change, DocumentSnapshot} from "firebase-functions/lib/v2/providers/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {kAnalyzerUserParams, kRatingValues, RatingValue} from "../../shared/shared";
import {AiAgreement, AiAgreementV2, isAiAgreement, Summary} from "./summary-types";
import {getSummaryPath} from "./utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const logInfo = (...message: any[]) => logger.info("ON COMMENT RATED:", ...message);

/*
 * The `ratings` map as stored on a comment, with anything the app could not have written removed.
 *
 * Rules validate rating values in the `authed` realm, but `demo` and `dev` let any signed-in user
 * write anything, while `qa` and `test` allow arbitrary writes within the user's own root. An
 * unrecognized value is therefore a shape this function really can be handed. Dropping it here
 * means it is never recorded, and a valid value changed to an invalid one reads as a removal.
 */
function readRatings(data: FirebaseFirestore.DocumentData | undefined): Record<string, RatingValue> {
  const ratings = data?.ratings;
  if (!ratings || typeof ratings !== "object" || Array.isArray(ratings)) return {};
  const valid: Record<string, RatingValue> = {};
  for (const [raterUid, value] of Object.entries(ratings)) {
    if (typeof value === "string" && (kRatingValues as readonly string[]).includes(value)) {
      valid[raterUid] = value as RatingValue;
    }
  }
  return valid;
}

// A summary written before `aiAgreements` existed has no map at all, which is what the retired
// function crashed on.
function readAgreements(summary: Summary | undefined): Record<string, AiAgreement> {
  const agreements = summary?.aiAgreements;
  if (!agreements || typeof agreements !== "object" || Array.isArray(agreements)) return {};
  return {...agreements};
}

function sameRatings(before: Record<string, RatingValue>, after: Record<string, RatingValue>) {
  const beforeRaters = Object.keys(before);
  return beforeRaters.length === Object.keys(after).length &&
    beforeRaters.every((raterUid) => before[raterUid] === after[raterUid]);
}

// One entry per rater per comment. A rater can rate several comments on the same document, and the
// same comment can be rated by several people.
function agreementKey(commentId: string, raterUid: string) {
  return `${commentId}_${raterUid}`;
}

/**
 * onCommentRated
 *
 * Records what people said about a document's comments on that document's summary, where later
 * evaluations of similar documents can read the counts. It replaces `onDocumentSummarized`, which
 * read the retired `agreeWithAi` field and did the analysis pipeline's job of writing summaries.
 *
 * This function never creates or deletes a summary. The pipeline owns those, and a rating on a
 * document that has not been analyzed simply has nowhere to go: that is logged and skipped. It
 * reads no realtime database, summarizes nothing, and computes no embeddings.
 *
 * Firestore delivers trigger events at least once and in no particular order, so the event payload
 * decides only whether there is anything to do. What gets written is reconciled against a fresh
 * read of the comment inside the transaction, which is what makes a duplicate event a no-op, an
 * out-of-order pair converge, and a late event unable to resurrect a removed rating.
 */
export const onCommentRated = onDocumentWritten(
  "{root}/{space}/documents/{documentId}/comments/{commentId}",
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined>) => {
    if (!event.data) return;

    const before = event.data.before?.data();
    const after = event.data.after?.data();

    if (before && !after) {
      // A deleted comment takes its agreements with it. This has to be asked before the ratings
      // diff below, because a legacy comment carrying only `agreeWithAi` has no ratings to differ.
      if (before.ratings === undefined && before.agreeWithAi === undefined) return;
    } else if (sameRatings(readRatings(before), readRatings(after))) {
      return;
    }

    const {root, space, documentId, commentId} = event.params;
    const firestore = admin.firestore();
    const documentPath = `${root}/${space}/documents/${documentId}`;
    const documentKey = await firestore.doc(documentPath).get().then((snapshot) => snapshot.data()?.key);
    if (!documentKey) {
      logInfo("No document key; nothing to record a rating against:", documentPath);
      return;
    }

    const summaryRef = firestore.doc(getSummaryPath(root, space, documentKey));
    const commentRef = firestore.doc(`${documentPath}/comments/${commentId}`);
    const eventTime = Date.parse(event.time);

    await firestore.runTransaction(async (transaction) => {
      const [commentSnapshot, summarySnapshot] = await transaction.getAll(commentRef, summaryRef);
      if (!summarySnapshot.exists) {
        // The expected case for a document the analysis pipeline has not summarized, and for any
        // Ada comment that predates this feature. Logged so the size of that gap is observable.
        logInfo("No summary for this document; skipping.", {documentKey, summaryPath: summaryRef.path});
        return;
      }

      const summary = summarySnapshot.data() as Summary | undefined;
      const stored = readAgreements(summary);
      const agreements = {...stored};
      let changed = false;

      const remove = (key: string) => {
        if (key in agreements) {
          delete agreements[key];
          changed = true;
        }
      };

      if (!commentSnapshot.exists) {
        // The comment is gone, whether this event said so or a later deletion beat this event here.
        for (const [key, entry] of Object.entries(stored)) {
          if (entry.version === 2 && entry.commentId === commentId) remove(key);
        }
        // A version-1 entry is keyed by the comment's author, and there is no snapshot left to ask
        // who that was, so the event's own view of the comment is the only source available.
        const authorUid = before?.uid ?? after?.uid;
        if (typeof authorUid === "string" && stored[authorUid]?.version === 1) remove(authorUid);
      } else {
        const comment = commentSnapshot.data();
        const commentUid = comment?.uid;
        if (typeof commentUid !== "string" || !commentUid) {
          logInfo("Comment has no uid; leaving the summary alone:", commentRef.path);
          return;
        }

        const ratings = readRatings(comment);
        // `tags` is optional in the schema and demo/dev rules police neither field, so neither is
        // trusted to be the right type. An `undefined` must never reach a Firestore write.
        const content = typeof comment.content === "string" ? comment.content : "";
        const tags = Array.isArray(comment.tags) ? comment.tags : [];
        const isAiComment = commentUid === kAnalyzerUserParams.id;
        // What this particular event believes the ratings became, as opposed to what they are now.
        const eventRatings = readRatings(after);

        for (const [key, entry] of Object.entries(stored)) {
          if (entry.version !== 2 || entry.commentId !== commentId) continue;
          if (ratings[entry.raterUid] === undefined) remove(key);
        }

        for (const [raterUid, value] of Object.entries(ratings)) {
          const key = agreementKey(commentId, raterUid);
          const existing = stored[key];
          if (existing?.version === 2 && existing.value === value) {
            /*
             * The stored entry already says what the comment says. `content` and `tags` stay as
             * they are, because they record how the comment read when the rating was made.
             *
             * The timestamp is moved forward only when this event's own view agrees with the
             * comment: an event that disagrees is a stale one that happens to reconcile to the
             * current value, and stamping it would date the entry to before whatever set that
             * value.
             */
            if (eventRatings[raterUid] === value && eventTime > (existing.updatedAt ?? 0)) {
              agreements[key] = {...existing, updatedAt: eventTime};
              changed = true;
            }
            continue;
          }
          const agreement: AiAgreementV2 = {
            version: 2,
            value,
            raterUid,
            commentId,
            commentUid,
            isAiComment,
            content,
            tags,
            updatedAt: eventTime,
          };
          agreements[key] = agreement;
          changed = true;
        }
      }

      // Counted from the map rather than adjusted, so a missed or repeated event cannot leave a
      // count that disagrees with the entries. This is also what backfills `numAgreements` on a
      // record written before that field existed.
      const numAiAgreements = Object.values(agreements).filter(isAiAgreement).length;
      const numAgreements = Object.keys(agreements).length;
      if (!changed && numAiAgreements === summary?.numAiAgreements && numAgreements === summary?.numAgreements) {
        logInfo("Summary already agrees with the comment; nothing to write.", summaryRef.path);
        return;
      }

      // The summary is never deleted, even at zero agreements: it belongs to the analysis, and
      // `numAiAgreements: 0` is already what drops it out of the related-summaries lookup.
      transaction.update(summaryRef, {aiAgreements: agreements, numAiAgreements, numAgreements});
      logInfo("Recorded ratings on summary", summaryRef.path, {numAiAgreements, numAgreements});
    });
  }
);
