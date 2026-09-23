import {hashString} from "../../../shared/hash-string";
import {assembleUnit, AssembleUnitDeps} from "./assemble-unit";
import {readEffectiveContentText, UnitContentFile} from "./unit-content";

// Minimal authored shapes for building test fixtures -- just enough of the real schema for
// assembleUnit's own logic (ordinals, section resolution, hashing), not the full curriculum
// content schema.
interface TestSection {
  type: string;
  content: {tiles: Array<{id: string; content: {type: string; format: string; text: string}}>};
}
interface TestProblem {
  ordinal: number;
  title: string;
  sections: Array<TestSection | string | number>;
}
interface TestInvestigation {
  ordinal: number;
  title: string;
  problems: TestProblem[];
}
interface TestRootContent {
  title: string;
  investigations: TestInvestigation[];
  sections?: Record<string, {title?: string}>;
}

// Every fixture file below sets `updateText`, so readEffectiveContentText's first branch
// (pending edit wins) returns before it would ever touch the Realtime Database or GitHub -- these
// tests run with no Firebase app initialized and no network access, and would fail loudly (not
// silently) if a code path ever needed real infrastructure.
function file(
  path: string, content: TestRootContent | TestSection, overrides: Partial<UnitContentFile> = {}
): UnitContentFile {
  return {path, escapedPath: path, updateText: JSON.stringify(content), ...overrides};
}

function rootContent(
  investigations: TestInvestigation[], sections?: Record<string, {title?: string}>
): TestRootContent {
  return {title: "Test Unit", investigations, ...(sections ? {sections} : {})};
}

function textSection(text: string, type = "section"): TestSection {
  return {type, content: {tiles: [{id: "t1", content: {type: "Text", format: "markdown", text}}]}};
}

function depsFor(inventory: UnitContentFile[]): AssembleUnitDeps {
  return {loadInventory: async () => inventory, readText: readEffectiveContentText};
}

