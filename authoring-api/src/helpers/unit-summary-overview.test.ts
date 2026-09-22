import {UNIT_SUMMARY_OVERVIEW_MAX_CHARS} from "../../../shared/unit-summary-types";
import {UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS} from "./unit-summary-config";
import {generateOverview} from "./unit-summary-overview";
import {GenerateTextParams, UnitSummaryOpenAIClient} from "./unit-summary-openai";

function fakeClient(generateText: jest.Mock): UnitSummaryOpenAIClient {
  return {generateText};
}

function calls(generateText: jest.Mock): GenerateTextParams[] {
  return generateText.mock.calls.map(([params]: [GenerateTextParams]) => params);
}

describe("generateOverview", () => {
  it("sends all digests, in order, in one call when they fit the budget", async () => {
    const digests = ["digest one", "digest two", "digest three"];
    const generateText = jest.fn().mockResolvedValue("the overview");
    const overview = await generateOverview(digests, {client: fakeClient(generateText), model: "m"});

    expect(generateText).toHaveBeenCalledTimes(1);
    const [request] = calls(generateText);
    const positions = digests.map((d) => request.input.indexOf(d));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(overview).toBe("the overview");
  });

  it("passes the given model through", async () => {
    const generateText = jest.fn().mockResolvedValue("overview");
    await generateOverview(["digest"], {client: fakeClient(generateText), model: "my-model"});
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({model: "my-model"}));
  });

  it("chunks and combines when all digests together exceed the input budget", async () => {
    const bigDigest = "x".repeat(Math.floor(UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS / 3));
    const digests = Array.from({length: 6}, (_, i) => `Digest ${i}: ${bigDigest}`);
    expect(digests.join("\n\n").length).toBeGreaterThan(UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS);

    const generateText = jest.fn().mockResolvedValue("combined overview");
    const overview = await generateOverview(digests, {client: fakeClient(generateText), model: "m"});

    // At least two chunk calls plus one combine call.
    expect(generateText.mock.calls.length).toBeGreaterThanOrEqual(3);
    calls(generateText).forEach((params) => {
      expect(params.input.length).toBeLessThanOrEqual(UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS);
    });
    expect(overview).toBe("combined overview");
  });

  it("asks the model to shorten an over-length overview once, and succeeds if that fits", async () => {
    const generateText = jest.fn()
      .mockResolvedValueOnce("x".repeat(UNIT_SUMMARY_OVERVIEW_MAX_CHARS + 1))
      .mockResolvedValueOnce("a shorter overview");
    const overview = await generateOverview(["digest"], {client: fakeClient(generateText), model: "m"});
    expect(overview).toBe("a shorter overview");
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("truncates an overview still over length after asking the model to shorten it", async () => {
    const generateText = jest.fn().mockResolvedValue("x".repeat(UNIT_SUMMARY_OVERVIEW_MAX_CHARS + 1));
    const overview = await generateOverview(["digest"], {client: fakeClient(generateText), model: "m"});
    expect(overview.length).toBeLessThanOrEqual(UNIT_SUMMARY_OVERVIEW_MAX_CHARS);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("fails on an empty overview without retrying", async () => {
    const generateText = jest.fn().mockResolvedValue("   ");
    await expect(generateOverview(["digest"], {client: fakeClient(generateText), model: "m"}))
      .rejects.toThrow(/empty overview/);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("fails clearly when the underlying call fails", async () => {
    const generateText = jest.fn().mockRejectedValue(new Error("openai 500"));
    await expect(generateOverview(["digest"], {client: fakeClient(generateText), model: "m"}))
      .rejects.toThrow(/overview failed.*openai 500/);
  });
});
