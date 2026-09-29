import {
  UNIT_SUMMARY_APPROACH_GUIDANCE_MAX_CHARS, UNIT_SUMMARY_PROBLEM_APPROACHES,
} from "../../../shared/unit-summary-types";
import {AssembledProblem} from "./assemble-unit";
import {UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS} from "./unit-summary-config";
import {generateProblemApproaches, parseApproachAnswer} from "./unit-summary-approach";
import {InternalServerError, RateLimitError} from "openai";
import {GenerateTextParams, UnitSummaryOpenAIClient} from "./unit-summary-openai";

jest.mock("./unit-summary-config", () => ({
  ...jest.requireActual("./unit-summary-config"),
  // The real backoff would make the transport-failure test wait ten seconds.
  UNIT_SUMMARY_RETRY_BACKOFF_MS: [1, 1],
}));

function problem(ordinal: string, markdown = `content ${ordinal}`, problemHash = `hash-${ordinal}`): AssembledProblem {
  return {ordinal, title: `Problem ${ordinal}`, markdown, problemHash};
}

function fakeClient(generateText: jest.Mock): UnitSummaryOpenAIClient {
  return {generateText};
}

function calls(generateText: jest.Mock): GenerateTextParams[] {
  return generateText.mock.calls.map(([params]: [GenerateTextParams]) => params);
}

function run(problems: AssembledProblem[], digests: string[], generateText: jest.Mock) {
  return generateProblemApproaches(problems, digests, {client: fakeClient(generateText), model: "digest-model"});
}

const answer = (approach: string, guidance = "Some guidance.") => `APPROACH: ${approach}\nGUIDANCE: ${guidance}`;

describe("parseApproachAnswer", () => {
  it.each(UNIT_SUMMARY_PROBLEM_APPROACHES)("reads the label %s", (approach) => {
    expect(parseApproachAnswer(answer(approach))).toEqual({approach, guidance: "Some guidance."});
  });

  it("accepts the casing and spacing a model varies on its own", () => {
    expect(parseApproachAnswer("\n\napproach:   Convergent  \nguidance:   Keep going.  \n"))
      .toEqual({approach: "convergent", guidance: "Keep going."});
  });

  it("keeps guidance that runs onto more than one line", () => {
    expect(parseApproachAnswer("APPROACH: mixed\nGUIDANCE: First line.\nSecond line.")?.guidance)
      .toBe("First line.\nSecond line.");
  });

  it("reads a label with no guidance at all as a blank guidance, not a failure", () => {
    expect(parseApproachAnswer("APPROACH: divergent")).toEqual({approach: "divergent", guidance: ""});
    expect(parseApproachAnswer("APPROACH: divergent\nGUIDANCE:")).toEqual({approach: "divergent", guidance: ""});
  });

  // A model dresses up short answers on its own. Every one of these used to fail, which cost two
  // attempts and then recorded a perfectly clear problem as "unclear".
  it.each([
    ["bold around the marker and colon", "**APPROACH:** convergent"],
    ["bold around the marker only", "**APPROACH**: convergent"],
    ["a trailing full stop", "APPROACH: convergent."],
    ["quotes around the label", "APPROACH: \"convergent\""],
    ["backticks around the label", "APPROACH: `convergent`"],
    ["a list bullet", "- APPROACH: convergent"],
    ["a heading marker", "## APPROACH: convergent"],
    ["all of them at once", "- **APPROACH:** \"Convergent\"."],
  ])("reads a label with %s", (_name, text) => {
    expect(parseApproachAnswer(text)?.approach).toBe("convergent");
  });

  it("reads a decorated guidance marker too, without eating the sentence's full stop", () => {
    expect(parseApproachAnswer("**APPROACH:** mixed\n**GUIDANCE:** Pick one design."))
      .toEqual({approach: "mixed", guidance: "Pick one design."});
  });

  it("does not mistake a second line of guidance for part of the label", () => {
    expect(parseApproachAnswer("APPROACH: divergent\nTry many things.")?.approach).toBe("divergent");
  });

  // A model can put the two markers the other way round. Without a cut, the guidance capture runs
  // to the end of the answer and swallows the APPROACH line, which then reaches every consumer.
  it("does not let the guidance swallow an APPROACH line that follows it", () => {
    expect(parseApproachAnswer("GUIDANCE: Pick one design and improve it.\nAPPROACH: convergent"))
      .toEqual({approach: "convergent", guidance: "Pick one design and improve it."});
  });

  it("keeps multi-line guidance that comes before the label", () => {
    expect(parseApproachAnswer("GUIDANCE: First line.\nSecond line.\nAPPROACH: mixed"))
      .toEqual({approach: "mixed", guidance: "First line.\nSecond line."});
  });

  // The cut looks for a marker at the start of a line, so ordinary prose survives.
  it("leaves guidance alone when it merely uses the word approach", () => {
    expect(parseApproachAnswer("APPROACH: divergent\nGUIDANCE: Do not suggest a different approach: keep going.")
      ?.guidance).toBe("Do not suggest a different approach: keep going.");
  });

  it("rejects an unknown label, a missing label, and prose with no format at all", () => {
    expect(parseApproachAnswer("APPROACH: exploratory\nGUIDANCE: x")).toBeUndefined();
    expect(parseApproachAnswer("GUIDANCE: x")).toBeUndefined();
    expect(parseApproachAnswer("I think this problem is convergent.")).toBeUndefined();
  });
});

