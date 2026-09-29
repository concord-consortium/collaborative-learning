import {AssembledProblem, AssembledUnit} from "./assemble-unit";
import {
  UNIT_SUMMARY_CONCURRENCY_LIMIT, UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS,
  UNIT_SUMMARY_HARD_MAX_AGGREGATE_INPUT_CHARS,
  UNIT_SUMMARY_HARD_MAX_PROBLEMS, UNIT_SUMMARY_MODE_SWITCH_PROBLEM_COUNT,
  UNIT_SUMMARY_OVERALL_DEADLINE_MS,
} from "./unit-summary-config";
import {GenerateUnitSummaryDeps, runUnitSummaryGeneration} from "./unit-summary-generate";
import {GenerateTextParams, UnitSummaryOpenAIClient} from "./unit-summary-openai";

// Matches the approach step by the reply format it demands, which is unique to that prompt and
// survives a rewording of it.
function isApproachPrompt(params: GenerateTextParams): boolean {
  return params.instructions.includes("APPROACH:");
}

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

  it("writes each problem's approach and guidance onto its entry", async () => {
    const problems = [problem("1.1"), problem("1.2")];
    const generateText = jest.fn(async (params: GenerateTextParams) =>
      isApproachPrompt(params) ?
        "APPROACH: convergent\nGUIDANCE: Improve one design." :
        "a short response");
    const summary = await runUnitSummaryGeneration(
      "branch", "unit", baseDeps(generateText, assembledUnit(problems))
    );
    summary.entries.forEach((entry) => {
      expect(entry.approach).toBe("convergent");
      expect(entry.approachGuidance).toBe("Improve one design.");
    });
  });

  // Not an empty string: validation rejects guidance without a label, and the slice reads absent
  // as "say nothing about approach".
  it("leaves approachGuidance off the entry when the model gave a label and no guidance", async () => {
    const problems = [problem("1.1"), problem("1.2")];
    const generateText = jest.fn(async (params: GenerateTextParams) =>
      isApproachPrompt(params) ? "APPROACH: divergent\nGUIDANCE:" : "a short response");
    const summary = await runUnitSummaryGeneration(
      "branch", "unit", baseDeps(generateText, assembledUnit(problems))
    );
    summary.entries.forEach((entry) => {
      expect(entry.approach).toBe("divergent");
      expect(entry).not.toHaveProperty("approachGuidance");
    });
  });

  // Both steps turn on fitsOneCall. If they disagreed, the approach call for a problem the digest
  // step had split would exceed a single call's input budget.
  it("gives the approach step the combined digest for a problem the digest step had to split", async () => {
    const long = problem("1.1", "p ".repeat(UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS));
    const short = problem("1.2", "short problem text");
    const generateText = jest.fn(async (params: GenerateTextParams) =>
      params.instructions.includes("partial digests") ? "THE COMBINED DIGEST" : "a short response");
    await runUnitSummaryGeneration(
      "branch", "unit", baseDeps(generateText, assembledUnit([long, short]))
    );

    const approachInputs = generateText.mock.calls
      .map(([p]: [GenerateTextParams]) => p)
      .filter(isApproachPrompt)
      .map((p) => p.input);
    // The split problem is classified from its combined digest; the short one from its own text.
    expect(approachInputs).toContain("THE COMBINED DIGEST");
    expect(approachInputs).toContain("short problem text");
    approachInputs.forEach((input) => {
      expect(input.length).toBeLessThanOrEqual(UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS);
    });
  });

  it("uses the given digest and summary models for the right calls", async () => {
    const problems = [problem("1.1"), problem("1.2")];
    const generateText = jest.fn().mockResolvedValue("response");
    await runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)));

    const calls: GenerateTextParams[] = generateText.mock.calls.map(([params]: [GenerateTextParams]) => params);
    // Approach is a per-problem step, so it uses the digest model rather than the summary one.
    const isPerProblem = (c: GenerateTextParams) =>
      c.instructions.includes("content of ONE problem") || isApproachPrompt(c);
    expect(new Set(calls.filter(isPerProblem).map((c) => c.model))).toEqual(new Set(["digest-model"]));
    expect(new Set(calls.filter((c) => !isPerProblem(c)).map((c) => c.model)))
      .toEqual(new Set(["summary-model"]));
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

