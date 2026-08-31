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
