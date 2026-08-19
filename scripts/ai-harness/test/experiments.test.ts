import fs from "node:fs";
import path from "node:path";
import { harnessRoot } from "../src/corpus.js";
import { renderModeIds } from "../src/backends/index.js";
import { textVariantIds } from "../src/represent-text.js";
import { validateExperimentFile, validateResultRow } from "../src/schemas.js";
import { testRunMeta } from "./helpers.js";

const context = {
  knownTextVariants: textVariantIds,
  knownImageModes: renderModeIds,
  promptExists: (name: string) => name === "categorize-design-default"
};

const textRun = {
  id: "text-default", message: "text-only", textVariant: "default", prompt: "categorize-design-default"
};
const imageRun = {
  id: "image-puppeteer", message: "image-only", imageMode: "puppeteer-full-height",
  prompt: "categorize-design-default"
};

const file = "experiment.json";
const wrap = (runs: unknown[]) => ({ schemaVersion: 1, name: "x", runs });

describe("a run names the representation its message shape actually uses", () => {
  it("accepts a text-only run with a text variant", () => {
    const experiment = validateExperimentFile(wrap([textRun]), file, context);
    expect(experiment.runs[0]).toEqual(textRun);
  });

  it("accepts an image-only run with an image mode", () => {
    const experiment = validateExperimentFile(wrap([imageRun]), file, context);
    expect(experiment.runs[0]).toEqual(imageRun);
    expect(experiment.runs[0].textVariant).toBeUndefined();
  });

  it("refuses a text-only run that also names an image mode", () => {
    // Ignoring it would produce a result table that looks fine and answers a different question
    // from the one the file describes.
    expect(() => validateExperimentFile(
      wrap([{ ...textRun, imageMode: "puppeteer-full-height" }]), file, context))
      .toThrow(/runs\[0\]\.imageMode must not be set on a "text-only" run/);
  });

  it("refuses an image-only run that also names a text variant", () => {
    expect(() => validateExperimentFile(wrap([{ ...imageRun, textVariant: "default" }]), file, context))
      .toThrow(/runs\[0\]\.textVariant must not be set on an "image-only" run/);
  });

  it("refuses an image-only run with no mode at all", () => {
    const { imageMode, ...withoutMode } = imageRun;
    expect(() => validateExperimentFile(wrap([withoutMode]), file, context))
      .toThrow(/runs\[0\]\.imageMode must be a string/);
  });

  it("refuses a text-only run with no variant at all", () => {
    const { textVariant, ...withoutVariant } = textRun;
    expect(() => validateExperimentFile(wrap([withoutVariant]), file, context))
      .toThrow(/runs\[0\]\.textVariant must be a string/);
  });

  it("refuses a render mode this build does not have", () => {
    expect(() => validateExperimentFile(wrap([{ ...imageRun, imageMode: "screenshot" }]), file, context))
      .toThrow(/runs\[0\]\.imageMode must be one of puppeteer-full-height/);
  });
});

describe("the committed experiment files", () => {
  // Filtered and sorted: readdir order is the filesystem's, so it decided test order, and any
  // non-JSON file dropped in the directory made `JSON.parse` throw rather than being skipped.
  const experimentFiles = fs.readdirSync(path.join(harnessRoot, "experiments"))
    .filter((name) => name.endsWith(".json")).sort();

  it.each(experimentFiles)("%s validates", (name) => {
    const experimentFile = path.join(harnessRoot, "experiments", name);
    const experiment = validateExperimentFile(
      JSON.parse(fs.readFileSync(experimentFile, "utf8")), experimentFile, {
        ...context,
        promptExists: (prompt: string) =>
          fs.existsSync(path.join(harnessRoot, "prompts", `${prompt}.json`))
      });
    expect(experiment.runs.length).toBeGreaterThan(0);
  });

  it("runs the image-versus-text comparison from one file", () => {
    const experimentFile = path.join(harnessRoot, "experiments", "image-vs-text.json");
    const experiment = validateExperimentFile(
      JSON.parse(fs.readFileSync(experimentFile, "utf8")), experimentFile, {
        ...context,
        promptExists: () => true
      });
    expect(experiment.runs.map((run) => run.id))
      .toEqual(["text-default", "text-minimal", "image-puppeteer"]);
    // Same prompt across all three: the representation is the only thing that differs.
    expect(new Set(experiment.runs.map((run) => run.prompt)).size).toBe(1);
  });
});

