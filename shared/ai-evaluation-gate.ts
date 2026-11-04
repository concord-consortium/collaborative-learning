/**
 * The Realtime Database node, a sibling of `evaluation`, where the server records the history
 * index it last evaluated a document at.
 *
 * Deliberately NOT under `evaluation`: on-analyzable-doc-written triggers on writes there, so a
 * gate stored under it would re-trigger the function on its own write -- an evaluation loop
 * costing exactly what this gate saves.
 */
export const kEvaluationGateKey = "evaluationGate";

/**
 * Whether a document has changed since the evaluation its gate records.
 */
export function hasChangedSinceEvaluation(
  latestIndex: number | undefined, gateIndex: number | undefined
): boolean {
  // A number is never equal to undefined, so an unrecorded gate already reads as changed through
  // the comparison below. This guard is for the case where neither index is known, which must not
  // read as unchanged -- that would withhold evaluations from a document we know nothing about.
  if (latestIndex === undefined) return true;
  return latestIndex !== gateIndex;
}
