import fs from "node:fs";
import path from "node:path";
import {
  corpusPaths, importCorpus, readCorpusDocument, readManifest, representationIsFresh, representationPath,
  resolveCorpusFile, writeJsonFile
} from "../src/corpus.js";
import { makeTestDataRoot } from "./helpers.js";

const now = () => new Date("2026-08-11T00:00:00.000Z");

function sourceDir(root: string, documents: Record<string, unknown>): string {
  const directory = path.join(root, "source");
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, content] of Object.entries(documents)) {
    fs.writeFileSync(path.join(directory, name), JSON.stringify(content, null, 2));
  }
  return directory;
}

const textDoc = {
  rowOrder: ["row-1"],
  rowMap: { "row-1": { tiles: [{ tileId: "t1" }] } },
  tileMap: { t1: { id: "t1", content: { type: "Text", format: "markdown", text: "Our latch." } } }
};
const imageDoc = {
  rowOrder: ["row-1"],
  rowMap: { "row-1": { tiles: [{ tileId: "t1" }] } },
  tileMap: { t1: { id: "t1", content: { type: "Image" } } }
};

describe("corpus names cannot escape the artifact root", () => {
  const dataRoot = "/repo/scripts/ai-harness/data";

  it("builds paths under data/corpus for a valid name", () => {
    expect(corpusPaths(dataRoot, "synthetic-corpus").root)
      .toBe(path.join(dataRoot, "corpus", "synthetic-corpus"));
  });

  it.each([
    ["../../escaped"],
    [".."],
    ["../results"],
    ["nested/name"],
    ["/absolute"],
    ["Capitalized"],
    ["has space"],
    [""]
  ])("refuses %s", (corpus) => {
    expect(() => corpusPaths(dataRoot, corpus)).toThrow(/--corpus must match/);
  });

  it("is enforced for every command, not only import", () => {
    expect(() => importCorpus({
      from: ".", corpus: "../../escaped", source: "synthetic", prune: false, dataRoot, now
    })).toThrow(/--corpus must match/);
  });
});

