import {UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS} from "../../../shared/unit-summary-types";
import {AssembledProblem} from "./assemble-unit";
import {UNIT_SUMMARY_CONCURRENCY_LIMIT, UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS} from "./unit-summary-config";
import {
  chunkMarkdown, duplicateProblemDigest, EMPTY_PROBLEM_DIGEST, generateProblemDigests,
} from "./unit-summary-digest";
import {GenerateTextParams, UnitSummaryOpenAIClient} from "./unit-summary-openai";

// problemHash defaults to one unique per ordinal (as real problems always are) rather than a
// shared literal -- otherwise every multi-problem test here would accidentally make every problem
// after the first look like a duplicate of it, once generateProblemDigests started caring about
// problemHash at all.
function problem(ordinal: string, markdown: string, problemHash = `hash-${ordinal}`): AssembledProblem {
  return {ordinal, title: `Problem ${ordinal}`, markdown, problemHash};
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

  it("asks the model to shorten an over-length digest once, and succeeds if that fits", async () => {
    const generateText = jest.fn()
      .mockResolvedValueOnce("x".repeat(UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS + 1))
      .mockResolvedValueOnce("a shorter digest");
    const [digest] = await generateProblemDigests(
      [problem("1.1", "content")], {client: fakeClient(generateText), model: "m"}
    );
    expect(digest).toBe("a shorter digest");
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("truncates a digest still over length after asking the model to shorten it", async () => {
    const generateText = jest.fn().mockResolvedValue("x".repeat(UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS + 1));
    const [digest] = await generateProblemDigests(
      [problem("1.1", "content")], {client: fakeClient(generateText), model: "m"}
    );
    expect(digest.length).toBeLessThanOrEqual(UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("fails on an empty digest without retrying", async () => {
    const generateText = jest.fn().mockResolvedValue("   ");
    await expect(
      generateProblemDigests([problem("1.1", "content")], {client: fakeClient(generateText), model: "m"})
    ).rejects.toThrow(/empty digest/);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("uses a fixed placeholder for a problem with no extractable content, without calling the model", async () => {
    const generateText = jest.fn().mockResolvedValue("digest");
    const [digest] = await generateProblemDigests(
      [problem("1.1", "")], {client: fakeClient(generateText), model: "m"}
    );
    expect(digest).toBe(EMPTY_PROBLEM_DIGEST);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("treats whitespace-only content the same as empty", async () => {
    const generateText = jest.fn().mockResolvedValue("digest");
    const [digest] = await generateProblemDigests(
      [problem("1.1", "   \n\n  ")], {client: fakeClient(generateText), model: "m"}
    );
    expect(digest).toBe(EMPTY_PROBLEM_DIGEST);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("still digests other problems normally when one has no content", async () => {
    const problems = [problem("1.1", ""), problem("1.2", "real content")];
    const generateText = jest.fn().mockResolvedValue("a real digest");
    const digests = await generateProblemDigests(problems, {client: fakeClient(generateText), model: "m"});
    expect(digests).toEqual([EMPTY_PROBLEM_DIGEST, "a real digest"]);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("points a byte-identical duplicate problem at the first occurrence, without calling the model", async () => {
    const problems = [
      problem("1.2", "shared content", "same-hash"),
      problem("1.5", "shared content", "same-hash"),
    ];
    const generateText = jest.fn().mockResolvedValue("a real digest");
    const digests = await generateProblemDigests(problems, {client: fakeClient(generateText), model: "m"});
    expect(digests).toEqual(["a real digest", duplicateProblemDigest("1.2")]);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("points every duplicate at the first occurrence, not at the previous duplicate in the chain", async () => {
    const problems = [
      problem("1.2", "shared content", "same-hash"),
      problem("1.5", "shared content", "same-hash"),
      problem("1.6", "shared content", "same-hash"),
    ];
    const generateText = jest.fn().mockResolvedValue("a real digest");
    const digests = await generateProblemDigests(problems, {client: fakeClient(generateText), model: "m"});
    expect(digests).toEqual(["a real digest", duplicateProblemDigest("1.2"), duplicateProblemDigest("1.2")]);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("gives two independently-empty problems their own EMPTY_PROBLEM_DIGEST, not 'same content as'", async () => {
    // Two empty problems can share a problemHash (both hash the same empty string), which would
    // make findDuplicates record the second as a duplicate of the first. digestOneProblem checks
    // for blank content before it ever looks at that, though, so each still gets its own more
    // specific EMPTY_PROBLEM_DIGEST rather than "(same content as problem 1.1)".
    const problems = [problem("1.1", "", "empty-hash"), problem("1.2", "", "empty-hash")];
    const generateText = jest.fn().mockResolvedValue("digest");
    const digests = await generateProblemDigests(problems, {client: fakeClient(generateText), model: "m"});
    expect(digests).toEqual([EMPTY_PROBLEM_DIGEST, EMPTY_PROBLEM_DIGEST]);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("digests a later, differently-hashed problem normally after an empty one", async () => {
    const problems = [problem("1.1", "", "hash-a"), problem("1.2", "real content", "hash-b")];
    const generateText = jest.fn().mockResolvedValue("a real digest");
    const digests = await generateProblemDigests(problems, {client: fakeClient(generateText), model: "m"});
    expect(digests).toEqual([EMPTY_PROBLEM_DIGEST, "a real digest"]);
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});

// A long problem is digested chunk by chunk and then combined, so a section asking students to
// try many things and one asking them to build a single thing can land in different chunks. The
// approach step reads only the combined digest, so each section's one-versus-many statement has
// to survive both stages. A fake client checks the wiring, not whether a real model obeys.
describe("a chunked problem whose sections ask for different things", () => {
  // Each part fits a chunk on its own, and the two together do not, so the split falls between
  // them -- one section per chunk, which is the case the combine step has to survive.
  const filler = "x".repeat(Math.floor(UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS * 0.6));
  const divergentPart = `Section: Initial Challenge. Sketch as many gripper designs as you can. ${filler}`;
  const convergentPart = `Section: What If. Pick one design and improve it. ${filler}`;
  const mixedMarkdown = `${divergentPart}\n\n${convergentPart}`;

  function runDigest(generateText: jest.Mock) {
    return generateProblemDigests(
      [problem("1.1", mixedMarkdown)], {client: fakeClient(generateText), model: "test-model"}
    );
  }

  it("digests each chunk separately and feeds every chunk digest to one combine call", async () => {
    const generateText = jest.fn()
      .mockResolvedValueOnce("chunk digest: many designs")
      .mockResolvedValueOnce("chunk digest: one design")
      .mockResolvedValueOnce("combined digest");
    const [digest] = await runDigest(generateText);

    const requests = calls(generateText);
    expect(requests).toHaveLength(3);
    // The two chunks are split between calls; neither sees the whole problem.
    expect(requests[0].input).toContain("Sketch as many gripper designs");
    expect(requests[0].input).not.toContain("Pick one design");
    expect(requests[1].input).toContain("Pick one design");
    expect(requests[1].input).not.toContain("Sketch as many gripper designs");
    // The combine call sees both chunk digests and nothing else.
    expect(requests[2].input).toContain("chunk digest: many designs");
    expect(requests[2].input).toContain("chunk digest: one design");
    expect(digest).toBe("combined digest");
  });

  it("tells each digest call to record whether a section asks for one thing or many", async () => {
    const generateText = jest.fn().mockResolvedValue("a digest");
    await runDigest(generateText);
    const [firstChunk] = calls(generateText);
    expect(firstChunk.instructions).toMatch(/several DIFFERENT ideas, designs, methods or versions/);
    // The distinction that matters: a list of steps or questions is not several ideas.
    expect(firstChunk.instructions).toMatch(/counts as a single idea, not as several/);
    expect(firstChunk.instructions).toMatch(/asks students for nothing, say that it sets no task/);
  });

  it("tells the combine call to keep each section's one-versus-many statement", async () => {
    const generateText = jest.fn().mockResolvedValue("a digest");
    await runDigest(generateText);
    const combine = calls(generateText).at(-1)!;
    expect(combine.instructions).toMatch(/Keep every section named in the parts/);
    expect(combine.instructions).toMatch(/several different ideas or versions of the same thing/);
    expect(combine.instructions).toMatch(/do not merge sections that ask for different things/);
  });

  // The shorten call rewrites a whole digest with only a character budget to go on unless it is
  // told what to protect.
  it("carries the preserve note into a forced shorten call", async () => {
    const overLong = "y".repeat(UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS + 50);
    const generateText = jest.fn()
      // chunk 1 comes back too long, then its shorten call, then chunk 2 and the combine call.
      .mockResolvedValueOnce(overLong)
      .mockResolvedValueOnce("shortened")
      .mockResolvedValue("a digest");
    await runDigest(generateText);

    const shorten = calls(generateText)[1];
    expect(shorten.instructions).toMatch(/too long for where it will be used/);
    expect(shorten.instructions).toMatch(/Keep every section name/);
    expect(shorten.instructions).toMatch(/several different ideas or versions of the same thing/);
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
