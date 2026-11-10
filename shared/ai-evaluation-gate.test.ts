import {
  hashEvaluationRequest, isUnchangedSinceEvaluation, kEvaluationGateKey
} from "./ai-evaluation-gate";

describe("isUnchangedSinceEvaluation", () => {
  const gate = { contentHash: "c1", requestHash: "r1" };

  it("is unchanged when both hashes match the gate", () => {
    expect(isUnchangedSinceEvaluation(gate, "c1", "r1")).toBe(true);
  });

  it("is changed when the content hash differs", () => {
    expect(isUnchangedSinceEvaluation(gate, "c2", "r1")).toBe(false);
  });

  it("is changed when the request hash differs", () => {
    expect(isUnchangedSinceEvaluation(gate, "c1", "r2")).toBe(false);
  });

  // Absent must never read as unchanged, or a document would never get its first evaluation.
  it("is changed when there is no gate", () => {
    expect(isUnchangedSinceEvaluation(undefined, "c1", "r1")).toBe(false);
    expect(isUnchangedSinceEvaluation(null, "c1", "r1")).toBe(false);
  });

  it("is changed when either current hash is missing", () => {
    expect(isUnchangedSinceEvaluation(gate, undefined, "r1")).toBe(false);
    expect(isUnchangedSinceEvaluation(gate, "c1", undefined)).toBe(false);
  });

  it("is changed when the gate is missing a hash", () => {
    expect(isUnchangedSinceEvaluation({ contentHash: "c1" }, "c1", "r1")).toBe(false);
  });

  // A gate written by the earlier history-index version of this code.
  it("is changed when the gate is not an object", () => {
    expect(isUnchangedSinceEvaluation(47, "c1", "r1")).toBe(false);
  });
});

describe("hashEvaluationRequest", () => {
  const prompt = { mainPrompt: "Evaluate this", categories: ["a"] };
  const context = { unit: "vibe", investigation: "1", problem: "2", offeringId: "2001" };

  it("is stable for the same prompt and context", () => {
    expect(hashEvaluationRequest(prompt, context)).toBe(hashEvaluationRequest({ ...prompt }, { ...context }));
  });

  it("changes when the prompt changes", () => {
    expect(hashEvaluationRequest({ ...prompt, categories: ["a", "b"] }, context))
      .not.toBe(hashEvaluationRequest(prompt, context));
  });

  it("changes when the context changes", () => {
    expect(hashEvaluationRequest(prompt, { ...context, problem: "3" }))
      .not.toBe(hashEvaluationRequest(prompt, context));
  });

  it("treats an absent prompt and context as null", () => {
    expect(hashEvaluationRequest(undefined, undefined)).toBe(hashEvaluationRequest(null, null));
  });
});

describe("kEvaluationGateKey", () => {
  // The function triggers on writes under `evaluation`; a gate stored there would re-trigger it.
  it("is not the evaluation node", () => {
    expect(kEvaluationGateKey).not.toBe("evaluation");
  });
});
