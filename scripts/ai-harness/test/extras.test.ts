import fs from "node:fs";
import path from "node:path";
import { main } from "../harness.js";
import {
  buildTasks, kDefaultModel, mixedSendsText, relatedSummariesFor, skipReasonsFor,
  variantFindsStudentContentIn
} from "../src/execute.js";
import { classifyDocument } from "../src/capability.js";
import { corpusPaths } from "../src/corpus.js";
import { loadPricingConfig, pricingFor } from "../src/cost.js";
import { harnessRoot } from "../src/files.js";
import type { ExperimentFile, ExperimentRun, ManifestDocument } from "../src/schemas.js";
import { makeTestDataRoot } from "./helpers.js";

/**
 * The extras dimension and the skip rules, which are the two decisions `buildTasks` makes about a
 * document before it builds anything.
 */
const agreements = { yes: [{ content: "Agreed.", tags: [] }] } as never;

const document = (relatedSummaries: unknown[]): ManifestDocument => ({
  id: "drawing",
  expectedRenderFailure: null,
  file: "documents/drawing.json",
  source: "synthetic",
  contentSha256: "0".repeat(64),
  computedModality: "mixed",
  retrievedAt: null,
  relatedSummaries
} as unknown as ManifestDocument);

const run = (extras?: ExperimentRun["extras"]): ExperimentRun => ({
  id: "r", message: "text-only", textVariant: "default", prompt: "p", ...(extras ? { extras } : {})
});

describe("what a run puts in the related-summary parts", () => {
  const entries = [
    { summary: "The first related document.", agreements },
    { summary: "The second related document.", agreements }
  ];
  const markdown = "# This document\n\nThe student drew a box.";

  it("sends the manifest entries unchanged by default", () => {
    // `all` is the default because it is what the harness has always done, so an
    // experiment file written before this dimension existed keeps its meaning and its request key.
    expect(relatedSummariesFor(run(), document(entries), markdown)).toEqual(entries);
    expect(relatedSummariesFor(run("all"), document(entries), markdown)).toEqual(entries);
  });

  it("sends nothing when the setting is `none`", () => {
    expect(relatedSummariesFor(run("none"), document(entries), markdown)).toEqual([]);
  });

  it("has nothing to send when the document has no related summaries", () => {
    for (const extras of ["all", "none"] as const) {
      expect(relatedSummariesFor(run(extras), document([]), markdown)).toEqual([]);
    }
  });
});

describe("which documents a run declines to send", () => {
  const withText = classifyDocument({
    rowOrder: ["r1"],
    rowMap: { r1: { tiles: [{ tileId: "t1" }] } },
    tileMap: { t1: { content: { type: "Text", format: "html", text: "The student wrote this." } } }
  });
  const visualOnly = classifyDocument({
    rowOrder: ["r1"],
    rowMap: { r1: { tiles: [{ tileId: "t1" }] } },
    tileMap: { t1: { content: { type: "Geometry" } } }
  });
  const empty = classifyDocument({ rowOrder: [], rowMap: {}, tileMap: {} });

  it("sends a document that carries student text to every shape", () => {
    for (const message of ["text-only", "image-only", "mixed"] as const) {
      expect(skipReasonsFor(message, withText)).toEqual([]);
    }
  });

  it("skips an empty document for every shape, saying it has no content at all", () => {
    for (const message of ["text-only", "image-only", "mixed"] as const) {
      const reasons = skipReasonsFor(message, empty);
      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toContain("no student content at all");
      expect(reasons[0]).toContain(message);
    }
  });

  it("skips a visual-only document for a text-only run, and sends it to the others", () => {
    // The summary would carry no student content, which is the thing a text-only run measures.
    expect(skipReasonsFor("text-only", visualOnly)[0])
      .toMatch(/no tile carries student-authored text/);
    expect(skipReasonsFor("image-only", visualOnly)).toEqual([]);
    expect(skipReasonsFor("mixed", visualOnly)).toEqual([]);
  });

  it("does not skip when the variant finds student content the classifier cannot see", () => {
    // The classifier asks whether a tile holds text a student wrote. A variant that turns something
    // else into words -- geometry, for `drawing-text` -- answers a different question, and the
    // document it exists for is exactly the one the classifier calls empty of text.
    expect(skipReasonsFor("text-only", visualOnly, undefined, true)).toEqual([]);
    // Only that branch is overridden: a document with no tiles at all has nothing for any variant
    // to describe, and still skips.
    expect(skipReasonsFor("text-only", empty, undefined, true)[0])
      .toMatch(/no student content at all/);
  });

  it("tells a mixed run when to drop its text half rather than skip the document", () => {
    // The picture still has something to say, so the request goes and the row records the omission.
    expect(mixedSendsText(withText)).toBe(true);
    expect(mixedSendsText(visualOnly)).toBe(false);
  });
});

describe("which variants find student content the classifier does not", () => {
  const drawingWith = (objects: unknown[]) => ({
    rowOrder: ["r"], rowMap: { r: { tiles: [{ tileId: "d" }] } },
    tileMap: { d: { content: { type: "Drawing", objects } } }
  });
  const textRun = (textVariant: string) =>
    ({ id: "r", message: "text-only", textVariant, prompt: "p" } as any);

  it("drawing-text counts a drawing with shapes, which carries no text at all", () => {
    expect(variantFindsStudentContentIn(textRun("drawing-text"),
      drawingWith([{ type: "rectangle", x: 10, y: 10, width: 120, height: 60 }]))).toBe(true);
  });

  it("but not an empty drawing, whose summary would say only that it is empty", () => {
    expect(variantFindsStudentContentIn(textRun("drawing-text"), drawingWith([]))).toBe(false);
  });

  it("and no pass-through variant claims to find anything", () => {
    for (const variantId of ["default", "minimal", "no-dataset-tables"]) {
      expect({ variantId, finds: variantFindsStudentContentIn(textRun(variantId),
        drawingWith([{ type: "rectangle" }])) }).toEqual({ variantId, finds: false });
    }
  });

  it("and a run that sends no text is never asked", () => {
    // `textVariant` is absent on an image-only run, so consulting a variant here would have to
    // invent one.
    expect(variantFindsStudentContentIn({ id: "r", message: "image-only", prompt: "p" } as any,
      drawingWith([{ type: "rectangle" }]))).toBe(false);
  });
});

