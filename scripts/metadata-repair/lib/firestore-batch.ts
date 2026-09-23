/** Batched writes are capped at 400, well below Firestore's 500-operation limit. */
export const kBatchSize = 400;
