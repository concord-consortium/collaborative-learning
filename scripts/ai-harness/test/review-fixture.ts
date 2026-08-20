/**
 * A corpus, an experiment and a results file built for the review report's tests.
 *
 * Two things shape it. Everything a document can carry that the report must escape is present —
 * `</script>`, an image tag with an `onerror` handler, markdown link syntax and a URL — in the
 * summary, in a discussion, in a refusal and in an error message, because those are four different
 * paths to the page. And every identifier the shareable and blind modes are supposed to remove is a
 * **sentinel** (`zz-…`) rather than a realistic value: asserting that "default" or "text-only" is
 * absent from a report would false-fail the day a student writes either word.
 */
import fs from "node:fs";
import path from "node:path";
import { corpusPaths, representationPath, writeJsonFile } from "../src/corpus.js";
import {
  imageRepresentationPath, readImageEnvelope, writeImageRepresentation
} from "../src/represent-image.js";
import {
  ExperimentFile, ResultRow, kResultSchemaVersion, kSchemaVersion, sha256Canonical,
  validateExperimentFile
} from "../src/schemas.js";
import { makeTestDataRoot, makeTestPng, testRunMeta } from "./helpers.js";

/**
 * Student-authored text that would end the page early, or run script, if it were not escaped.
 *
 * The last two are a line separator and a paragraph separator, written as escapes so this source
 * file stays readable: they are legal in a document's text, and a report that reproduced them raw
 * would be flagged by editors as having unusual line terminators.
 */
export const kAdversarial =
  "</script><img src=x onerror=alert(1)> [link](https://evil.example.com/x) 'q' \"d\" A & B" +
  " line\u2028sep para\u2029sep";

export const kSentinels = {
  textRun: "zz-run-one",
  imageRun: "zz-run-two",
  mixedRun: "zz-run-three",
  unit: "zz-unit-sentinel",
  investigation: "zz-investigation-sentinel",
  problem: "zz-problem-sentinel",
  contextId: "zz-context-sentinel"
};

export const kCorpus = "review-corpus";
export const kDocuments = ["alpha", "beta", "gamma"];

const kContentSha = {
  alpha: "1".repeat(64),
  beta: "2".repeat(64),
  gamma: "3".repeat(64)
};

const origin = { date: "2026-08-11T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: null };

export interface ReviewFixture {
  dataRoot: string;
  paths: ReturnType<typeof corpusPaths>;
  experimentFile: string;
  experiment: ExperimentFile;
  experimentSha256: string;
  resultsFile: string;
  rows: ResultRow[];
  /** The sha256 of the one picture both image-carrying runs sent. */
  imageSha256: string;
  /** The `default` variant's summary for `alpha`, as it sits on disk. */
  alphaMarkdown: string;
}

function manifestDocument(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    file: `documents/${id}.json`,
    source: "qa",
    contentSha256: kContentSha[id as keyof typeof kContentSha],
    retrievedAt: "2026-08-11T00:00:00.000Z",
    unit: null,
    investigation: null,
    problem: null,
    contextId: null,
    computedModality: "text-only",
    modalityOverride: null,
    expectedRenderFailure: null,
    labels: {},
    relatedSummaries: [],
    historical: null,
    ...overrides
  };
}

/**
 * Builds the fixture under its own data root. `name` is the scratch directory, so each suite that
 * mutates the tree — a stale representation, a filled-in ratings template — gets its own copy.
 */
