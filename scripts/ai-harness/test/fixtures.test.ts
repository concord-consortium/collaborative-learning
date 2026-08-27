import fs from "node:fs";
import path from "node:path";
import { tileTypes } from "../../../shared/tile-types.js";
import { classifyDocument } from "../src/capability.js";
import { harnessRoot } from "../src/corpus.js";
import { textVariants } from "../src/represent-text.js";
import { validateExpectationsFile } from "../src/schemas.js";

const corpusDir = path.join(harnessRoot, "examples", "synthetic-corpus");
const documentsDir = path.join(corpusDir, "documents");
const expectationsFile = path.join(corpusDir, "expectations.json");
const expectations = validateExpectationsFile(
  JSON.parse(fs.readFileSync(expectationsFile, "utf8")), expectationsFile);

const docIds = Object.keys(expectations.documents);

function readDocument(docId: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(documentsDir, `${docId}.json`), "utf8"));
}

/**
 * The `id` of every object in every Drawing tile of a document, a group's members included.
 *
 * One entry per object rather than per id: an object that has no id has to show up here as a gap,
 * since that is the thing the test below exists to catch.
 */
function drawingObjectIds(content: unknown): (string | undefined)[] {
  const ids: (string | undefined)[] = [];
  const walk = (objects: any[]) => objects.forEach((object) => {
    ids.push(object?.id);
    if (Array.isArray(object?.objects)) walk(object.objects);
  });
  for (const tile of Object.values<any>((content as any)?.tileMap ?? {})) {
    if (tile?.content?.type === "Drawing" && Array.isArray(tile.content.objects)) {
      walk(tile.content.objects);
    }
  }
  return ids;
}

describe("the committed synthetic corpus", () => {
  it("has one document per file and one expectation per document", () => {
    const files = fs.readdirSync(documentsDir).filter((name) => name.endsWith(".json"))
      .map((name) => path.basename(name, ".json")).sort();
    expect(files).toEqual([...docIds].sort());
  });

  it("has no committed manifest — `import` generates that", () => {
    expect(fs.existsSync(path.join(corpusDir, "manifest.json"))).toBe(false);
  });

  it("covers every registered tile type, plus a mixed and an empty document", () => {
    const covered = new Set(Object.values(expectations.documents).flatMap((entry) => entry.tileTypes));
    // "Unknown" is deliberately not in `covered`: it is the registration for a type this build does
    // not know, so the fixture standing in for it declares a made-up type instead. It is skipped below
    // rather than added to `covered`, which would satisfy the assertion by writing the answer into it.
    for (const tileType of tileTypes) {
      if (tileType === "Unknown") continue;
      expect([...covered]).toContain(tileType);
    }
    expect(Object.values(expectations.documents).map((entry) => entry.computedModality))
      .toEqual(expect.arrayContaining(["text-only", "visual-only", "mixed", "empty"]));
  });

  it("gives every drawing object an id, so the object table has one to print", () => {
    // The production summary of a Drawing tile is a table whose first column is each object's id.
    // A fixture object without one makes that column read "undefined", which is a gap in the
    // fixture rather than in the summarizer — real CLUE documents always store ids.
    //
    // The documents are found rather than listed, so a third Drawing fixture added without ids
    // fails here instead of sitting outside the check.
    const withDrawings = docIds.filter((docId) =>
      expectations.documents[docId].tileTypes.includes("Drawing"));
    expect(withDrawings).not.toEqual([]);
    for (const docId of withDrawings) {
      const content = readDocument(docId);
      const summary = textVariants.default.render(content);
      const ids = drawingObjectIds(content);
      expect({ docId, objects: ids.length }).not.toEqual({ docId, objects: 0 });
      // Two separate ways to fail: an object with no id, and an id the summary never prints.
      // Asking only that "undefined" is absent would pass just as well if the column disappeared.
      expect({
        docId,
        withoutId: ids.filter((id) => !id).length,
        missing: ids.filter((id) => id && !summary.includes(id))
      }).toEqual({ docId, withoutId: 0, missing: [] });
    }
  });

  it("stands in for the Unknown registration with a type this build does not register", () => {
    const unknownFixture = expectations.documents.unknown;
    expect(unknownFixture).toBeDefined();
    const registered = tileTypes as readonly string[];
    expect(unknownFixture.tileTypes.filter((type) => !registered.includes(type))).not.toEqual([]);
  });
});