describe("generateProblemApproaches", () => {
  it("sends each call its own problem's Markdown, and uses the digest model", async () => {
    const problems = [problem("1.1"), problem("1.2")];
    const generateText = jest.fn().mockResolvedValue(answer("divergent"));
    await run(problems, ["digest one", "digest two"], generateText);

    const requests = calls(generateText);
    expect(requests).toHaveLength(2);
    expect(requests.map((r) => r.input).sort()).toEqual(["content 1.1", "content 1.2"]);
    requests.forEach((r) => expect(r.model).toBe("digest-model"));
    // One problem per call, and never another problem's material in it.
    requests.forEach((r) => expect(r.input.match(/content/g)).toHaveLength(1));
  });

  // The digest is the fallback for a problem too long to send whole.
  it("sends the digest instead for a problem over the single-call input budget", async () => {
    const long = problem("1.1", "x".repeat(UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS + 1));
    const short = problem("1.2");
    const generateText = jest.fn().mockResolvedValue(answer("convergent"));
    await run([long, short], ["its digest", "digest two"], generateText);

    expect(calls(generateText).map((r) => r.input).sort()).toEqual(["content 1.2", "its digest"]);
  });

  it("returns one result per problem, in the problems' order", async () => {
    const problems = [problem("1.1"), problem("1.2")];
    const generateText = jest.fn()
      .mockResolvedValueOnce(answer("divergent", "Try many."))
      .mockResolvedValueOnce(answer("convergent", "Pick one."));
    const results = await run(problems, ["d1", "d2"], generateText);
    expect(results).toEqual([
      {approach: "divergent", approachGuidance: "Try many."},
      {approach: "convergent", approachGuidance: "Pick one."},
    ]);
  });

  it("retries an unreadable answer once, and uses the second answer", async () => {
    const generateText = jest.fn()
      .mockResolvedValueOnce("I think it is convergent, really.")
      .mockResolvedValueOnce(answer("convergent", "Pick one."));
    const results = await run([problem("1.1")], ["d1"], generateText);
    expect(results).toEqual([{approach: "convergent", approachGuidance: "Pick one."}]);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("falls back to unclear after exactly two unreadable answers, and asks no third time", async () => {
    const generateText = jest.fn().mockResolvedValue("no format here at all");
    const results = await run([problem("1.1")], ["d1"], generateText);
    expect(results).toEqual([{approach: "unclear"}]);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  // An outage is not a judgment that the problem is unclear, so it must not be recorded as one.
  it("fails the step with the problem's ordinal when the transport gives up", async () => {
    const generateText = jest.fn().mockRejectedValue(new Error("openai 500"));
    await expect(run([problem("2.3")], ["d1"], generateText))
      .rejects.toThrow(/Problem 2\.3: approach failed: .*openai 500/);
  });

  it("keeps a label whose guidance came back blank, without calling fitToLength", async () => {
    const generateText = jest.fn().mockResolvedValue("APPROACH: divergent\nGUIDANCE:");
    const results = await run([problem("1.1")], ["d1"], generateText);
    expect(results).toEqual([{approach: "divergent"}]);
    // One call: the blank guidance is accepted, not retried and not shortened.
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("shortens guidance over the cap, and keeps the label while doing so", async () => {
    const tooLong = "x".repeat(UNIT_SUMMARY_APPROACH_GUIDANCE_MAX_CHARS + 50);
    const generateText = jest.fn()
      .mockResolvedValueOnce(answer("mixed", tooLong))
      .mockResolvedValueOnce("a short guidance");
    const results = await run([problem("1.1")], ["d1"], generateText);
    expect(results).toEqual([{approach: "mixed", approachGuidance: "a short guidance"}]);

    const shorten = calls(generateText)[1];
    expect(shorten.instructions).toMatch(/too long for where it will be used/);
    expect(shorten.instructions).toMatch(/what an assistant should not suggest instead/);
  });

  // Decided item 3: only a network or server failure fails a generation. A shorten call is a
  // model call like any other, so an unusable answer from it must not take the run down with it.
  it("keeps the label and drops the guidance when the shorten call comes back blank", async () => {
    const tooLong = "x".repeat(UNIT_SUMMARY_APPROACH_GUIDANCE_MAX_CHARS + 50);
    const generateText = jest.fn()
      .mockResolvedValueOnce(answer("convergent", tooLong))
      .mockResolvedValueOnce("   ");
    const results = await run([problem("1.1")], ["d1"], generateText);
    expect(results).toEqual([{approach: "convergent"}]);
  });

  it("still fails the step when the shorten call's transport gives up", async () => {
    const tooLong = "x".repeat(UNIT_SUMMARY_APPROACH_GUIDANCE_MAX_CHARS + 50);
    const outage = new InternalServerError(500, {}, "openai is down", new Headers());
    const generateText = jest.fn()
      .mockResolvedValueOnce(answer("convergent", tooLong))
      .mockRejectedValue(outage);
    await expect(run([problem("1.1")], ["d1"], generateText))
      .rejects.toThrow(/Problem 1\.1: approach failed/);
  });

  it("does not swallow a rate-limit failure as a missing guidance", async () => {
    const tooLong = "x".repeat(UNIT_SUMMARY_APPROACH_GUIDANCE_MAX_CHARS + 50);
    const limited = new RateLimitError(429, {}, "slow down", new Headers());
    const generateText = jest.fn()
      .mockResolvedValueOnce(answer("mixed", tooLong))
      .mockRejectedValue(limited);
    await expect(run([problem("1.1")], ["d1"], generateText)).rejects.toThrow(/approach failed/);
  });

  it("makes no call for an empty problem, and records it as unclear", async () => {
    const generateText = jest.fn().mockResolvedValue(answer("divergent"));
    const results = await run([problem("1.1", "   "), problem("1.2")], ["", "d2"], generateText);
    expect(results[0]).toEqual({approach: "unclear"});
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(calls(generateText)[0].input).toBe("content 1.2");
  });

  it("copies the first occurrence's result to a duplicate problem, with no second call", async () => {
    const problems = [
      problem("1.1", "same content", "shared-hash"),
      problem("1.2", "different", "hash-1.2"),
      problem("1.3", "same content", "shared-hash"),
    ];
    const generateText = jest.fn()
      .mockImplementation(({input}: GenerateTextParams) =>
        Promise.resolve(input === "same content" ?
          answer("divergent", "Try many.") :
          answer("convergent", "Pick one.")));
    const results = await run(problems, ["d1", "d2", "d3"], generateText);

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(results[2]).toEqual(results[0]);
    expect(results[2]).toEqual({approach: "divergent", approachGuidance: "Try many."});
  });
});
