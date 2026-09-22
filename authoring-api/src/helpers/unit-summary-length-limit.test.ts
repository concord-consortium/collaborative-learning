import {generateWithLengthLimit} from "./unit-summary-length-limit";
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
