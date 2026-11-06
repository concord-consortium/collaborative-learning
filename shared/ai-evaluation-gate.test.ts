import { hasChangedSinceEvaluation, kEvaluationGateKey } from "./ai-evaluation-gate";

describe("hasChangedSinceEvaluation", () => {
  it("is changed when the index has moved", () => {
    expect(hasChangedSinceEvaluation(52, 47)).toBe(true);
  });

  it("is unchanged when the index matches", () => {
    expect(hasChangedSinceEvaluation(47, 47)).toBe(false);
  });

  // Absent must never read as unchanged, or a document would never get its first evaluation.
  it("is changed when nothing has been evaluated yet", () => {
    expect(hasChangedSinceEvaluation(47, undefined)).toBe(true);
  });

  // A document with no history to read is not evidence that nothing changed.
  it("is changed when the latest index cannot be read", () => {
    expect(hasChangedSinceEvaluation(undefined, 47)).toBe(true);
  });

  it("is changed when neither index is known", () => {
    expect(hasChangedSinceEvaluation(undefined, undefined)).toBe(true);
  });
});

describe("kEvaluationGateKey", () => {
  // The function triggers on writes under `evaluation`; a gate stored there would re-trigger it.
  it("is not the evaluation node", () => {
    expect(kEvaluationGateKey).not.toBe("evaluation");
  });
});