// The approach step runs beside prior knowledge and the overview on one shared budget. Two pools
// of UNIT_SUMMARY_CONCURRENCY_LIMIT would put twice that many calls in flight, which is what these
// tests exist to prevent.
describe("scheduling after the digest step", () => {
  const isDigestCall = (c: GenerateTextParams) => c.instructions.includes("content of ONE problem");
  const isApproachCall = isApproachPrompt;

  // Each call takes a tick of real time, so overlap is possible and can be observed.
  function instrumentedClient(delayMs = 1) {
    let inFlight = 0;
    // `rounds` is the longest chain of calls that had to wait for each other: a call starting
    // after another ended is at least one round deeper. It measures the schedule's shape rather
    // than this machine's speed, so a busy build host does not make it flaky.
    let deepestFinished = 0;
    const observed = {peakInFlight: 0, rounds: 0, order: [] as string[]};
    const generateText = jest.fn(async (params: GenerateTextParams) => {
      const kind = isDigestCall(params) ? "digest" : isApproachCall(params) ? "approach" : "summary";
      inFlight++;
      const round = deepestFinished + 1;
      observed.peakInFlight = Math.max(observed.peakInFlight, inFlight);
      observed.rounds = Math.max(observed.rounds, round);
      observed.order.push(`start:${kind}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      inFlight--;
      deepestFinished = Math.max(deepestFinished, round);
      observed.order.push(`end:${kind}`);
      return "a short response";
    });
    return {generateText, observed};
  }

  it("never has more calls in flight than the shared limit, with enough problems to exceed it", async () => {
    const problems = Array.from({length: UNIT_SUMMARY_CONCURRENCY_LIMIT * 3}, (_, i) => problem(`1.${i + 1}`));
    const {generateText, observed} = instrumentedClient();
    await runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)));
    expect(observed.peakInFlight).toBeLessThanOrEqual(UNIT_SUMMARY_CONCURRENCY_LIMIT);
  });

  it("starts no approach call until every digest has finished", async () => {
    const problems = Array.from({length: UNIT_SUMMARY_CONCURRENCY_LIMIT * 2}, (_, i) => problem(`1.${i + 1}`));
    const {generateText, observed} = instrumentedClient();
    await runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)));

    const lastDigestEnd = observed.order.lastIndexOf("end:digest");
    const firstApproachStart = observed.order.indexOf("start:approach");
    expect(firstApproachStart).toBeGreaterThan(lastDigestEnd);
  });

  it("runs the approach step beside the summary steps rather than after them", async () => {
    const problems = Array.from({length: UNIT_SUMMARY_CONCURRENCY_LIMIT * 2}, (_, i) => problem(`1.${i + 1}`));
    const {generateText, observed} = instrumentedClient();
    await runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)));

    // Some summary call starts before the last approach call ends: the two overlap.
    const lastApproachEnd = observed.order.lastIndexOf("end:approach");
    const firstSummaryStart = observed.order.indexOf("start:summary");
    expect(firstSummaryStart).toBeLessThan(lastApproachEnd);
  });

  // Rolling mode is the slowest shape the pipeline supports and the part closest to the deadline.
  // What a round costs in real seconds is not tested here, since a fake client cannot know it: if
  // real calls turn out slower, this assumption is what is wrong, not the schedule.
  const ASSUMED_CALL_MS = 2_000;

  it("keeps a full rolling-mode unit within the deadline at an assumed call time", async () => {
    const problems = Array.from({length: UNIT_SUMMARY_HARD_MAX_PROBLEMS}, (_, i) => problem(`1.${i + 1}`));
    expect(problems.length).toBeGreaterThan(UNIT_SUMMARY_MODE_SWITCH_PROBLEM_COUNT);

    const {generateText, observed} = instrumentedClient(2);
    await runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)));

    expect(observed.peakInFlight).toBeLessThanOrEqual(UNIT_SUMMARY_CONCURRENCY_LIMIT);
    expect(observed.rounds * ASSUMED_CALL_MS).toBeLessThan(UNIT_SUMMARY_OVERALL_DEADLINE_MS);
  });

  // The reason the approach step runs beside the summary steps rather than after them: the
  // rolling prior-knowledge chain sets the depth, and approach calls fill the slots it leaves
  // idle.
  it("adds almost no rounds for the approach step's calls", async () => {
    const problems = Array.from({length: UNIT_SUMMARY_HARD_MAX_PROBLEMS}, (_, i) => problem(`1.${i + 1}`));
    const {generateText, observed} = instrumentedClient(2);
    await runUnitSummaryGeneration("branch", "unit", baseDeps(generateText, assembledUnit(problems)));

    // Digest rounds, then one prior-knowledge call per problem after the first, then the overview.
    const digestRounds = Math.ceil(problems.length / UNIT_SUMMARY_CONCURRENCY_LIMIT);
    const withoutApproach = digestRounds + (problems.length - 1) + 1;
    expect(observed.rounds).toBeLessThanOrEqual(withoutApproach + 2);
  });
});
