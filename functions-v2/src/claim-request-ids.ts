import * as admin from "firebase-admin";

/**
 * Reads a queue document's requestIds and deletes it atomically, so an id added after this
 * trigger's own event fired (see AnalysisQueueDocument.requestIds) isn't lost to a `.delete()`
 * racing that write.
 *
 * @param {admin.firestore.DocumentReference} docRef the queue document to remove
 * @return {Promise<string[] | undefined>} the requestIds it held at the moment of deletion
 */
export async function claimRequestIds(
  docRef: admin.firestore.DocumentReference
): Promise<string[] | undefined> {
  return docRef.firestore.runTransaction(async (transaction) => {
    const requestIds = (await transaction.get(docRef)).data()?.requestIds;
    transaction.delete(docRef);
    return Array.isArray(requestIds) ? requestIds : undefined;
  });
}
