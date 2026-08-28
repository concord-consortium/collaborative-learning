import {
  applyKeyMap, KeyMapFile, KeyMapRefused, validateKeyMapFile
} from "../src/key-map.js";
import { CorpusManifest, ManifestDocument } from "../src/schemas.js";

/**
 * A manifest entry as `import` leaves one: content-derived fields set, every provenance field null.
 * @param {string} id The document id.
 * @param {Partial<ManifestDocument>} overrides Fields a case needs set differently.
 * @return {ManifestDocument} The entry.
 */
function documentEntry(id: string, overrides: Partial<ManifestDocument> = {}): ManifestDocument {
  return {
    id,
    file: `documents/${id}.json`,
    source: "production",
    contentSha256: `sha-${id}`,
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

function manifestOf(...documents: ManifestDocument[]): CorpusManifest {
  return { schemaVersion: 1, name: "demo", createdAt: "2026-08-11T00:00:00.000Z", documents };
}

const kMapEntry = {
  key: "ozljhdsh", uid: "1018417", unit: "msa", investigation: "1", problem: "1",
  modality: "mixed"
};

function keyMapOf(contextId: string | null, documents: KeyMapFile["documents"]): KeyMapFile {
  return { schemaVersion: 1, contextId, documents };
}

const kContext = { keyMapFile: "/data/exports/demo/key-map.json", corpusName: "demo" };

describe("validateKeyMapFile", () => {
  it("refuses anything that is not a version-1 key map", () => {
    expect(() => validateKeyMapFile({ schemaVersion: 2, documents: {} }, "km.json"))
      .toThrow(KeyMapRefused);
    expect(() => validateKeyMapFile({ schemaVersion: 1 }, "km.json")).toThrow(/version-1 key map/);
    expect(() => validateKeyMapFile(null, "km.json")).toThrow(/version-1 key map/);
  });

  it("accepts one, and names the file it was unhappy with", () => {
    const file = keyMapOf("ctx-1", { "p1-1-aabbccdd": kMapEntry });
    expect(validateKeyMapFile(file, "km.json")).toBe(file);
    expect(() => validateKeyMapFile({ schemaVersion: 9 }, "/tmp/wrong.json"))
      .toThrow(/^\/tmp\/wrong\.json /);
  });
});

describe("applying a key map to a corpus", () => {
  it("fills every null provenance field, labels included, and counts each write", () => {
    const manifest = manifestOf(documentEntry("p1-1-aabbccdd"));
    const result = applyKeyMap(manifest, keyMapOf("ctx-1", { "p1-1-aabbccdd": kMapEntry }), kContext);

    const entry = manifest.documents[0];
    expect({ unit: entry.unit, investigation: entry.investigation, problem: entry.problem,
      contextId: entry.contextId }).toEqual({ unit: "msa", investigation: "1", problem: "1",
      contextId: "ctx-1" });
    // The three labels are writes like any other, so they are inside `filled` — four fields plus
    // three labels. Counting them separately, or not at all, is what made an earlier run report a
    // number that did not describe what it had done.
    expect(entry.labels)
      .toEqual({ sourceKey: "ozljhdsh", sourceUid: "1018417", surveyModality: "mixed" });
    expect(result).toEqual({ matched: 1, filled: 7, alreadySet: 0, unmatched: [] });
  });

  it("re-running writes nothing and says so: every field is already set", () => {
    const manifest = manifestOf(documentEntry("p1-1-aabbccdd"));
    const keyMap = keyMapOf("ctx-1", { "p1-1-aabbccdd": kMapEntry });
    applyKeyMap(manifest, keyMap, kContext);
    const again = applyKeyMap(manifest, keyMap, kContext);
    // `filled: 0` with `alreadySet` covering the same seven fields is the honest report of a
    // second run. A `filled` that counted matches rather than writes would repeat the first run's 7.
    expect(again).toEqual({ matched: 1, filled: 0, alreadySet: 7, unmatched: [] });
  });

  it("a field the key map has no value for bumps neither counter", () => {
    const manifest = manifestOf(documentEntry("p1-1-aabbccdd"));
    // No unit, a null problem, and no modality: three fields the key map is not offering. Only the
    // investigation, the contextId, and the two labels it does carry are writes.
    const result = applyKeyMap(manifest, keyMapOf("ctx-1", {
      "p1-1-aabbccdd": { key: "ozljhdsh", uid: "1018417", investigation: "1", problem: null }
    }), kContext);

    expect(result).toEqual({ matched: 1, filled: 4, alreadySet: 0, unmatched: [] });
    expect(manifest.documents[0].unit).toBeNull();
    expect(manifest.documents[0].problem).toBeNull();
    expect(manifest.documents[0].labels.surveyModality).toBeUndefined();
  });

  it("never overwrites a value a human set, and counts the refusal", () => {
    const manifest = manifestOf(documentEntry("p1-1-aabbccdd", {
      unit: "hand-set", labels: { sourceKey: "hand-set" }
    }));
    const result = applyKeyMap(manifest, keyMapOf("ctx-1", { "p1-1-aabbccdd": kMapEntry }), kContext);

    expect(manifest.documents[0].unit).toBe("hand-set");
    expect(manifest.documents[0].labels.sourceKey).toBe("hand-set");
    // Five written (investigation, problem, contextId, sourceUid, surveyModality), two declined.
    expect(result).toEqual({ matched: 1, filled: 5, alreadySet: 2, unmatched: [] });
  });

  it("reports key-map ids the corpus does not have, and leaves untouched what it does", () => {
    const manifest = manifestOf(documentEntry("p1-1-aabbccdd"), documentEntry("p1-1-eeff0011"));
    const result = applyKeyMap(manifest, keyMapOf("ctx-1", {
      "p1-1-aabbccdd": kMapEntry,
      "p9-9-99999999": { key: "gone", uid: "7" }
    }), kContext);

    expect(result.matched).toBe(1);
    expect(result.unmatched).toEqual(["p9-9-99999999"]);
    // The manifest entry the key map said nothing about keeps its nulls.
    expect(manifest.documents[1].contextId).toBeNull();
    expect(manifest.documents[1].labels).toEqual({});
  });
});

describe("a key map has to describe this corpus", () => {
  it("refuses one naming a different class", () => {
    const manifest = manifestOf(documentEntry("p1-1-aabbccdd", { contextId: "ctx-1" }));
    expect(() => applyKeyMap(manifest, keyMapOf("ctx-2", { "p1-1-aabbccdd": kMapEntry }), kContext))
      .toThrow(/describes class ctx-2, but corpus "demo" carries ctx-1/);
  });

  it("refuses one carrying no class at all, once the corpus has one", () => {
    const manifest = manifestOf(documentEntry("p1-1-aabbccdd", { contextId: "ctx-1" }));
    expect(() => applyKeyMap(manifest, keyMapOf(null, { "p1-1-aabbccdd": kMapEntry }), kContext))
      .toThrow(/carries no contextId.*already belongs to class ctx-1/s);
  });

  it("refuses a corpus that holds more than one class, whichever the key map names", () => {
    const manifest = manifestOf(
      documentEntry("p1-1-aabbccdd", { contextId: "ctx-1" }),
      documentEntry("p1-1-eeff0011", { contextId: "ctx-2" }));
    expect(() => applyKeyMap(manifest, keyMapOf("ctx-1", { "p1-1-aabbccdd": kMapEntry }), kContext))
      .toThrow(/refusing to patch a corpus with another class's key map/);
  });

  it("refuses before writing anything, so a rejected run leaves the manifest as it was", () => {
    const manifest = manifestOf(documentEntry("p1-1-aabbccdd", { contextId: "ctx-1" }));
    const before = JSON.parse(JSON.stringify(manifest));
    expect(() => applyKeyMap(manifest, keyMapOf("ctx-2", { "p1-1-aabbccdd": kMapEntry }), kContext))
      .toThrow(KeyMapRefused);
    expect(manifest).toEqual(before);
  });

  it("has nothing to check on a fresh manifest, and applies", () => {
    // Every contextId is null right after import, so the class cannot be compared. What protects
    // this case is that ids are hashes of document keys: another class's key map shares none.
    const manifest = manifestOf(documentEntry("p1-1-aabbccdd"));
    const result = applyKeyMap(manifest, keyMapOf("ctx-1", { "p1-1-aabbccdd": kMapEntry }), kContext);
    expect(result.matched).toBe(1);
    expect(manifest.documents[0].contextId).toBe("ctx-1");
  });

  it("matches nothing when the key map belongs to another class's documents", () => {
    // The fresh-manifest case above with a foreign key map: disjoint ids, so `matched` is 0 and
    // every id is unmatched. apply-key-map.ts turns that into a non-zero exit.
    const manifest = manifestOf(documentEntry("p1-1-aabbccdd"));
    const result = applyKeyMap(manifest, keyMapOf("ctx-2", {
      "p1-1-12345678": kMapEntry, "p1-2-87654321": kMapEntry
    }), kContext);

    expect(result.matched).toBe(0);
    expect(result.filled).toBe(0);
    expect(result.unmatched).toEqual(["p1-1-12345678", "p1-2-87654321"]);
    expect(manifest.documents[0].contextId).toBeNull();
  });
});
