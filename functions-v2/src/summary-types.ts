import type {FieldValue} from "firebase-admin/firestore";
import {RatingValue} from "../../shared/shared";

// The agreement entries stored in a summary's `aiAgreements` map.

/**
 * The original entry shape, written by the retired `agreeWithAi` flow. Only Ada's comments could
 * carry `agreeWithAi`, so a version-1 entry is always an agreement with an AI comment. It records
 * no rater and no comment id, which is why deleting a comment removes it by the comment author's
 * bare uid. Nothing writes these any more; the ones already stored are read, not migrated.
 */
export interface AiAgreementV1 {
  version: 1;
  value: RatingValue;
  content: string;
  tags: string[];
}

/**
 * The entry shape written from the comment `ratings` map. Ratings apply to any comment, not just
 * Ada's, so this shape names who rated, what they rated, and whether that comment was Ada's.
 *
 * `updatedAt` is epoch milliseconds, taken from the trigger event's time.
 */
export interface AiAgreementV2 {
  version: 2;
  value: RatingValue;
  raterUid: string;
  commentId: string;
  commentUid: string;
  isAiComment: boolean;
  content: string;
  tags: string[];
  updatedAt: number;
}

export type AiAgreement = AiAgreementV1 | AiAgreementV2;

/*
 * Whether an entry records an agreement with one of Ada's comments.
 *
 * Both the count stored on the summary and the filter on the read side ask this question, so the
 * rule that a version-1 entry is an AI agreement by construction is written down once.
 */
export function isAiAgreement(entry: AiAgreement): boolean {
  return entry.version === 1 ? true : entry.isAiComment === true;
}

/**
 * A `summaries/{summaryId}` record: the summary the AI evaluated for one document, the vector it
 * was found by, and what people said about the comments it produced.
 *
 * The analysis pipeline creates and refreshes the record; `onCommentRated` only ever adjusts
 * `aiAgreements` and the two counts. `numAgreements` is optional on read because records written
 * before it existed do not carry it; the recompute in `onCommentRated` fills it in the first time
 * a rating touches such a record.
 */
export interface Summary {
  key: string;
  context_id: string;
  unit: string;
  investigation: string;
  problem: string;
  offeringId: string;
  summary: string;
  summaryEmbedding: FieldValue;
  analyzedAt: number;
  adaCommentId?: string;
  numAiAgreements: number;
  numAgreements?: number;
  aiAgreements: Record<string, AiAgreement>;
}
