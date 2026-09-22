import {UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS} from "../../../shared/unit-summary-types";
import {AssembledProblem} from "./assemble-unit";
import {UNIT_SUMMARY_CONCURRENCY_LIMIT, UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS} from "./unit-summary-config";
import {chunkMarkdown, generateProblemDigests} from "./unit-summary-digest";
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

describe("generateProblemDigests", () => {
  it("sends digest call i only problem i's own material, and no other problem's", async () => {
    const problems = [
      problem("1.1", "Problem one content"),
      problem("1.2", "Problem two content"),
      problem("1.3", "Problem three content"),
    ];
    const generateText = jest.fn().mockResolvedValue("a short digest");
    await generateProblemDigests(problems, {client: fakeClient(generateText), model: "test-model"});

    expect(generateText).toHaveBeenCalledTimes(3);
    const requests = calls(generateText);
    problems.forEach((p) => {
      const own = requests.find((c) => c.input.includes(p.markdown));
      expect(own).toBeDefined();
      problems.forEach((other) => {
        if (other !== p) {
          expect(own!.input).not.toContain(other.markdown);
        }
      });
    });
  });

  it("passes the given model through to every call", async () => {
    const generateText = jest.fn().mockResolvedValue("digest");
    await generateProblemDigests(
      [problem("1.1", "content")], {client: fakeClient(generateText), model: "my-model"}
    );
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({model: "my-model"}));
  });

  it("does not chunk a problem within the input budget", async () => {
    const generateText = jest.fn().mockResolvedValue("digest");
    await generateProblemDigests(
      [problem("1.1", "short content")], {client: fakeClient(generateText), model: "m"}
    );
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("chunks a problem whose Markdown exceeds the per-problem budget, and combines the chunk digests", async () => {
    const paragraph = "x".repeat(Math.floor(UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS / 4));
    const bigMarkdown = Array.from({length: 5}, (_, i) => `Paragraph ${i}: ${paragraph}`).join("\n\n");
    expect(bigMarkdown.length).toBeGreaterThan(UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS);

    const generateText = jest.fn().mockResolvedValue("the combined digest");
    const [digest] = await generateProblemDigests(
      [problem("1.1", bigMarkdown)], {client: fakeClient(generateText), model: "test-model"}
    );

    // At least two chunk calls plus one combine call.
    expect(generateText.mock.calls.length).toBeGreaterThanOrEqual(3);
    calls(generateText).forEach((params) => {
      expect(params.input.length).toBeLessThanOrEqual(UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS);
    });
    expect(digest).toBe("the combined digest");
  });

  it("never has more calls in flight than UNIT_SUMMARY_CONCURRENCY_LIMIT, even when several " +
     "concurrently-processed problems all need chunking", async () => {
    const paragraph = "x".repeat(Math.floor(UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS / 4));
    const bigMarkdown = Array.from({length: 5}, (_, i) => `Paragraph ${i}: ${paragraph}`).join("\n\n");
    // More oversized problems than the concurrency limit, so the outer pool keeps every worker
    // busy with a chunked problem at once -- if chunk calls were not sequential, this is exactly
    // the situation that would push the total in flight past the limit.
    const problems = Array.from(
      {length: UNIT_SUMMARY_CONCURRENCY_LIMIT + 2}, (_, i) => problem(`1.${i}`, bigMarkdown)
    );

    let inFlight = 0;
    let maxInFlight = 0;
    const generateText = jest.fn().mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return "a digest";
    });

    await generateProblemDigests(problems, {client: fakeClient(generateText), model: "m"});
    expect(maxInFlight).toBeLessThanOrEqual(UNIT_SUMMARY_CONCURRENCY_LIMIT);
  });

  it("fails the whole run when one problem's digest fails", async () => {
    const problems = [problem("1.1", "content one"), problem("1.2", "content two")];
    const generateText = jest.fn().mockImplementation(async ({input}: GenerateTextParams) => {
      if (input.includes("content two")) throw new Error("openai 500");
      return "a digest";
    });
    await expect(
      generateProblemDigests(problems, {client: fakeClient(generateText), model: "m"})
    ).rejects.toThrow(/Problem 1\.2.*digest failed.*openai 500/);
  });

  it("fails on an over-length digest without retrying", async () => {
    const generateText = jest.fn().mockResolvedValue("x".repeat(UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS + 1));
    await expect(
      generateProblemDigests([problem("1.1", "content")], {client: fakeClient(generateText), model: "m"})
    ).rejects.toThrow(/exceeds/);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("fails on an empty digest without retrying", async () => {
    const generateText = jest.fn().mockResolvedValue("   ");
    await expect(
      generateProblemDigests([problem("1.1", "content")], {client: fakeClient(generateText), model: "m"})
    ).rejects.toThrow(/empty digest/);
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});

describe("chunkMarkdown", () => {
  it("keeps a chunk boundary between paragraphs where possible", () => {
    const chunks = chunkMarkdown(`${"A".repeat(10)}\n\n${"B".repeat(10)}`, 15);
    expect(chunks).toEqual(["A".repeat(10), "B".repeat(10)]);
  });

  it("packs consecutive paragraphs into one chunk while they fit", () => {
    const chunks = chunkMarkdown(`${"A".repeat(5)}\n\n${"B".repeat(5)}\n\n${"C".repeat(5)}`, 12);
    expect(chunks).toEqual([`${"A".repeat(5)}\n\n${"B".repeat(5)}`, "C".repeat(5)]);
  });

  it("hard-splits a single paragraph longer than the budget on its own", () => {
    const chunks = chunkMarkdown("A".repeat(25), 10);
    expect(chunks.every((c) => c.length <= 10)).toBe(true);
    expect(chunks.join("")).toBe("A".repeat(25));
  });
});