describe("import", () => {
  it("writes a manifest with content hashes and computed modalities", () => {
    const dataRoot = makeTestDataRoot("import-basic");
    const from = sourceDir(dataRoot, { "a-text.json": textDoc, "b-image.json": imageDoc });
    const result = importCorpus({ from, corpus: "demo1", source: "synthetic", prune: false, dataRoot, now });

    expect(result.imported).toEqual(["a-text", "b-image"]);
    expect(result.manifest.documents.map((entry) => entry.computedModality)).toEqual(["text-only", "visual-only"]);
    expect(result.manifest.documents[0].contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.manifest.documents[0].retrievedAt).toBeNull();

    const paths = corpusPaths(dataRoot, "demo1");
    expect(fs.existsSync(path.join(paths.documents, "a-text.json"))).toBe(true);
    expect(readManifest(paths).documents).toHaveLength(2);
  });

  it("stamps a retrieval time on documents that came from somewhere", () => {
    const dataRoot = makeTestDataRoot("import-retrieved");
    const from = sourceDir(dataRoot, { "a-text.json": textDoc });
    const result = importCorpus({ from, corpus: "demo1", source: "demo", prune: false, dataRoot, now });
    expect(result.manifest.documents[0].retrievedAt).toBe("2026-08-11T00:00:00.000Z");
  });

  it("refuses the production source without the sign-off flag, importing nothing", () => {
    const dataRoot = makeTestDataRoot("import-production");
    const from = sourceDir(dataRoot, { "a-text.json": textDoc });
    expect(() => importCorpus({ from, corpus: "demo1", source: "production", prune: false, dataRoot, now }))
      .toThrow(/--production-data-approved/);
    expect(fs.existsSync(corpusPaths(dataRoot, "demo1").manifest)).toBe(false);
  });

  it("imports production documents when the sign-off flag is passed, stamped as production", () => {
    const dataRoot = makeTestDataRoot("import-production-approved");
    const from = sourceDir(dataRoot, { "a-text.json": textDoc });
    const result = importCorpus({
      from, corpus: "demo1", source: "production", prune: false,
      productionDataApproved: true, dataRoot, now
    });
    expect(result.imported).toEqual(["a-text"]);
    expect(result.manifest.documents[0].source).toBe("production");
    expect(result.manifest.documents[0].retrievedAt).toBe("2026-08-11T00:00:00.000Z");
  });

  it("ignores the sign-off flag for non-production sources rather than treating it as meaningful", () => {
    const dataRoot = makeTestDataRoot("import-approved-synthetic");
    const from = sourceDir(dataRoot, { "a-text.json": textDoc });
    const result = importCorpus({
      from, corpus: "demo1", source: "synthetic", prune: false,
      productionDataApproved: true, dataRoot, now
    });
    expect(result.manifest.documents[0].source).toBe("synthetic");
  });

  it("rejects a document id that is not kebab-case", () => {
    const dataRoot = makeTestDataRoot("import-bad-id");
    const from = sourceDir(dataRoot, { "Not Valid.json": textDoc });
    expect(() => importCorpus({ from, corpus: "demo1", source: "synthetic", prune: false, dataRoot, now }))
      .toThrow(/document id "Not Valid" must match/);
  });

  it("rejects a traversal attempt at the id pattern, the first line of defense", () => {
    const dataRoot = makeTestDataRoot("import-escape");
    const from = sourceDir(dataRoot, { "a-text.json": textDoc });
    fs.renameSync(path.join(from, "a-text.json"), path.join(from, "..-escape.json"));
    expect(() => importCorpus({ from, corpus: "demo1", source: "synthetic", prune: false, dataRoot, now }))
      .toThrow(/must match/);
  });

  it("refreshes computedModality but never touches modalityOverride or labels", () => {
    const dataRoot = makeTestDataRoot("import-override");
    const from = sourceDir(dataRoot, { "a-text.json": textDoc });
    importCorpus({ from, corpus: "demo1", source: "synthetic", prune: false, dataRoot, now });

    const paths = corpusPaths(dataRoot, "demo1");
    const manifest = readManifest(paths);
    manifest.documents[0].modalityOverride = "mixed";
    manifest.documents[0].labels = { category: "form" };
    manifest.documents[0].unit = "mods";
    writeJsonFile(paths.manifest, manifest);

    // The document changes to a visual one; the human override must survive untouched.
    fs.writeFileSync(path.join(from, "a-text.json"), JSON.stringify(imageDoc));
    const result = importCorpus({ from, corpus: "demo1", source: "synthetic", prune: false, dataRoot, now });
    expect(result.manifest.documents[0].computedModality).toBe("visual-only");
    expect(result.manifest.documents[0].modalityOverride).toBe("mixed");
    expect(result.manifest.documents[0].labels).toEqual({ category: "form" });
    expect(result.manifest.documents[0].unit).toBe("mods");
  });

  it("keeps an entry whose source file has disappeared, with a warning", () => {
    const dataRoot = makeTestDataRoot("import-missing");
    const from = sourceDir(dataRoot, { "a-text.json": textDoc, "b-image.json": imageDoc });
    importCorpus({ from, corpus: "demo1", source: "synthetic", prune: false, dataRoot, now });

    fs.rmSync(path.join(from, "b-image.json"));
    const result = importCorpus({ from, corpus: "demo1", source: "synthetic", prune: false, dataRoot, now });
    expect(result.missing).toEqual(["b-image"]);
    expect(result.manifest.documents).toHaveLength(2);
    expect(result.warnings.join("\n")).toContain("source file has disappeared");
  });

  it("removes it under --prune, along with its copied content and representations", () => {
    const dataRoot = makeTestDataRoot("import-prune");
    const from = sourceDir(dataRoot, { "a-text.json": textDoc, "b-image.json": imageDoc });
    importCorpus({ from, corpus: "demo1", source: "synthetic", prune: false, dataRoot, now });

    const paths = corpusPaths(dataRoot, "demo1");
    // Stand in for `represent` having run: envelopes for both variants.
    for (const variant of ["default", "minimal"]) {
      for (const id of ["a-text", "b-image"]) {
        writeJsonFile(representationPath(paths, variant, id), { schemaVersion: 1, docId: id });
      }
    }

    fs.rmSync(path.join(from, "b-image.json"));
    const result = importCorpus({ from, corpus: "demo1", source: "synthetic", prune: true, dataRoot, now });
    expect(result.pruned).toEqual(["b-image"]);
    expect(result.manifest.documents.map((entry) => entry.id)).toEqual(["a-text"]);

    // No unreachable copy of the document may linger once it has left the manifest.
    expect(fs.existsSync(path.join(paths.documents, "b-image.json"))).toBe(false);
    for (const variant of ["default", "minimal"]) {
      expect(fs.existsSync(representationPath(paths, variant, "b-image"))).toBe(false);
      expect(fs.existsSync(representationPath(paths, variant, "a-text"))).toBe(true);
    }
    expect(fs.existsSync(path.join(paths.documents, "a-text.json"))).toBe(true);
  });

  it("keeps the corpus createdAt across re-imports", () => {
    const dataRoot = makeTestDataRoot("import-created-at");
    const from = sourceDir(dataRoot, { "a-text.json": textDoc });
    const first = importCorpus({ from, corpus: "demo1", source: "synthetic", prune: false, dataRoot, now });
    const second = importCorpus({
      from, corpus: "demo1", source: "synthetic", prune: false, dataRoot, now: () => new Date("2027-01-01")
    });
    expect(second.manifest.createdAt).toBe(first.manifest.createdAt);
  });
});

