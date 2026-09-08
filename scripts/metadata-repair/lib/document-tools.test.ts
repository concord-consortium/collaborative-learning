import { toolsFromDocumentNode } from "./document-tools";

const nodeWith = (tileTypes: string[], annotationTypes: string[] = []) => ({
  self: { uid: "u1", documentKey: "k1", classHash: "c1" },
  version: "1.0",
  type: "personal",
  content: JSON.stringify({
    tileMap: Object.fromEntries(tileTypes.map((type, i) => [`t${i}`, { content: { type } }])),
    annotations: Object.fromEntries(annotationTypes.map((type, i) => [`a${i}`, { type }]))
  })
});

describe("toolsFromDocumentNode", () => {
  it("lists the tile types the document uses", () => {
    expect(toolsFromDocumentNode(nodeWith(["Text", "Table"]))).toEqual(["Text", "Table"]);
  });

  it("lists a repeated tile type once", () => {
    expect(toolsFromDocumentNode(nodeWith(["Text", "Text", "Drawing"]))).toEqual(["Text", "Drawing"]);
  });

  it("counts a Sparrow annotation as a tool, because that is how Sort Work groups it", () => {
    expect(toolsFromDocumentNode(nodeWith(["Text"], ["arrowAnnotation"]))).toEqual(["Text", "Sparrow"]);
  });

  it("adds Sparrow once however many arrows the document has", () => {
    expect(toolsFromDocumentNode(nodeWith(["Text"], ["arrowAnnotation", "arrowAnnotation"])))
      .toEqual(["Text", "Sparrow"]);
  });

  it("ignores an annotation that is not an arrow", () => {
    expect(toolsFromDocumentNode(nodeWith(["Text"], ["someOtherAnnotation"]))).toEqual(["Text"]);
  });

  it("returns no tools for a document whose tile map is empty", () => {
    expect(toolsFromDocumentNode(nodeWith([]))).toEqual([]);
  });

  it("returns no tools for a document that was created but never saved", () => {
    // 44 of demo/Joe4's 145 nodes look like this: self, type and version, with no content key at
    // all, because nothing was ever written into the document. It has no tiles, and saying so is
    // more useful than declining to answer.
    const node = { self: { uid: "u1", documentKey: "k1", classHash: "c1" }, type: "learningLog", version: "1.0" };
    expect(toolsFromDocumentNode(node)).toEqual([]);
  });

  it("returns no tools for content with no tile map, which older documents omit", () => {
    expect(toolsFromDocumentNode({ content: "{}" })).toEqual([]);
  });

  it("skips a tile whose content has no type rather than listing an undefined tool", () => {
    const content = JSON.stringify({ tileMap: { t0: { content: {} }, t1: { content: { type: "Text" } } } });
    expect(toolsFromDocumentNode({ content })).toEqual(["Text"]);
  });

  it("reports unparseable content as undefined, which is not the same as having no tools", () => {
    // A row written with `tools: []` would claim the document is empty. Undefined lets the caller say
    // it could not tell.
    expect(toolsFromDocumentNode({ content: "{not json" })).toBeUndefined();
  });

  it("reports a node it could not read as undefined", () => {
    expect(toolsFromDocumentNode(null)).toBeUndefined();
  });
});
