import { resolveTileLogContext } from "./logger-utils";

// Minimal stand-ins for the pieces of a document the helper reads.
function fakeDocument(tileId: string, title: string, type: string) {
  return {
    content: {
      getTile: () => ({ computedTitle: title }),
      getTileType: (id: string) => (id === tileId ? type : undefined),
      getSectionIdForTile: () => "section-1",
    }
  } as any;
}

function fakeContext(byKey: Record<string, any>, byTile: Record<string, any>) {
  const empty = { getDocument: () => undefined, findDocumentOfTile: () => undefined };
  return {
    documents: {
      getDocument: (key: string) => byKey[key],
      findDocumentOfTile: (tileId: string) => byTile[tileId],
    },
    networkDocuments: empty,
  } as any;
}

describe("resolveTileLogContext", () => {
  it("uses the document it is handed without consulting the store", () => {
    const document = fakeDocument("t1", "My Tile", "Drawing");
    const result = resolveTileLogContext({ document, tileId: "t1" });
    expect(result).toEqual({ document, sectionId: "section-1", tileTitle: "My Tile", tileType: "Drawing" });
  });

  it("looks a document up by id", () => {
    const document = fakeDocument("t1", "My Tile", "Drawing");
    const result = resolveTileLogContext({ documentId: "doc-1", tileId: "t1" }, fakeContext({ "doc-1": document }, {}));
    expect(result.document).toBe(document);
    expect(result.tileType).toBe("Drawing");
  });

  it("finds a document by tile when no documentId was supplied", () => {
    const document = fakeDocument("t1", "My Tile", "Drawing");
    const result = resolveTileLogContext({ tileId: "t1" }, fakeContext({}, { t1: document }));
    expect(result.document).toBe(document);
  });

  it("does not substitute a different document when the documentId misses", () => {
    // The tile lookup must stay gated: a comment on document A whose key isn't loaded must not be
    // attributed to whatever other document happens to contain the tile.
    const otherDocument = fakeDocument("t1", "Some Other Tile", "Text");
    const result = resolveTileLogContext({ documentId: "missing", tileId: "t1" },
      fakeContext({}, { t1: otherDocument }));
    expect(result.document).toBeUndefined();
    expect(result.tileType).toBeUndefined();
    expect(result.tileTitle).toBe("<no title>");
  });

  it("stays null-safe when the Logger has no stores yet", () => {
    const result = resolveTileLogContext({ tileId: "t1" }, undefined);
    expect(result.document).toBeUndefined();
    expect(result.tileTitle).toBe("<no title>");
  });
});