export function buildReviewFixture(name: string): ReviewFixture {
  const dataRoot = makeTestDataRoot(name);
  const paths = corpusPaths(dataRoot, kCorpus);

  writeJsonFile(paths.manifest, {
    schemaVersion: kSchemaVersion,
    name: kCorpus,
    createdAt: "2026-08-11T00:00:00.000Z",
    documents: [
      manifestDocument("alpha", {
        unit: kSentinels.unit,
        investigation: kSentinels.investigation,
        problem: kSentinels.problem,
        contextId: kSentinels.contextId
      }),
      // A human's override, so the report has one to flag the way the report's `overridden` column
      // does; the rows below carry both modalities.
      manifestDocument("beta", { computedModality: "mixed", modalityOverride: "visual-only" }),
      manifestDocument("gamma", { computedModality: "empty" })
    ]
  });

  const alphaMarkdown = `# Summary\n\nThe student wrote: ${kAdversarial}\n`;
  for (const [docId, markdown] of [["alpha", alphaMarkdown], ["beta", "# Summary\n\nbeta text\n"]]) {
    writeJsonFile(representationPath(paths, "default", docId), {
      schemaVersion: kSchemaVersion,
      docId,
      variantId: "default",
      variantVersion: 1,
      sourceContentSha256: kContentSha[docId as keyof typeof kContentSha],
      generatedAt: "2026-08-11T00:00:00.000Z",
      markdown
    });
  }

  const envelopeFile = imageRepresentationPath(paths, "puppeteer-full-height", "beta");
  writeImageRepresentation({
    envelopeFile,
    docId: "beta",
    modeId: "puppeteer-full-height",
    backendId: "puppeteer",
    backendVersion: 2,
    renderTarget: {
      clueUrl: "http://localhost:8080",
      unit: "harness-render",
      clueRevision: "abc1234",
      shutterbugUrl: null,
      viewportWidthPx: 960,
      captureMode: "full-document",
      captureHeightPx: null
    },
    sourceContentSha256: kContentSha.beta,
    generatedAt: "2026-08-11T00:00:00.000Z",
    images: [{ bytes: makeTestPng(24, 12), url: null, tileId: null, purpose: "full-document" }]
  });
  const imageSha256 = readImageEnvelope(envelopeFile).images[0].sha256;

  const experiment = {
    schemaVersion: kSchemaVersion,
    name: "review-fixture",
    runs: [
      { id: kSentinels.textRun, message: "text-only", textVariant: "default",
        prompt: "categorize-design-default" },
      { id: kSentinels.imageRun, message: "image-only", imageMode: "puppeteer-full-height",
        detail: "low", prompt: "categorize-design-default" },
      { id: kSentinels.mixedRun, message: "mixed", textVariant: "default",
        imageMode: "puppeteer-full-height", extras: "none", prompt: "categorize-design-default" }
    ]
  };
  const experimentFile = path.join(dataRoot, "experiment.json");
  writeJsonFile(experimentFile, experiment);
  const experimentSha256 = sha256Canonical(experiment);

  const textRepresentation = (docId: string) => ({
    kind: "text" as const, variantId: "default", variantVersion: 1,
    sourceContentSha256: kContentSha[docId as keyof typeof kContentSha]
  });
  const imageRepresentation = {
    kind: "image" as const, modeId: "puppeteer-full-height", backendId: "puppeteer",
    backendVersion: 2,
    renderTarget: {
      clueUrl: "http://localhost:8080", unit: "harness-render", clueRevision: "abc1234",
      shutterbugUrl: null, viewportWidthPx: 960, captureMode: "full-document" as const,
      captureHeightPx: null
    },
    sourceContentSha256: kContentSha.beta,
    imageSha256s: [imageSha256],
    imageSet: "full-document" as const
  };

  const common = {
    schemaVersion: kResultSchemaVersion as 2,
    experiment: experiment.name,
    experimentSha256,
    corpus: kCorpus,
    prompt: { name: "categorize-design-default", sha256: "a".repeat(64) },
    runMeta: testRunMeta
  };
  const usage = { promptTokens: 400, completionTokens: 40, source: "api" as const };
  const cost = { modeledUsd: 0.0012, incurredThisRunUsd: 0.0012 };

  const rows: ResultRow[] = [
    // Superseded: an error that a later success replaced. It must not be rendered, and must be
    // counted as superseded.
    { ...common, docId: "alpha", runId: kSentinels.textRun, modality: "text-only",
      computedModality: "text-only", message: "text-only", requestKey: "alpha-text-old",
      representation: textRepresentation("alpha"), status: "error",
      error: { type: "APIError", message: "superseded-error-marker", attempts: 3 } },
    { ...common, docId: "alpha", runId: kSentinels.textRun, modality: "text-only",
      computedModality: "text-only", message: "text-only", requestKey: "alpha-text",
      representation: textRepresentation("alpha"), status: "success",
      response: {
        parsed: {
          category: "form",
          keyIndicators: [`indicator ${kAdversarial}`],
          discussion: `discussion ${kAdversarial}`
        },
        raw: {}
      },
      usage, cost, responseOriginMeta: origin },
    { ...common, docId: "alpha", runId: kSentinels.imageRun, modality: "text-only",
      computedModality: "text-only", message: "image-only", requestKey: "alpha-image",
      representation: { ...imageRepresentation, sourceContentSha256: kContentSha.alpha },
      promptImageTokensEstimated: 2833, status: "refusal",
      refusal: `refusal ${kAdversarial}`, usage, cost, responseOriginMeta: origin },
    { ...common, docId: "alpha", runId: kSentinels.mixedRun, modality: "text-only",
      computedModality: "text-only", message: "mixed", requestKey: "alpha-mixed",
      representation: {
        kind: "mixed", text: textRepresentation("alpha"),
        image: { ...imageRepresentation, sourceContentSha256: kContentSha.alpha }
      },
      promptImageTokensEstimated: 2833, status: "error",
      error: { type: "unparsed", message: `error ${kAdversarial}`, attempts: 1 } },

    { ...common, docId: "beta", runId: kSentinels.textRun, modality: "visual-only",
      computedModality: "mixed", message: "text-only", requestKey: null, status: "skipped",
      skipReasons: [`text-only run: skipped ${kAdversarial}`],
      decidedFromContentSha256: kContentSha.beta },
    // Only `category` is set: every field of the response schema is optional, and an unrecognized
    // one has to be shown rather than dropped by a renderer that assumed the shape.
    { ...common, docId: "beta", runId: kSentinels.imageRun, modality: "visual-only",
      computedModality: "mixed", message: "image-only", requestKey: "beta-image",
      representation: imageRepresentation, promptImageTokensEstimated: 2833, status: "success",
      response: { parsed: { category: "function", zzUnknownField: "zz-extra-field-marker" }, raw: {} },
      usage: { ...usage, source: "cache" }, cost: { modeledUsd: 0.0012, incurredThisRunUsd: 0 },
      responseOriginMeta: origin },
    { ...common, docId: "beta", runId: kSentinels.mixedRun, modality: "visual-only",
      computedModality: "mixed", message: "mixed", requestKey: "beta-mixed",
      representation: {
        kind: "mixed", text: textRepresentation("beta"), image: imageRepresentation
      },
      promptImageTokensEstimated: 2833, textPartOmitted: true, status: "success",
      response: { parsed: {}, raw: {} }, usage, cost, responseOriginMeta: origin },

    ...[kSentinels.textRun, kSentinels.imageRun, kSentinels.mixedRun].map((runId) => ({
      ...common, docId: "gamma", runId, modality: "empty" as const,
      computedModality: "empty" as const, message: "text-only" as const, requestKey: null,
      status: "skipped" as const,
      skipReasons: ["the document has no student content at all"],
      decidedFromContentSha256: kContentSha.gamma
    }))
  ];

  const resultsFile = path.join(dataRoot, "results", `${kCorpus}__${experiment.name}.jsonl`);
  fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
  fs.writeFileSync(resultsFile, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);

  return {
    dataRoot,
    paths,
    experimentFile,
    experiment: validateExperimentFile(experiment, experimentFile, {
      knownTextVariants: ["default"],
      knownImageModes: ["puppeteer-full-height"],
      promptExists: () => true
    }),
    experimentSha256,
    resultsFile,
    rows,
    imageSha256,
    alphaMarkdown
  };
}

/** Every tag name the report itself uses, so a test can say "and nothing else". */
export function tagNamesIn(markup: string): string[] {
  return [...new Set([...markup.matchAll(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)/g)]
    .map((match) => match[1].toLowerCase()))].sort();
}