describe("the extras dimension against a real corpus", () => {
  // The committed fixtures carry no `relatedSummaries` — the manifest is generated by `import`, so
  // there is nowhere in `examples/` to put them. They are injected into the manifest here instead,
  // which is also how a human would add them: `import` merges hand-edited entries forward across
  // re-imports. Recorded in the README's corpus section.
  const dataRoot = makeTestDataRoot("extras-corpus");
  const paths = corpusPaths(dataRoot, "extras-corpus");
  const related = [
    { summary: "A different student's document.", agreements: { yes: [{ content: "Agreed.", tags: [] }] } },
    { summary: "Another student's document.", agreements: {} }
  ];

  const tasksFor = (extras?: ExperimentRun["extras"]) => buildTasks({
    corpusPaths: paths,
    experiment: {
      schemaVersion: 1,
      name: "extras-check",
      runs: [{
        id: "text", message: "text-only", textVariant: "default",
        prompt: "categorize-design-default", ...(extras ? { extras } : {})
      }]
    } as ExperimentFile,
    promptsDir: path.join(harnessRoot, "prompts"),
    pricing: pricingFor(loadPricingConfig(), kDefaultModel)
  }).tasks;

  /** The related-summary parts of a task's built message, in order. */
  const relatedParts = (task: { makeRequest: () => { apiRequest: { messages: unknown[] } } }) =>
    ((task.makeRequest().apiRequest.messages[1] as any).content as any[])
      .filter((part) => part.type === "text" &&
        part.text.startsWith("This is AI generated summary of a similar document:"))
      .map((part) => part.text);

  beforeAll(async () => {
    const log = () => undefined;
    await main(["import", "--from", "examples/synthetic-corpus", "--corpus", "extras-corpus"],
      { dataRoot, log });
    await main(["represent", "--corpus", "extras-corpus", "--variants", "default"], { dataRoot, log });
    // Hand-edited, the way a human would add them.
    const manifest = JSON.parse(fs.readFileSync(paths.manifest, "utf8"));
    for (const entry of manifest.documents) {
      if (entry.id === "text" || entry.id === "table") entry.relatedSummaries = related;
    }
    fs.writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2));
  });

  it("sends the related documents' own summaries by default", () => {
    const task = tasksFor().find((entry) => entry.docId === "text")!;
    const parts = relatedParts(task);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("A different student's document.");
    expect(parts[1]).toContain("Another student's document.");
    // The agreement counts ride along, which is what makes the extras worth sending at all.
    expect(parts[0]).toContain("yes: 1");
  });

  it("sends no related-summary parts at all when the setting is `none`", () => {
    expect(relatedParts(tasksFor("none").find((entry) => entry.docId === "text")!)).toEqual([]);
  });

  it("gives each setting a different request key, so they are separate measurements", () => {
    const keyFor = (extras?: ExperimentRun["extras"]) =>
      tasksFor(extras).find((entry) => entry.docId === "text")!.requestKey;
    expect(new Set([keyFor(), keyFor("none")]).size).toBe(2);
    // And the default really is what an experiment file written before this dimension existed got.
    expect(keyFor("all")).toBe(keyFor());
  });

  it("changes nothing for a document with no related summaries", () => {
    const keyFor = (extras?: ExperimentRun["extras"]) =>
      tasksFor(extras).find((entry) => entry.docId === "question")!.requestKey;
    expect(new Set([keyFor(), keyFor("none")]).size).toBe(1);
  });
});

describe("a document the corpus says cannot be rendered", () => {
  const classification = classifyDocument({
    rowOrder: ["r1"],
    rowMap: { r1: { tiles: [{ tileId: "t1" }] } },
    tileMap: { t1: { content: { type: "Geometry" } } }
  });
  const unrenderable = {
    ...document([]),
    expectedRenderFailure: "the ErrorTest tile throws during render on purpose"
  } as ManifestDocument;

  it("is skipped by an image-carrying run, with the reason the corpus gave", () => {
    // Not a hard error about a missing render: that is what a document somebody simply forgot to
    // render gets, and the two must stay distinguishable.
    for (const message of ["image-only", "mixed"] as const) {
      const reasons = skipReasonsFor(message, classification, unrenderable);
      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toContain("cannot be rendered");
      expect(reasons[0]).toContain("throws during render on purpose");
    }
  });

  it("is still sent to a text-only run, which needs no picture", () => {
    // The summary comes from the document's JSON and never opens a browser, so an unrenderable
    // document measures perfectly well as text.
    const withText = classifyDocument({
      rowOrder: ["r1"],
      rowMap: { r1: { tiles: [{ tileId: "t1" }] } },
      tileMap: { t1: { content: { type: "Text", format: "html", text: "Student wrote this." } } }
    });
    expect(skipReasonsFor("text-only", withText, unrenderable)).toEqual([]);
  });

  it("changes nothing for a document with no such marker", () => {
    expect(skipReasonsFor("image-only", classification, document([]))).toEqual([]);
  });
});
