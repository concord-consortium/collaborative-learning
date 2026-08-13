import {
  HighlightReference, highlightTargetKey, registerReferenceResolver,
  resolveHighlightReference, sameHighlightReference
} from "./highlight-reference";

// The resolvers take the document content model, but the object resolver never reads it, so a
// bare cast keeps this file free of MST setup. The variable resolver, which does read it, gets
// real document content in its own describe block below.
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

describe("the variable resolver", () => {
  // A minimal stand-in for the content model. The resolver only walks tileMap and calls
  // getObjectsForVariable, so this is the entire surface it touches.
  const contentWithTiles = (tiles: Array<{ id: string; objects?: any[] }>) => ({
    tileMap: new Map(tiles.map(t => [t.id, {
      id: t.id,
      content: t.objects
        ? { getObjectsForVariable: () => t.objects }
        : {} // a tile that does not implement the hook at all
    }]))
  }) as any;

  it("collects objects from every tile that implements the hook", () => {
    const content = contentWithTiles([
      { id: "df1", objects: [{ objectId: "n1", objectType: "Node" }] },
      { id: "df2", objects: [{ objectId: "n2", objectType: "Node" }] }
    ]);
    expect(resolveHighlightReference({ kind: "variable", variableId: "v1" }, content)).toEqual([
      { tileId: "df1", objectId: "n1", objectType: "Node" },
      { tileId: "df2", objectId: "n2", objectType: "Node" }
    ]);
  });

  it("skips tiles that do not implement the hook", () => {
    const content = contentWithTiles([
      { id: "text1" },
      { id: "df1", objects: [{ objectId: "n1", objectType: "Node" }] }
    ]);
    expect(resolveHighlightReference({ kind: "variable", variableId: "v1" }, content))
      .toEqual([{ tileId: "df1", objectId: "n1", objectType: "Node" }]);
  });

  it("returns [] when no tile has a matching object", () => {
    const content = contentWithTiles([{ id: "df1", objects: [] }]);
    expect(resolveHighlightReference({ kind: "variable", variableId: "v1" }, content)).toEqual([]);
  });

  // Self-healing: resolution is re-run against current state every time, so a target that
  // disappears simply stops being returned. This is why a deleted node cannot leave a stale
  // highlight behind — unlike sparrows, which orphan because deleteTile never touches
  // `annotations` (base-document-content.ts:950-984).
  it("drops targets that no longer exist", () => {
    const objects = [{ objectId: "n1", objectType: "Node" }];
    const content = contentWithTiles([{ id: "df1", objects }]);
    expect(resolveHighlightReference({ kind: "variable", variableId: "v1" }, content)).toHaveLength(1);

    objects.length = 0;   // the node was deleted from the program
    expect(resolveHighlightReference({ kind: "variable", variableId: "v1" }, content)).toEqual([]);
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