describe("reading a document the manifest points at", () => {
  const dataRoot = makeTestDataRoot("corpus-file-escape");
  const from = sourceDir(dataRoot, { "a-text.json": textDoc });
  importCorpus({ from, corpus: "demo1", source: "synthetic", prune: false, dataRoot, now });
  const paths = corpusPaths(dataRoot, "demo1");
  const entry = readManifest(paths).documents[0];

  it("reads a document that sits inside the corpus", () => {
    expect(readCorpusDocument(paths, entry)).toEqual(textDoc);
  });

  it.each([
    ["../../escape.json"],
    ["documents/../../../escape.json"],
    ["/etc/passwd"]
  ])("refuses a hand-edited file field of %s", (file) => {
    expect(() => readCorpusDocument(paths, { ...entry, file }))
      .toThrow(/resolves outside the corpus directory/);
  });

  it("refuses the corpus root itself", () => {
    expect(() => resolveCorpusFile(paths, { ...entry, file: "." }))
      .toThrow(/resolves outside the corpus directory/);
  });
});

describe("representation staleness", () => {
  const envelope = {
    schemaVersion: 1,
    docId: "a-text",
    variantId: "default",
    variantVersion: 1,
    sourceContentSha256: "abc",
    generatedAt: "2026-08-11T00:00:00.000Z",
    markdown: "# CLUE Document Summary"
  };

  const identity = { docId: "a-text", variantId: "default", contentSha256: "abc", variantVersion: 1 };

  it("is decided by the envelope, not by the file existing", () => {
    expect(representationIsFresh(envelope, identity)).toBe(true);
    expect(representationIsFresh(envelope, { ...identity, contentSha256: "different" })).toBe(false);
    expect(representationIsFresh(envelope, { ...identity, variantVersion: 2 })).toBe(false);
  });

  it("checks identity too, so an envelope on the wrong path is not reused", () => {
    // A `default` envelope copied onto a `minimal` path would otherwise pass and make the two
    // variants identical.
    expect(representationIsFresh(envelope, { ...identity, variantId: "minimal" })).toBe(false);
    expect(representationIsFresh(envelope, { ...identity, docId: "b-image" })).toBe(false);
  });
});
