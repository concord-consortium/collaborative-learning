import {getDatabase, ServerValue} from "firebase-admin/database";
import * as logger from "firebase-functions/logger";

/** What became of an evaluation request, echoed back to the client. */
export type EvaluationOutcome = "skipped-empty" | "commented" | "failed";

export interface EvaluationStatus {
  outcome: EvaluationOutcome;
  /** Absent for the automatic routes (onDisconnect, sync-hook cleanup), which have no request to echo. */
  requestId?: string;
  docUpdated: number | string;
}

/**
 * Writes the completion status for an evaluation request, keyed per request under
 * `${metadataPath}/evaluationStatus/${evaluator}/${requestId ?? "automatic"}` rather than a single
 * shared node — otherwise a slow older write could land after a newer one and overwrite it, and a
 * new listener would see whatever request's status happened to already be there.
 *
 * Best-effort: catches its own rejection and never throws, so a bounced write can't strand a queue
 * entry or comment. Call only after the outcome it describes has already landed.
 *
 * @param {string} metadataPath the document's metadata path, from the queue record
 * @param {string} evaluator which evaluator this status is for
 * @param {EvaluationStatus} status the outcome to record
 * @return {Promise<void>} always resolves, never rejects
 */
export async function writeEvaluationStatus(
  metadataPath: string, evaluator: string, status: EvaluationStatus
): Promise<void> {
  const {outcome, requestId, docUpdated} = status;
  const path = `${metadataPath}/evaluationStatus/${evaluator}/${requestId ?? "automatic"}`;
  try {
    await getDatabase().ref(path).set({
      outcome,
      // Firebase rejects undefined, so an absent requestId is written as no field at all.
      ...(requestId ? {requestId} : {}),
      docUpdated,
      completedAt: ServerValue.TIMESTAMP,
    });
  } catch (err) {
    logger.warn(`Could not write evaluation status at ${path}`, err);
  }
}
