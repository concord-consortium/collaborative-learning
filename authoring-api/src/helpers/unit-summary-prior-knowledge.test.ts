import {UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS} from "../../../shared/unit-summary-types";
import {AssembledProblem} from "./assemble-unit";
import {generatePriorKnowledge} from "./unit-summary-prior-knowledge";
import {GenerateTextParams, UnitSummaryOpenAIClient} from "./unit-summary-openai";

function problem(ordinal: string, markdown: string): AssembledProblem {
  return {ordinal, title: `Problem ${ordinal}`, markdown, problemHash: "hash"};
}

function fakeClient(generateText: jest.Mock): UnitSummaryOpenAIClient {
  return {generateText};
}

function calls(generateText: jest.Mock): GenerateTextParams[] {
  return generateText.mock.calls.map(([params]: [GenerateTextParams]) => params);
}

const problems = [
  problem("1.1", "content one"),
  problem("1.2", "content two"),
  problem("1.3", "content three"),
];
const digests = ["digest one", "digest two", "digest three"];

describe("generatePriorKnowledge", () => {
  it("returns an empty priorKnowledge for entry 0, with no model call for it", async () => {
    const generateText = jest.fn().mockResolvedValue("some prior knowledge");
    const [entryZero] = await generatePriorKnowledge(
      problems, digests, {client: fakeClient(generateText), model: "m", mode: "prefix"}
    );
    expect(entryZero).toBe("");
  });

  it("returns an array the same length as the problem list", async () => {
    const generateText = jest.fn().mockResolvedValue("pk");
    const result = await generatePriorKnowledge(
      problems, digests, {client: fakeClient(generateText), model: "m", mode: "prefix"}
    );
    expect(result).toHaveLength(problems.length);
  });

  it("returns just an empty entry 0 for a single-problem unit, with no model calls", async () => {
    const generateText = jest.fn();
    const result = await generatePriorKnowledge(
      [problem("1.1", "content")], ["digest"], {client: fakeClient(generateText), model: "m", mode: "prefix"}
    );
    expect(result).toEqual([""]);
    expect(generateText).not.toHaveBeenCalled();
  });

  describe("prefix mode", () => {
    it("sends call i only digests 0..i-1, never digest i or later", async () => {
      const generateText = jest.fn().mockResolvedValue("pk");
      await generatePriorKnowledge(
        problems, digests, {client: fakeClient(generateText), model: "m", mode: "prefix"}
      );

      // Two calls: entries 1 and 2 (entry 0 needs none).
      expect(generateText).toHaveBeenCalledTimes(2);
      const requests = calls(generateText);

      const forEntry1 = requests.find((r) => r.input.includes("digest one") && !r.input.includes("digest two"));
      expect(forEntry1).toBeDefined();

      const forEntry2 = requests.find((r) => r.input.includes("digest one") && r.input.includes("digest two"));
      expect(forEntry2).toBeDefined();
      expect(forEntry2!.input).not.toContain("digest three");
    });

    it("runs prefix-mode calls concurrently (does not wait for entry i before starting entry i+1)", async () => {
      const started: number[] = [];
      const generateText = jest.fn().mockImplementation(async ({input}: GenerateTextParams) => {
        started.push(input.length);
        await Promise.resolve();
        return "pk";
      });
      const manyProblems = Array.from({length: 5}, (_, i) => problem(`1.${i + 1}`, `content ${i}`));
      const manyDigests = manyProblems.map((_, i) => `digest ${i}`);
      await generatePriorKnowledge(
        manyProblems, manyDigests, {client: fakeClient(generateText), model: "m", mode: "prefix"}
      );
      expect(generateText).toHaveBeenCalledTimes(4);
    });
  });

  describe("rolling mode", () => {
    it("sends call i only priorKnowledge(i-1) and digest(i-1)", async () => {
      const generateText = jest.fn()
        .mockResolvedValueOnce("cumulative after problem one")
        .mockResolvedValueOnce("cumulative after problem two");

      await generatePriorKnowledge(
        problems, digests, {client: fakeClient(generateText), model: "m", mode: "rolling"}
      );

      expect(generateText).toHaveBeenCalledTimes(2);
      const requests = calls(generateText);

      // Call for entry 1: only digest one (priorKnowledge(0) is "").
      expect(requests[0].input).toBe("digest one");

      // Call for entry 2: the previous call's own output plus digest two, never digest three.
      expect(requests[1].input).toContain("cumulative after problem one");
      expect(requests[1].input).toContain("digest two");
      expect(requests[1].input).not.toContain("digest three");
    });

    it("runs sequentially: does not start entry i+1 before entry i resolves", async () => {
      let inFlight = 0;
      let sawOverlap = false;
      const generateText = jest.fn().mockImplementation(async () => {
        inFlight++;
        if (inFlight > 1) sawOverlap = true;
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return "pk";
      });
      await generatePriorKnowledge(
        problems, digests, {client: fakeClient(generateText), model: "m", mode: "rolling"}
      );
      expect(sawOverlap).toBe(false);
    });
  });

  it("fails the whole run when one call fails, naming the problem", async () => {
    const generateText = jest.fn()
      .mockResolvedValueOnce("pk one")
      .mockRejectedValueOnce(new Error("openai 500"));
    await expect(
      generatePriorKnowledge(problems, digests, {client: fakeClient(generateText), model: "m", mode: "rolling"})
    ).rejects.toThrow(/Problem 1\.3.*priorKnowledge failed.*openai 500/);
  });

  it("asks the model to shorten an over-length priorKnowledge once, and succeeds if that fits", async () => {
    const onlyOne = [problem("1.1", "content one"), problem("1.2", "content two")];
    const generateText = jest.fn()
      .mockResolvedValueOnce("x".repeat(UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS + 1))
      .mockResolvedValueOnce("shorter prior knowledge");
    const [, priorKnowledge] = await generatePriorKnowledge(
      onlyOne, ["digest one"], {client: fakeClient(generateText), model: "m", mode: "prefix"}
    );
    expect(priorKnowledge).toBe("shorter prior knowledge");
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("truncates priorKnowledge still over length after asking the model to shorten it", async () => {
    const onlyOne = [problem("1.1", "content one"), problem("1.2", "content two")];
    const generateText = jest.fn().mockResolvedValue("x".repeat(UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS + 1));
    const [, priorKnowledge] = await generatePriorKnowledge(
      onlyOne, ["digest one"], {client: fakeClient(generateText), model: "m", mode: "prefix"}
    );
    expect(priorKnowledge.length).toBeLessThanOrEqual(UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("fails on an empty priorKnowledge without retrying", async () => {
    const generateText = jest.fn().mockResolvedValue("  ");
    await expect(
      generatePriorKnowledge(problems, digests, {client: fakeClient(generateText), model: "m", mode: "prefix"})
    ).rejects.toThrow(/empty priorKnowledge/);
  });
});
