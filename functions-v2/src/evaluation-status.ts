import {getDatabase, ServerValue} from "firebase-admin/database";
import * as logger from "firebase-functions/logger";
import {EvaluationOutcome} from "../../shared/shared";

export interface EvaluationStatus {
  outcome: EvaluationOutcome;
  /** Absent for the automatic routes (onDisconnect, sync-hook cleanup), which have no request to echo. */
  requestId?: string;
  docUpdated: number | string;
}

// How long a status is kept before it's pruned as stale. Comfortably past the ~2.5 minutes
// (120s pending-entry expiry + 15s click deadline) anything client-side ever waits for one.
export const kStatusRetentionMs = 10 * 60 * 1000;

/**
 * Deletes this evaluator's own children older than kStatusRetentionMs. Each request writes to its
 * own child (see writeEvaluationStatus), so without this the node would grow by one entry per
 * Ideas click, forever.
 *
 * @param {string} parentPath the evaluator's evaluationStatus node, whose direct children are requests
 * @return {Promise<void>}
 */
async function pruneStaleStatuses(parentPath: string): Promise<void> {
  const cutoff = Date.now() - kStatusRetentionMs;
  const snapshot = await getDatabase().ref(parentPath).once("value");
  const staleKeys: string[] = [];
  snapshot.forEach((child) => {
    const completedAt = child.val()?.completedAt;
    if (typeof completedAt === "number" && completedAt < cutoff) staleKeys.push(child.key as string);
  });
  if (staleKeys.length > 0) {
    await getDatabase().ref(parentPath).update(Object.fromEntries(staleKeys.map((key) => [key, null])));
  }
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
  const parentPath = `${metadataPath}/evaluationStatus/${evaluator}`;
  const path = `${parentPath}/${requestId ?? "automatic"}`;

  try {
    await pruneStaleStatuses(parentPath);
  } catch (err) {
    logger.warn(`Could not prune stale evaluation statuses at ${parentPath}`, err);
  }

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

/**
 * Writes the same completion status under every request id given, or a single status under
 * "automatic" if none — see AnalysisQueueDocument.requestIds for why a queue document can carry
 * more than one.
 *
 * @param {string} metadataPath the document's metadata path, from the queue record
 * @param {string} evaluator which evaluator this status is for
 * @param {string[] | undefined} requestIds every request id the queue record carries
 * @param {Omit<EvaluationStatus, "requestId">} status the outcome to record for each of them
 * @return {Promise<void>} always resolves, never rejects
 */
export async function writeEvaluationStatusForRequests(
  metadataPath: string, evaluator: string, requestIds: string[] | undefined,
  status: Omit<EvaluationStatus, "requestId">
): Promise<void> {
  const ids: (string | undefined)[] = requestIds && requestIds.length > 0 ? requestIds : [undefined];
  await Promise.all(ids.map((requestId) => writeEvaluationStatus(metadataPath, evaluator, {...status, requestId})));
}
