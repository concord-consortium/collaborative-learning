import {fitToLength, generateWithLengthLimit} from "./unit-summary-length-limit";
import {GenerateTextParams, UnitSummaryOpenAIClient} from "./unit-summary-openai";

function fakeClient(generateText: jest.Mock): UnitSummaryOpenAIClient {
  return {generateText};
}

function calls(generateText: jest.Mock): GenerateTextParams[] {
  return generateText.mock.calls.map(([params]: [GenerateTextParams]) => params);
}

const baseOptions = {model: "m", instructions: "do the thing", timeoutMs: 1000, maxChars: 10, fieldName: "widget"};

describe("generateWithLengthLimit", () => {
  it("returns the text as-is when it is within the limit, with one call", async () => {
    const generateText = jest.fn().mockResolvedValue("short");
    const result = await generateWithLengthLimit({client: fakeClient(generateText), input: "in", ...baseOptions});
    expect(result).toBe("short");
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("fails immediately on an empty response, without asking the model to shorten anything", async () => {
    const generateText = jest.fn().mockResolvedValue("   ");
    await expect(
      generateWithLengthLimit({client: fakeClient(generateText), input: "in", ...baseOptions})
    ).rejects.toThrow(/empty widget/);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("asks the model to shorten an over-length response once, and returns the shortened text", async () => {
    const generateText = jest.fn()
      .mockResolvedValueOnce("this is way too long for the limit")
      .mockResolvedValueOnce("short");
    const result = await generateWithLengthLimit({client: fakeClient(generateText), input: "in", ...baseOptions});
    expect(result).toBe("short");
    expect(generateText).toHaveBeenCalledTimes(2);

    const [firstCall, secondCall] = calls(generateText);
    expect(firstCall.input).toBe("in");
    expect(secondCall.input).toContain("this is way too long for the limit");
    expect(secondCall.input).toContain(String(baseOptions.maxChars));
    expect(secondCall.instructions).not.toBe(firstCall.instructions);
  });

  it("truncates at a word boundary if the shortened response is still over the limit", async () => {
    const generateText = jest.fn().mockResolvedValue("this is way too long for the limit");
    const result = await generateWithLengthLimit({
      client: fakeClient(generateText), input: "in", ...baseOptions,
    });
    // "this is wa" (10 chars) has no trailing space, so it backs up to the last full word.
    expect(result).toBe("this is");
    expect(result.length).toBeLessThanOrEqual(baseOptions.maxChars);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("hard-truncates when there is no whitespace to back up to within the limit", async () => {
    const generateText = jest.fn().mockResolvedValue("xxxxxxxxxxxxxxxxxxxx");
    const result = await generateWithLengthLimit({
      client: fakeClient(generateText), input: "in", ...baseOptions,
    });
    expect(result).toBe("xxxxxxxxxx");
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("fails if the shortened response comes back empty", async () => {
    const generateText = jest.fn()
      .mockResolvedValueOnce("this is way too long for the limit")
      .mockResolvedValueOnce("   ");
    await expect(
      generateWithLengthLimit({client: fakeClient(generateText), input: "in", ...baseOptions})
    ).rejects.toThrow(/empty widget/);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("does not ask the model to shorten anything on a non-length failure", async () => {
    const generateText = jest.fn().mockRejectedValue(new Error("openai 500"));
    await expect(
      generateWithLengthLimit({client: fakeClient(generateText), input: "in", ...baseOptions})
    ).rejects.toThrow(/openai 500/);
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});

describe("the preserve note", () => {
  const tooLong = "this is way too long for the limit";

  it("is appended to the shorten instructions when given", async () => {
    const generateText = jest.fn()
      .mockResolvedValueOnce(tooLong)
      .mockResolvedValueOnce("short");
    await generateWithLengthLimit({
      client: fakeClient(generateText), input: "in", ...baseOptions, preserve: "Keep the section names.",
    });
    const [, shortenCall] = calls(generateText);
    expect(shortenCall.instructions).toContain("Keep the section names.");
    expect(shortenCall.instructions).toContain("too long for where it will be used");
  });

  it("is absent from the shorten instructions when not given", async () => {
    const generateText = jest.fn()
      .mockResolvedValueOnce(tooLong)
      .mockResolvedValueOnce("short");
    await generateWithLengthLimit({client: fakeClient(generateText), input: "in", ...baseOptions});
    const [, shortenCall] = calls(generateText);
    expect(shortenCall.instructions).toBe("The text you are given is too long for where it will be used. " +
      "Rewrite it to fit within the given character limit, keeping its meaning and its important " +
      "details. Do not add any information that was not already there.");
  });

  // The note goes on the shorten call only; a within-limit response never reaches one.
  it("never reaches the first call, and costs no call when the text already fits", async () => {
    const generateText = jest.fn().mockResolvedValue("short");
    await generateWithLengthLimit({
      client: fakeClient(generateText), input: "in", ...baseOptions, preserve: "Keep the section names.",
    });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(calls(generateText)[0].instructions).toBe("do the thing");
  });
});

// fitToLength is the second half of generateWithLengthLimit, split out so a step that already has
// its text can shorten it without making the first call again.
describe("fitToLength", () => {
  const fitOptions = {model: "m", timeoutMs: 1000, maxChars: 10, fieldName: "widget"};

  it("returns text within the limit untouched, with no call at all", async () => {
    const generateText = jest.fn();
    expect(await fitToLength("short", {client: fakeClient(generateText), ...fitOptions})).toBe("short");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("trims before measuring, so whitespace alone does not trigger a shorten call", async () => {
    const generateText = jest.fn();
    expect(await fitToLength("  short  ", {client: fakeClient(generateText), ...fitOptions})).toBe("short");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("shortens over-length text in one call", async () => {
    const generateText = jest.fn().mockResolvedValue("short");
    const result = await fitToLength("this is way too long", {client: fakeClient(generateText), ...fitOptions});
    expect(result).toBe("short");
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(calls(generateText)[0].input).toContain("this is way too long");
  });

  it("truncates at a word boundary when the shortened text still overshoots", async () => {
    const generateText = jest.fn().mockResolvedValue("still far too long to fit");
    const result = await fitToLength("this is way too long", {client: fakeClient(generateText), ...fitOptions});
    expect(result).toBe("still far");
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("rejects empty text rather than shortening or truncating it", async () => {
    const generateText = jest.fn();
    await expect(
      fitToLength("   ", {client: fakeClient(generateText), ...fitOptions})
    ).rejects.toThrow(/empty widget/);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("passes the preserve note to its shorten call", async () => {
    const generateText = jest.fn().mockResolvedValue("short");
    await fitToLength("this is way too long", {
      client: fakeClient(generateText), ...fitOptions, preserve: "Keep the label.",
    });
    expect(calls(generateText)[0].instructions).toContain("Keep the label.");
  });
});
