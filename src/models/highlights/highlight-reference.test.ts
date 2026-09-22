import {
  HighlightReference, highlightTargetKey, registerReferenceResolver,
  resolveHighlightReference, sameHighlightReference
} from "./highlight-reference";

// Resolvers take the document content model, but the object resolver never reads it, so a bare
// cast keeps this file free of MST setup. The variable resolver, which does read it, is
// registered by the shared-variables plugin and tested there.
const noContent = {} as any;

describe("highlightTargetKey", () => {
  it("joins tileId and objectId", () => {
    expect(highlightTargetKey("tile1", "node7")).toBe("tile1/node7");
  });
});

describe("sameHighlightReference", () => {
  it("matches identical object references", () => {
    const a: HighlightReference = { kind: "object", tileId: "t1", objectId: "o1" };
    const b: HighlightReference = { kind: "object", tileId: "t1", objectId: "o1" };
    expect(sameHighlightReference(a, b)).toBe(true);
  });

  it("distinguishes different object ids", () => {
    const a: HighlightReference = { kind: "object", tileId: "t1", objectId: "o1" };
    const b: HighlightReference = { kind: "object", tileId: "t1", objectId: "o2" };
    expect(sameHighlightReference(a, b)).toBe(false);
  });

  it("matches identical variable references", () => {
    expect(sameHighlightReference(
      { kind: "variable", variableId: "v1" },
      { kind: "variable", variableId: "v1" }
    )).toBe(true);
  });

  it("never matches across kinds", () => {
    expect(sameHighlightReference(
      { kind: "object", tileId: "t1", objectId: "v1" },
      { kind: "variable", variableId: "v1" }
    )).toBe(false);
  });
});

describe("resolveHighlightReference", () => {
  it("resolves an object reference to itself", () => {
    const ref: HighlightReference = {
      kind: "object", tileId: "tile1", objectId: "node7", objectType: "Node"
    };
    expect(resolveHighlightReference(ref, noContent))
      .toEqual([{ tileId: "tile1", objectId: "node7", objectType: "Node" }]);
  });

  it("returns [] for an unregistered kind", () => {
    expect(resolveHighlightReference({ kind: "nope" } as any, noContent)).toEqual([]);
  });

  it("uses the most recently registered resolver for a kind", () => {
    // The registry is module-global, so this test must restore the real resolver rather than
    // leaving a stub behind for every test that runs after it in this file.
    const originalResults = resolveHighlightReference(
      { kind: "object", tileId: "t", objectId: "o" }, noContent
    );
    const restore = () => registerReferenceResolver("object", ref => {
      if (ref.kind !== "object") return [];
      return [{ tileId: ref.tileId, objectId: ref.objectId, objectType: ref.objectType }];
    });

    try {
      registerReferenceResolver("object", () => [{ tileId: "stub", objectId: "stub" }]);
      expect(resolveHighlightReference(
        { kind: "object", tileId: "t", objectId: "o" }, noContent
      )).toEqual([{ tileId: "stub", objectId: "stub" }]);
    } finally {
      restore();
    }

    // The real resolver is back in place for anything that runs after this.
    expect(resolveHighlightReference(
      { kind: "object", tileId: "t", objectId: "o" }, noContent
    )).toEqual(originalResults);
  });
});
