import {getDatabase, ServerValue} from "firebase-admin/database";
import * as logger from "firebase-functions/logger";

/** What became of an evaluation request, echoed back to the client. */
export type EvaluationOutcome = "skipped-empty" | "commented" | "failed";

export interface EvaluationStatus {
  outcome: EvaluationOutcome;
  /** Echoed from the request, when it had one — the automatic routes (onDisconnect, sync-hook
   * cleanup) write no id, so there is nothing to echo for them. */
  requestId?: string;
  /** The request's evaluation timestamp, as recorded on the queue record. */
  docUpdated: number | string;
}

/**
 * Writes the completion status for an evaluation request to the Realtime Database, at
 * `${metadataPath}/evaluationStatus/${evaluator}` — a sibling of the `evaluation/${evaluator}`
 * node the client wrote to make the request.
 *
 * Best-effort: it catches its own rejection, logs it, and resolves either way, so it can never
 * fail the calling function or leave a queue entry or comment stranded because this write
 * bounced. Callers must invoke it only after the outcome it describes — a `done` record, a
 * comment, a failure record — has already landed, so a rejected write here never gets ahead of
 * the work it is reporting on. The client's own 120s timeout is the fallback when a status never
 * arrives at all.
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
  const path = `${metadataPath}/evaluationStatus/${evaluator}`;
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
