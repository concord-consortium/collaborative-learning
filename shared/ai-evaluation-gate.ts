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
 *
 * Either value being absent reads as changed. A missing gate means nothing has been evaluated yet,
 * and a missing latest index means the history could not be read -- neither is evidence that the
 * document is unchanged, and treating them as such would withhold evaluations entirely.
 */
export function hasChangedSinceEvaluation(
  latestIndex: number | undefined, gateIndex: number | undefined
): boolean {
  if (latestIndex === undefined || gateIndex === undefined) return true;
  return latestIndex !== gateIndex;
}