describe("version-1 result rows are refused, not mis-read", () => {
  const v2Common = {
    schemaVersion: 2,
    experiment: "e", experimentSha256: "abc", runId: "r", corpus: "c", docId: "d",
    modality: "text-only", computedModality: "text-only", message: "text-only",
    representation: {
      kind: "text", variantId: "default", variantVersion: 1, sourceContentSha256: "0".repeat(64)
    },
    prompt: { name: "p", sha256: "s" }, requestKey: "key", runMeta: testRunMeta,
    status: "success", response: { parsed: {}, raw: {} },
    usage: { promptTokens: 1, completionTokens: 1, source: "api" },
    cost: { modeledUsd: 0, incurredThisRunUsd: 0 },
    responseOriginMeta: { date: "d", modelReturned: null, systemFingerprint: null }
  };

  it("reads a version-2 row", () => {
    expect(validateResultRow(v2Common, "results.jsonl").schemaVersion).toBe(2);
  });

  // A version-1 row described its representation with a bare `textVariant` string. Reading one as
  // current would attribute rows to a variant that never ran, so it is refused with instructions —
  // which have to say both what to do and that a rerun is not a second bill.
  it.each([
    ["says what to do about it", /schemaVersion must be 2, got 1.*re-run the experiment into a fresh --output/s],
    ["names the cache, so re-running does not read as re-paying", /will not be paid for twice/]
  ])("refuses a version-1 row and %s", (_label, pattern) => {
    const { representation, ...rest } = v2Common;
    expect(() => validateResultRow({ ...rest, schemaVersion: 1, textVariant: "default" }, "results.jsonl"))
      .toThrow(pattern);
  });
});

describe("the image-token estimate belongs to rows that sent an image", () => {
  const base = {
    schemaVersion: 2, experiment: "e", experimentSha256: "a", runId: "r", corpus: "c", docId: "d",
    modality: "visual-only", computedModality: "visual-only", message: "image-only",
    representation: {
      kind: "image", modeId: "puppeteer-full-height", backendId: "puppeteer", backendVersion: 1,
      renderTarget: {
        clueUrl: "http://localhost:8080", unit: "harness-render", clueRevision: "abc",
        shutterbugUrl: null, viewportWidthPx: 960, captureMode: "full-document", captureHeightPx: null
      },
      sourceContentSha256: "0".repeat(64), imageSha256s: ["a".repeat(64)]
    },
    prompt: { name: "p", sha256: "s" }, runMeta: testRunMeta,
    // A row that really did send a request: the rule under test is about those, and a skipped row
    // carries no representation for it to apply to.
    status: "success", requestKey: "key", response: { parsed: {}, raw: {} },
    usage: { promptTokens: 37_000, completionTokens: 40, source: "api" },
    cost: { modeledUsd: 0.001, incurredThisRunUsd: 0.001 },
    responseOriginMeta: { date: "d", modelReturned: null, systemFingerprint: null }
  };

  it("accepts an image row that carries one", () => {
    const row = validateResultRow({ ...base, promptImageTokensEstimated: 36_835 }, "results.jsonl");
    if (row.status === "skipped") throw new Error("expected a row that sent a request");
    expect(row.promptImageTokensEstimated).toBe(36_835);
  });

  it("refuses an image row with no estimate", () => {
    expect(() => validateResultRow({ ...base }, "results.jsonl"))
      .toThrow(/promptImageTokensEstimated must be set on a row whose representation is "image"/);
  });

  it.each([-5, Number.NaN])("refuses a nonsensical estimate (%p)", (value) => {
    // Reports sum this field, so a negative would quietly subtract from the image-token total.
    expect(() => validateResultRow({ ...base, promptImageTokensEstimated: value }, "results.jsonl"))
      .toThrow(/promptImageTokensEstimated must (not be negative|be a finite number)/);
  });

  it("refuses a text row that carries one", () => {
    // A number in the report's image column that belongs to nothing.
    expect(() => validateResultRow({
      ...base,
      representation: {
        kind: "text", variantId: "default", variantVersion: 1, sourceContentSha256: "0".repeat(64)
      },
      promptImageTokensEstimated: 100
    }, "results.jsonl")).toThrow(/must be absent on a row whose representation is "text"/);
  });
});
