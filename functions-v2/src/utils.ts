import {escapeKey} from "../../shared/shared";

export function isArrayEqual(array1: string[] | undefined, array2: string[]) {
  return array1?.length === array2.length && array1.every((value, index) => value === array2[index]);
}

export function isKnownEvaluator(evaluator?: string) {
  const knownEvaluators = ["categorize-design", "custom", "mock"];
  return evaluator && knownEvaluators.includes(evaluator);
}

export type AnalysisQueueStatus = "pending" | "imaged" | "summarized" | "done" | "failedImaging" | "failedAnalyzing";

export function getAnalysisQueueFirestorePath(status: AnalysisQueueStatus, docId?: string) {
  if (docId) {
    return `analysis/queue/${status}/${docId}`;
  } else {
    return `analysis/queue/${status}`;
  }
}

/*
 * The one place a `summaries/` record id is derived, so that the analysis pipeline (which creates
 * the record) and the rating trigger (which adds agreements to it) cannot disagree about where a
 * document's summary lives.
 *
 * It takes the document's `key` — the field on the Firestore metadata document — rather than a
 * path segment or an analysis queue record's id. Those equal the key on documents created by
 * `createFirestoreMetadataDocumentIfNecessaryWithoutValidation`, but not on older ones, whose
 * metadata document id carries a uid or network prefix (see `networkDocumentKey` in
 * shared/shared.ts). Deriving from `key` makes the two writers agree by construction rather than
 * by that coincidence.
 *
 * `escapeKey` is what keeps the result a legal Firestore document id, which cannot contain `/`.
 * Real document keys are Firebase push ids, whose characters it leaves alone.
 */
export function getSummaryPath(root: string, space: string, key: string): string {
  return `summaries/${root}-${space}-${escapeKey(key)}`;
}
