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

function rootContent(investigations: TestInvestigation[]): TestRootContent {
  return {title: "Test Unit", investigations};
}

function textSection(text: string): TestSection {
  return {type: "section", content: {tiles: [{id: "t1", content: {type: "Text", format: "markdown", text}}]}};
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
    expect(result.problems[0].problemHash).toEqual(hashString(result.problems[0].markdown));
    expect(result.sourceHash).toEqual(hashString(result.problems.map((p) => p.markdown).join("\n\n")));
  });
});
