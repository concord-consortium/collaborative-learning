export function isArrayEqual(array1: string[] | undefined, array2: string[]) {
  return array1?.length === array2.length && array1.every((value, index) => value === array2[index]);
}

export function isKnownEvaluator(evaluator: string) {
  return evaluator === "categorize-design" || evaluator === "mock";
}

type analysisQueueStatus = "pending" | "imaged" | "done" | "failedImaging" | "failedAnalyzing";

export function getAnalysisQueueFirestorePath(status: analysisQueueStatus, docId?: string) {
  if (docId) {
    return `analysis/queue/${status}/${docId}`;
  } else {
    return `analysis/queue/${status}`;
  }
}
