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