describe("assembleUnit", () => {
  it("computes ordinals from authored values, not position", async () => {
    const root = rootContent([
      {ordinal: 0, title: "Getting Started", problems: [
        {ordinal: 1, title: "P0.1", sections: [textSection("intro")]},
        {ordinal: 5, title: "P0.5", sections: [textSection("skip ahead")]},
      ]},
      {ordinal: 2, title: "Investigation 2", problems: [
        {ordinal: 1, title: "P2.1", sections: [textSection("inv2")]},
      ]},
    ]);
    const result = await assembleUnit("branch", "unit", depsFor([file("content.json", root)]));
    expect(result.sourceManifest.map((p) => p.ordinal)).toEqual(["0.1", "0.5", "2.1"]);
  });

  it("rejects a unit with a duplicate problem ordinal", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [
        {ordinal: 1, title: "First", sections: []},
        {ordinal: 1, title: "Duplicate", sections: []},
      ]},
    ]);
    await expect(assembleUnit("branch", "unit", depsFor([file("content.json", root)])))
      .rejects.toThrow(/duplicate/i);
  });

  it("orders problems by array position across investigations, not by ordinal value", async () => {
    const root = rootContent([
      {ordinal: 5, title: "First in the array", problems: [{ordinal: 1, title: "A", sections: [textSection("A")]}]},
      {ordinal: 1, title: "Second in the array, lower ordinal", problems: [
        {ordinal: 1, title: "B", sections: [textSection("B")]},
      ]},
    ]);
    const result = await assembleUnit("branch", "unit", depsFor([file("content.json", root)]));
    expect(result.sourceManifest.map((p) => p.ordinal)).toEqual(["5.1", "1.1"]);
  });

  it("handles a mix of inline and external sections in one problem", async () => {
    const externalPath = "investigation-1/problem-1/second/content.json";
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [
        {ordinal: 1, title: "P1", sections: [textSection("inline text"), externalPath]},
      ]},
    ]);
    const inventory = [
      file("content.json", root),
      file(externalPath, textSection("external text")),
    ];
    const result = await assembleUnit("branch", "unit", depsFor(inventory));
    expect(result.problems[0].markdown).toContain("inline text");
    expect(result.problems[0].markdown).toContain("external text");
  });

  it("resolves an external section reference under a nonstandard filename", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [
        {ordinal: 1, title: "P1", sections: ["investigation-1/problem-1/notes.json"]},
      ]},
    ]);
    const inventory = [
      file("content.json", root),
      file("investigation-1/problem-1/notes.json", textSection("nonstandard file content")),
    ];
    const result = await assembleUnit("branch", "unit", depsFor(inventory));
    expect(result.problems[0].markdown).toContain("nonstandard file content");
  });

  it("excludes files never reached by the walk (teacher guides, orphans)", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [{ordinal: 1, title: "P1", sections: [textSection("student content")]}]},
    ]);
    const inventory = [
      file("content.json", root),
      file("teacher-guide/investigation-1/problem-1/content.json", textSection("teacher-only content")),
      file("investigation-1/problem-1/orphan/content.json", textSection("orphaned content")),
    ];
    const result = await assembleUnit("branch", "unit", depsFor(inventory));
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].markdown).toContain("student content");
    expect(result.problems[0].markdown).not.toContain("teacher-only content");
    expect(result.problems[0].markdown).not.toContain("orphaned content");
  });

  it("fails clearly, naming the problem and path, when a referenced section is missing", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [
        {ordinal: 3, title: "P1", sections: ["investigation-1/problem-3/missing/content.json"]},
      ]},
    ]);
    await expect(assembleUnit("branch", "unit", depsFor([file("content.json", root)])))
      .rejects.toThrow(/Problem 1\.3.*missing\/content\.json/);
  });

  it("fails clearly for a section of an unrecognized shape", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [{ordinal: 1, title: "P1", sections: [42]}]},
    ]);
    await expect(assembleUnit("branch", "unit", depsFor([file("content.json", root)])))
      .rejects.toThrow(/unrecognized shape/i);
  });

  it("prefers a pending unsaved edit over committed content", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [
        {ordinal: 1, title: "P1", sections: ["investigation-1/problem-1/first/content.json"]},
      ]},
    ]);
    const inventory = [
      file("content.json", root),
      // sha is set (as if committed content exists) but must never be dereferenced -- this test
      // has no Firebase app initialized, so touching it would throw, not silently succeed.
      file("investigation-1/problem-1/first/content.json", textSection("pending edit content"),
        {sha: "committed-blob-sha"}),
    ];
    const result = await assembleUnit("branch", "unit", depsFor(inventory));
    expect(result.problems[0].markdown).toContain("pending edit content");
  });

  it("produces a stable sourceHash and sourceManifest for unchanged content", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [
        {ordinal: 1, title: "P1", sections: [textSection("problem one content")]},
        {ordinal: 2, title: "P2", sections: [textSection("problem two content")]},
      ]},
    ]);
    const a = await assembleUnit("branch", "unit", depsFor([file("content.json", root)]));
    const b = await assembleUnit("branch", "unit", depsFor([file("content.json", root)]));
    expect(a.sourceHash).toEqual(b.sourceHash);
    expect(a.sourceManifest).toEqual(b.sourceManifest);
  });

  it("changes problemHash only for the edited problem, and always changes sourceHash", async () => {
    const before = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [
        {ordinal: 1, title: "P1", sections: [textSection("problem one content")]},
        {ordinal: 2, title: "P2", sections: [textSection("problem two content")]},
      ]},
    ]);
    const after = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [
        {ordinal: 1, title: "P1", sections: [textSection("problem one EDITED content")]},
        {ordinal: 2, title: "P2", sections: [textSection("problem two content")]},
      ]},
    ]);
    const beforeResult = await assembleUnit("branch", "unit", depsFor([file("content.json", before)]));
    const afterResult = await assembleUnit("branch", "unit", depsFor([file("content.json", after)]));

    expect(afterResult.problems[0].problemHash).not.toEqual(beforeResult.problems[0].problemHash);
    expect(afterResult.problems[1].problemHash).toEqual(beforeResult.problems[1].problemHash);
    expect(afterResult.sourceHash).not.toEqual(beforeResult.sourceHash);
  });

  it("hashes with hashString, so problemHash and sourceHash are non-empty and deterministic", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [{ordinal: 1, title: "P1", sections: [textSection("content")]}]},
    ]);
    const result = await assembleUnit("branch", "unit", depsFor([file("content.json", root)]));
    // No dedup applies here (a single problem, single section), so the raw content problemHash is
    // hashed from equals markdown -- see the interaction tests below for the case where it doesn't.
    expect(result.problems[0].problemHash).toEqual(hashString(result.problems[0].markdown));
    expect(result.sourceHash).toEqual(hashString(result.problems.map((p) => p.problemHash).join("\n")));
  });

  it("summarizes a Drawing tile's text and image labels, without its geometry", async () => {
    // Not routed through textSection() -- this needs a Drawing tile's own content shape, which
    // TestSection's interface does not model.
    const drawingSection = {
      type: "section",
      content: {
        tiles: [{
          id: "d1",
          content: {
            type: "Drawing",
            objects: [
              {id: "t1", type: "text", x: 0, y: 0, width: 50, height: 20, text: "Step 1: mix"},
              {
                id: "i1", type: "image", x: 0, y: 0, width: 100, height: 80,
                url: "curriculum/images/beaker.png",
              },
              {id: "r1", type: "rectangle", x: 0, y: 0, width: 10, height: 10, fill: "#0069ff"},
            ],
          },
        }],
      },
    };
    const root = rootContent([
      {
        ordinal: 1, title: "Inv 1",
        problems: [{ordinal: 1, title: "P1", sections: [drawingSection as unknown as TestSection]}],
      },
    ]);
    const result = await assembleUnit("branch", "unit", depsFor([file("content.json", root)]));
    const markdown = result.problems[0].markdown;
    expect(markdown).toContain("Text in the drawing: \"Step 1: mix\"");
    expect(markdown).toContain("Image in the drawing: beaker.png");
    expect(markdown).not.toContain("r1");
    expect(markdown).not.toContain("#0069ff");
    expect(markdown).not.toContain("rx=");
  });

  it("heads each section with its authored name, in order, so a digest can tell them apart", async () => {
    const root = rootContent(
      [{
        ordinal: 1, title: "Inv 1",
        problems: [{
          ordinal: 1, title: "P1",
          sections: [textSection("intro text", "intro"), textSection("design text", "programming")],
        }],
      }],
      {intro: {title: "Investigate"}, programming: {title: "Design"}}
    );
    const result = await assembleUnit("branch", "unit", depsFor([file("content.json", root)]));
    const markdown = result.problems[0].markdown;
    expect(markdown.indexOf("# Section: Investigate")).toBeGreaterThanOrEqual(0);
    expect(markdown.indexOf("# Section: Investigate")).toBeLessThan(markdown.indexOf("# Section: Design"));
  });

  it("falls back to the section's own type key when the unit has no title registered for it", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [{ordinal: 1, title: "P1", sections: [textSection("text", "labWork")]}]},
    ]); // no `sections` map at all -- nothing to look a title up in
    const result = await assembleUnit("branch", "unit", depsFor([file("content.json", root)]));
    expect(result.problems[0].markdown).toContain("# Section: labWork");
  });

  it("points a section byte-identical to an earlier problem's at that first occurrence", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [
        {ordinal: 1, title: "P1", sections: [textSection("shared help text", "help")]},
        {ordinal: 2, title: "P2", sections: [textSection("shared help text", "help")]},
      ]},
    ]);
    const result = await assembleUnit("branch", "unit", depsFor([file("content.json", root)]));
    expect(result.problems[0].markdown).toContain("shared help text");
    expect(result.problems[1].markdown).not.toContain("shared help text");
    expect(result.problems[1].markdown).toContain("(same \"help\" content as problem 1.1)");
  });

  it("points every later duplicate section at the true first occurrence, not the previous duplicate", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [
        {ordinal: 1, title: "P1", sections: [textSection("shared help text", "help")]},
        {ordinal: 2, title: "P2", sections: [textSection("shared help text", "help")]},
        {ordinal: 3, title: "P3", sections: [textSection("shared help text", "help")]},
      ]},
    ]);
    const result = await assembleUnit("branch", "unit", depsFor([file("content.json", root)]));
    expect(result.problems[1].markdown).toContain("(same \"help\" content as problem 1.1)");
    expect(result.problems[2].markdown).toContain("(same \"help\" content as problem 1.1)");
  });

  it("gives byte-identical problems the same problemHash despite section dedup rewriting later ones", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [
        {ordinal: 1, title: "P1", sections: [textSection("shared help text", "help")]},
        {ordinal: 2, title: "P2", sections: [textSection("shared help text", "help")]},
        {ordinal: 3, title: "P3", sections: [textSection("shared help text", "help")]},
      ]},
    ]);
    const result = await assembleUnit("branch", "unit", depsFor([file("content.json", root)]));
    // 1.2 and 1.3's markdown is rewritten to "(same content as...)" pointers (see the test above),
    // but all three problems' real content is byte-identical, so whole-problem dedup
    // (unit-summary-digest.ts) needs their hashes to agree too -- otherwise the second problem gets
    // a real, wasted digest call over pointer text instead of being skipped as a duplicate.
    expect(result.problems[1].problemHash).toEqual(result.problems[0].problemHash);
    expect(result.problems[2].problemHash).toEqual(result.problems[0].problemHash);
  });

  it("does not dedupe sections with different content, even with the same section type", async () => {
    const root = rootContent([
      {ordinal: 1, title: "Inv 1", problems: [
        {ordinal: 1, title: "P1", sections: [textSection("first problem's own text", "help")]},
        {ordinal: 2, title: "P2", sections: [textSection("a different problem's own text", "help")]},
      ]},
    ]);
    const result = await assembleUnit("branch", "unit", depsFor([file("content.json", root)]));
    expect(result.problems[1].markdown).toContain("a different problem's own text");
    expect(result.problems[1].markdown).not.toContain("(same");
  });
});
