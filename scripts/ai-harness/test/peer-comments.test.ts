import fs from "node:fs";
import path from "node:path";
import { main } from "../harness.js";
import { buildTasks, kDefaultModel, relatedSummariesFor } from "../src/execute.js";
import { corpusPaths } from "../src/corpus.js";
import { loadPricingConfig, pricingFor } from "../src/cost.js";
import { harnessRoot } from "../src/files.js";
import type { ExperimentFile, ExperimentRun, ManifestDocument } from "../src/schemas.js";
import { makeTestDataRoot } from "./helpers.js";

/**
 * The three conditions `experiments/peer-comments.json` compares, checked on the requests they
 * build rather than on the settings that produced them.
 *
 * `plan` cannot show this: it is network-free by design and reports run details and cost, never
 * request bodies. Without this file the paid comparison could measure three identical inputs and
 * report a null result that meant nothing.
 */

const peerComment = {
  commentId: "c1",
  commentUid: "student-2",
  content: "You used a ratio table but did not say why the rows are equivalent.",
  tags: ["user"],
  ratings: { yes: 2, notSure: 1 },
  updatedAt: 1756000000000
};

const relatedEntry = {
  summary: "A different student's document.",
  agreements: { yes: [{ content: "Agreed.", tags: [] }] },
  peerComments: [peerComment]
};

const run = (extras?: ExperimentRun["extras"]): ExperimentRun => ({
  id: "r", message: "text-only", textVariant: "default", prompt: "p", ...(extras ? { extras } : {})
});

const document = (relatedSummaries: unknown[]): ManifestDocument => ({
  id: "text",
  expectedRenderFailure: null,
  file: "documents/text.json",
  source: "synthetic",
  contentSha256: "0".repeat(64),
  computedModality: "text-only",
  retrievedAt: null,
  relatedSummaries
} as unknown as ManifestDocument);

describe("what each extras setting puts in the related summaries", () => {
  it("keeps the peer comments under `all`", () => {
    expect(relatedSummariesFor(run("all"), document([relatedEntry]))[0].peerComments)
      .toEqual([peerComment]);
    // Saying nothing is still `all`, as it was before this setting had a third value.
    expect(relatedSummariesFor(run(), document([relatedEntry]))[0].peerComments)
      .toEqual([peerComment]);
  });

  it("empties the peer comments but keeps everything else under `ai-counts`", () => {
    const [entry] = relatedSummariesFor(run("ai-counts"), document([relatedEntry]));
    expect(entry.peerComments).toEqual([]);
    expect(entry.summary).toBe("A different student's document.");
    expect(entry.agreements).toEqual(relatedEntry.agreements);
  });

  it("sends no related summaries at all under `none`", () => {
    expect(relatedSummariesFor(run("none"), document([relatedEntry]))).toEqual([]);
  });

  it("leaves the manifest entry alone, so one run cannot affect another", () => {
    const entries = [relatedEntry];
    relatedSummariesFor(run("ai-counts"), document(entries));
    expect(entries[0].peerComments).toEqual([peerComment]);
  });
});

describe("the three conditions against a real corpus", () => {
  const dataRoot = makeTestDataRoot("peer-comments-corpus");
  const paths = corpusPaths(dataRoot, "peer-comments-corpus");

  const tasksFor = (extras: ExperimentRun["extras"]) => buildTasks({
    corpusPaths: paths,
    experiment: {
      schemaVersion: 1,
      name: "peer-comments-check",
      runs: [{
        id: "text", message: "text-only", textVariant: "default",
        prompt: "categorize-design-default", extras
      }]
    } as ExperimentFile,
    promptsDir: path.join(harnessRoot, "prompts"),
    pricing: pricingFor(loadPricingConfig(), kDefaultModel)
  }).tasks;

  /** The whole request as it would be sent, which is what the three conditions have to differ in. */
  const bodyFor = (extras: ExperimentRun["extras"], docId: string) => {
    const task = tasksFor(extras).find((entry) => entry.docId === docId)!;
    return JSON.stringify(task.makeRequest().apiRequest);
  };

  beforeAll(async () => {
    const log = () => undefined;
    await main(["import", "--from", "examples/synthetic-corpus", "--corpus", "peer-comments-corpus"],
      { dataRoot, log });
    await main(["represent", "--corpus", "peer-comments-corpus", "--variants", "default"],
      { dataRoot, log });
    // `text` is not in the committed sidecar, so this is a fixture this file controls entirely.
    // `dataflow` below is the seeded one, and checks the sidecar and the builder together.
    const manifest = JSON.parse(fs.readFileSync(paths.manifest, "utf8"));
    for (const entry of manifest.documents) {
      if (entry.id === "text") entry.relatedSummaries = [relatedEntry];
    }
    fs.writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2));
  });

  it("states the AI agreement counts under `ai-counts`, and sends no comment text", () => {
    const body = bodyFor("ai-counts", "text");
    expect(body).toContain("Other users agreed with this summary as follows");
    expect(body).not.toContain("<comment");
    expect(body).not.toContain("did not say why the rows are equivalent");
  });

  it("sends neither the counts nor the comments under `none`", () => {
    const body = bodyFor("none", "text");
    expect(body).not.toContain("Other users agreed with this summary as follows");
    expect(body).not.toContain("<comment");
  });

  // The three below fail until Task 3 adds the peer section to `summaryContentParts`. `it.failing`
  // rather than a skip, so that finishing Task 3 turns them red and they get flipped to `it`
  // instead of sitting green and unexercised.
  it.failing("fences the peer comments under `all`", () => {
    const body = bodyFor("all", "text");
    expect(body).toContain("<comment");
    expect(body).toContain("did not say why the rows are equivalent");
    // The counts line is separate and still there, which is what keeps the two channels apart.
    expect(body).toContain("Other users agreed with this summary as follows");
  });

  it.failing("gives the three conditions three different requests", () => {
    const bodies = ["all", "ai-counts", "none"].map(
      (extras) => bodyFor(extras as ExperimentRun["extras"], "text"));
    expect(new Set(bodies).size).toBe(3);
  });

  it.failing("carries a document seeded from the committed sidecar into its request", () => {
    // Checks the sidecar, `import`'s seeding and the message builder in one line: nothing here
    // hand-edits the manifest for `dataflow`.
    expect(bodyFor("all", "dataflow")).toContain("<comment");
  });
});
