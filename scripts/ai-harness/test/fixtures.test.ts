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
    // not know, so the fixture standing in for it declares a made-up type instead. Asserting that is
    // what the old `covered.add("Unknown")` gave away — adding the string made this unfailable.
    for (const tileType of tileTypes) {
      if (tileType === "Unknown") continue;
      expect([...covered]).toContain(tileType);
    }
    expect(Object.values(expectations.documents).map((entry) => entry.computedModality))
      .toEqual(expect.arrayContaining(["text-only", "visual-only", "mixed", "empty"]));
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
