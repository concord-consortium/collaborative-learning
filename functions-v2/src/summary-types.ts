import type {FieldValue} from "firebase-admin/firestore";
import {RatingValue} from "../../shared/shared";

// The agreement entries stored in a summary's `aiAgreements` map.

/**
 * The original entry shape, written by the retired `agreeWithAi` flow.
 *
 * That flow did not rate Ada's comment. It posted a *new* comment by the rater carrying the flag,
 * and `onDocumentSummarized` keyed the entry by that comment's author — so a version-1 key is the
 * rater's own uid, and `content` is the rater's own text rather than Ada's. What the value records
 * is agreement with Ada's summary, which is why these count as AI agreements, and deleting that
 * comment removes the entry by the same bare uid.
 *
 * Nothing writes these any more; the ones already stored are read, not migrated.
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
 * The analysis pipeline creates and refreshes the record, `root` and `space` included;
 * `onCommentRated` only ever adjusts `aiAgreements` and the two counts.
 *
 * Three fields are optional on read, all because a stored record need not carry them — this type
 * describes what a reader may find, where the design doc's Data Model describes what the pipeline
 * writes. `numAgreements` postdates the records that exist today, and the recompute in
 * `onCommentRated` fills it in the first time a rating touches one. `root` and `space` are written
 * by nothing yet: they arrive with the pipeline write in Track C, which needs them to scope the
 * related-summaries lookup to a single realm, and an older record gains them on its next analysis.
 */
export interface Summary {
  key: string;
  root?: string;
  space?: string;
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
