import {AssembledProblem, AssembledUnit} from "./assemble-unit";
import {
  UNIT_SUMMARY_HARD_MAX_AGGREGATE_INPUT_CHARS, UNIT_SUMMARY_HARD_MAX_PROBLEMS,
  UNIT_SUMMARY_MODE_SWITCH_PROBLEM_COUNT, UNIT_SUMMARY_OVERALL_DEADLINE_MS,
} from "./unit-summary-config";
import {GenerateUnitSummaryDeps, runUnitSummaryGeneration} from "./unit-summary-generate";
import {GenerateTextParams, UnitSummaryOpenAIClient} from "./unit-summary-openai";

function problem(ordinal: string, markdown = "content"): AssembledProblem {
  return {ordinal, title: `Problem ${ordinal}`, markdown, problemHash: `hash-${ordinal}`};
}

function assembledUnit(problems: AssembledProblem[]): AssembledUnit {
  return {
    sourceHash: "unit-hash",
    sourceManifest: problems.map((p) => ({ordinal: p.ordinal, title: p.title, problemHash: p.problemHash})),
    problems,
  };
}

function fakeClient(generateText: jest.Mock): UnitSummaryOpenAIClient {
  return {generateText};
}

function baseDeps(generateText: jest.Mock, assembled: AssembledUnit): GenerateUnitSummaryDeps {
  return {
    assembleUnit: async () => assembled,
    client: fakeClient(generateText),
    digestModel: "digest-model",
    summaryModel: "summary-model",
  };
}

describe("runUnitSummaryGeneration", () => {
  it("generates a valid summary for a small unit end to end", async () => {
    const problems = [problem("1.1"), problem("1.2"), problem("1.3")];
    const generateText = jest.fn().mockResolvedValue("a short response");
    const summary = await runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)));

    expect(summary.sourceHash).toBe("unit-hash");
    expect(summary.sourceManifest.map((p) => p.ordinal)).toEqual(["1.1", "1.2", "1.3"]);
    expect(summary.entries).toHaveLength(3);
    expect(summary.entries[0].priorKnowledge).toBe(""); // entry 0, never fabricated
    expect(summary.entries[0].problemDigest).toBe("a short response");
    expect(summary.overview).toBe("a short response");
    expect(new Date(summary.generatedAt).toISOString()).toBe(summary.generatedAt);
  });

  it("uses the given digest and summary models for the right calls", async () => {
    const problems = [problem("1.1"), problem("1.2")];
    const generateText = jest.fn().mockResolvedValue("response");
    await runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)));

    const calls: GenerateTextParams[] = generateText.mock.calls.map(([params]: [GenerateTextParams]) => params);
    const digestModels = new Set(
      calls.filter((c) => c.instructions.includes("content of ONE problem")).map((c) => c.model)
    );
    expect(digestModels).toEqual(new Set(["digest-model"]));
    const nonDigestModels = new Set(
      calls.filter((c) => !c.instructions.includes("content of ONE problem")).map((c) => c.model)
    );
    expect(nonDigestModels).toEqual(new Set(["summary-model"]));
  });

  it("rejects a unit with no problems with zero model calls, instead of sending OpenAI an " +
     "empty overview input", async () => {
    const generateText = jest.fn();
    await expect(
      runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit([])))
    ).rejects.toThrow(/no problems to summarize/);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("rejects a unit over the hard maximum problem count, naming the problem count in the error", async () => {
    const problems = Array.from(
      {length: UNIT_SUMMARY_HARD_MAX_PROBLEMS + 1}, (_, i) => problem(`1.${i + 1}`)
    );
    const generateText = jest.fn();
    const expectedMessage =
      new RegExp(`${UNIT_SUMMARY_HARD_MAX_PROBLEMS + 1} problems, limit ${UNIT_SUMMARY_HARD_MAX_PROBLEMS}`);
    await expect(
      runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)))
    ).rejects.toThrow(expectedMessage);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("rejects a unit over the hard maximum aggregate input despite a small problem count, " +
     "naming the actual reason rather than only the (unremarkable) problem count", async () => {
    // Five problems, each with huge Markdown: comfortably under the problem-count limit, but the
    // aggregate input estimate alone exceeds the hard maximum.
    const problems = Array.from(
      {length: 5}, (_, i) => problem(`1.${i + 1}`, "x".repeat(UNIT_SUMMARY_HARD_MAX_AGGREGATE_INPUT_CHARS))
    );
    const generateText = jest.fn();
    await expect(
      runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)))
    ).rejects.toThrow(/estimated input \d+ characters, limit/);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("selects rolling mode above the mode-switch threshold (sequential prior-knowledge calls)", async () => {
    const problems = Array.from(
      {length: UNIT_SUMMARY_MODE_SWITCH_PROBLEM_COUNT + 1}, (_, i) => problem(`1.${i + 1}`)
    );
    let inFlight = 0;
    let sawOverlap = false;
    const generateText = jest.fn().mockImplementation(async ({instructions}: GenerateTextParams) => {
      const isPriorKnowledge = instructions.toLowerCase().includes("prior") || instructions.includes("cumulative");
      if (isPriorKnowledge) {
        inFlight++;
        if (inFlight > 1) sawOverlap = true;
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight--;
      }
      return "response";
    });
    await runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)));
    expect(sawOverlap).toBe(false);
  });

  it("selects prefix mode at and below the mode-switch threshold (concurrent prior-knowledge calls " +
     "possible)", async () => {
    const problems = Array.from(
      {length: UNIT_SUMMARY_MODE_SWITCH_PROBLEM_COUNT}, (_, i) => problem(`1.${i + 1}`)
    );
    let maxInFlight = 0;
    let inFlight = 0;
    const generateText = jest.fn().mockImplementation(async ({instructions}: GenerateTextParams) => {
      const isPriorKnowledge = instructions.includes("BEFORE the student's current problem");
      if (isPriorKnowledge) {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
      }
      return "response";
    });
    await runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)));
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("rejects with a validation error rather than a broken result if the assembler ever produces " +
     "a manifest that disagrees with its own problem list (defensive backstop)", async () => {
    const problems = [problem("1.1"), problem("1.2")];
    const broken = assembledUnit(problems);
    broken.sourceManifest = [broken.sourceManifest[0], broken.sourceManifest[0]]; // duplicated ordinal
    const generateText = jest.fn().mockResolvedValue("response");
    await expect(
      runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, broken))
    ).rejects.toThrow(/failed validation/);
  });

  it("fails with a clean error, not a hang, once the overall deadline elapses", async () => {
    jest.useFakeTimers();
    try {
      const problems = [problem("1.1")];
      const generateText = jest.fn().mockImplementation(() => new Promise(() => {/* never resolves */}));
      const resultPromise = runUnitSummaryGeneration(
        "branch", "unit", baseDeps(generateText, assembledUnit(problems))
      );
      const assertion = expect(resultPromise).rejects.toThrow(/exceeded the .* deadline/);
      await jest.advanceTimersByTimeAsync(UNIT_SUMMARY_OVERALL_DEADLINE_MS);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it("propagates a digest failure without generating prior knowledge or the overview", async () => {
    const problems = [problem("1.1"), problem("1.2")];
    const generateText = jest.fn().mockRejectedValue(new Error("openai 500"));
    await expect(
      runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)))
    ).rejects.toThrow(/digest failed/);
  });
});
