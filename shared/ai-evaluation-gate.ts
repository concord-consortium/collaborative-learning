import { hashString } from "./hash-string";

/**
 * The Realtime Database node, a sibling of `evaluation`, where the server records what it last
 * evaluated a document with.
 *
 * Deliberately NOT under `evaluation`: on-analyzable-doc-written triggers on writes there, so a
 * gate stored under it would re-trigger the function on its own write -- an evaluation loop
 * costing exactly what this gate saves.
 */
export const kEvaluationGateKey = "evaluationGate";

/**
 * What the server records after a successful evaluation.
 *
 * Only the student's work and the request are hashed. Other inputs to an evaluation are left out
 * on purpose because they are not the student's work: the unit summary, the related summaries of
 * other students' documents, and the built-in `categorize-design` prompt. A change to one of them
 * does not cause a new evaluation.
 */
export interface IEvaluationGate {
  contentHash: string;
  requestHash: string;
}

/** The content string exactly as it is saved to the Realtime Database. */
export function hashDocumentContent(content: string): string {
  return hashString(content);
}

/**
 * The prompt and context the client sends with an evaluation request. Computed by the client,
 * which builds both: rebuilding the string on the server would be fragile, because the Realtime
 * Database drops empty arrays and may reorder keys.
 */
export function hashEvaluationRequest(aiPrompt: unknown, context: unknown): string {
  return hashString(JSON.stringify({ aiPrompt: aiPrompt ?? null, context: context ?? null }));
}

/**
 * True only when both hashes are known and both match the gate. Anything missing or unreadable
 * returns false, which allows the evaluation.
 */
export function isUnchangedSinceEvaluation(
  gate: unknown, contentHash: string | undefined, requestHash: string | undefined
): boolean {
  if (!contentHash || !requestHash || !gate || typeof gate !== "object") return false;
  const { contentHash: gateContent, requestHash: gateRequest } = gate as Partial<IEvaluationGate>;
  return gateContent === contentHash && gateRequest === requestHash;
}