describe.each(docIds)("fixture %s", (docId) => {
  const expectation = expectations.documents[docId];
  // Read inside beforeAll rather than while jest collects the suite: a missing or unparsable fixture
  // would otherwise take down the whole file with a collection-time crash, hiding the parity test's
  // far clearer "documents and expectations disagree" diagnostic.
  let content: unknown;
  let classification: ReturnType<typeof classifyDocument>;

  beforeAll(() => {
    content = readDocument(docId);
    classification = classifyDocument(content);
  });

  it("classifies as expected", () => {
    expect(classification.computedModality).toBe(expectation.computedModality);
    expect(classification.warnings).toEqual([]);
  });

  it("has the expected document-level capability", () => {
    expect({
      containsStudentText: classification.tiles.some((tile) => tile.hasStudentText),
      requiresVisualRepresentation: classification.tiles.some((tile) => tile.requiresVisualRepresentation)
    }).toEqual(expectation.capability);
  });

  it("contains the expected tile types", () => {
    const types = [...new Set(classification.tiles.map((tile) => tile.tileType))].sort();
    expect(types).toEqual([...expectation.tileTypes].sort());
  });

  // Skipped rather than silently passing when a fixture declares it cannot summarize: an early
  // `return` inside the test made a `false` flag indistinguishable from a passing assertion.
  const itDefault = expectation.defaultSummaryMustSucceed ? it : it.skip;
  const itMinimal = expectation.minimalSummaryMustSucceed ? it : it.skip;

  itDefault("summarizes with the default variant", () => {
    const summary = textVariants.default.render(content);
    expect(summary.length).toBeGreaterThan(0);
    if (expectation.expectDistinctiveInDefaultSummary) {
      // Full- and partial-fidelity handlers must carry the fixture's own content through.
      expect(summary).toContain(expectation.distinctiveString);
    }
  });

  itMinimal("summarizes with the minimal variant", () => {
    expect(textVariants.minimal.render(content).length).toBeGreaterThan(0);
  });
});

describe("the no-dataset-tables variant", () => {
  // The table fixture is the one with a data set behind it, so it is the one this variant changes.
  const tableContent = JSON.parse(fs.readFileSync(
    path.join(harnessRoot, "examples", "synthetic-corpus", "documents", "table.json"), "utf8"));

  it("keeps the data set's shape and drops its rows", () => {
    const full = textVariants.default.render(tableContent);
    const schemaOnly = textVariants["no-dataset-tables"].render(tableContent);
    expect(full).toContain("shown below in a Markdown table");
    expect(schemaOnly).not.toContain("shown below in a Markdown table");
    // The reader still learns what the data set is and how big it is.
    expect(schemaOnly).toContain("Data Sets");
    expect(schemaOnly).toMatch(/There are \d+ cases? in this data set\./);
    expect(schemaOnly.length).toBeLessThan(full.length);
  });

  it("leaves a document with no data set exactly as `default` renders it", () => {
    // The variant is about data sets; for everything else it must not be a second `default` with a
    // different name, or a comparison between them would measure noise.
    for (const docId of ["drawing", "text", "empty"]) {
      const content = JSON.parse(fs.readFileSync(
        path.join(harnessRoot, "examples", "synthetic-corpus", "documents", `${docId}.json`), "utf8"));
      const same = textVariants["no-dataset-tables"].render(content) === textVariants.default.render(content);
      expect({ docId, same }).toEqual({ docId, same: true });
    }
  });
});

describe("the drawing-text variant", () => {
  // `drawing-text` is the prototype description of a drawing, written when production's summary of a
  // Drawing tile was the one sentence "This tile contains a drawing." That default sentence has been
  // replaced with a table of the drawing's objects, so `default` now describes a drawing too. The
  // variant is kept as the earlier prototype, so recorded runs that used it can still be compared
  // against — not as an improvement over `default`. These tests therefore say what the variant
  // emits and nothing about what `default` does or does not say.
  const load = (docId: string) => JSON.parse(fs.readFileSync(
    path.join(harnessRoot, "examples", "synthetic-corpus", "documents", `${docId}.json`), "utf8"));

  it("describes a drawing's objects in words", () => {
    const summary = textVariants["drawing-text"].render(load("drawing"));
    // The fixture is a rectangle and an ellipse; the variant says so, with their geometry.
    expect(summary).toContain("2 objects (1 rectangle, 1 ellipse)");
    expect(summary).toContain("- rectangle at (10, 10), 120×60");
    expect(summary).toContain("- ellipse at (160, 40), radii 30×20");
  });

  it("carries a drawing's text objects", () => {
    // The `mixed` fixture has a Drawing holding a text object.
    const content = load("mixed");
    const summary = textVariants["drawing-text"].render(content);
    const drawnText = content.tileMap["mixed-drawing-tile"].content.objects
      .find((object: any) => object.type === "text").text;
    expect(summary).toContain(drawnText);
  });

  it("leaves every other tile type exactly as `default` renders it", () => {
    // The variant swaps one handler. If it changed anything else, a comparison against `default`
    // would measure the difference between two summarizers rather than between two drawing
    // serializers.
    for (const docId of ["text", "table", "geometry", "empty"]) {
      const same = textVariants["drawing-text"].render(load(docId)) === textVariants.default.render(load(docId));
      expect({ docId, same }).toEqual({ docId, same: true });
    }
  });
});
