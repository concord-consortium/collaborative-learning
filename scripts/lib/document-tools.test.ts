import { toolsFromContent } from "./document-tools";

const contentWith = (tileTypes: string[], annotationTypes: string[] = []) => JSON.stringify({
  tileMap: Object.fromEntries(tileTypes.map((type, i) => [`t${i}`, { content: { type } }])),
  annotations: Object.fromEntries(annotationTypes.map((type, i) => [`a${i}`, { type }]))
});

describe("toolsFromContent", () => {
  it("lists the tile types the document uses", () => {
    expect(toolsFromContent(contentWith(["Text", "Table"]))).toEqual(["Text", "Table"]);
  });

  it("lists a repeated tile type once", () => {
    expect(toolsFromContent(contentWith(["Text", "Text", "Drawing"]))).toEqual(["Text", "Drawing"]);
  });

  it("counts a Sparrow annotation as a tool, because that is how Sort Work groups it", () => {
    expect(toolsFromContent(contentWith(["Text"], ["arrowAnnotation"]))).toEqual(["Text", "Sparrow"]);
  });

  it("adds Sparrow once however many arrows the document has", () => {
    expect(toolsFromContent(contentWith(["Text"], ["arrowAnnotation", "arrowAnnotation"])))
      .toEqual(["Text", "Sparrow"]);
  });

  it("ignores an annotation that is not an arrow", () => {
    expect(toolsFromContent(contentWith(["Text"], ["someOtherAnnotation"]))).toEqual(["Text"]);
  });

  it("returns no tools for a document with no tiles", () => {
    expect(toolsFromContent(contentWith([]))).toEqual([]);
  });

  it("returns no tools for content with neither map, which older documents omit", () => {
    expect(toolsFromContent("{}")).toEqual([]);
  });

  it("skips a tile whose content has no type rather than listing an undefined tool", () => {
    const content = JSON.stringify({ tileMap: { t0: { content: {} }, t1: { content: { type: "Text" } } } });
    expect(toolsFromContent(content)).toEqual(["Text"]);
  });

  it("reports unparseable content as undefined, which is not the same as having no tools", () => {
    // A row written with `tools: []` would claim the document is empty. Undefined lets the caller say
    // it could not tell.
    expect(toolsFromContent("{not json")).toBeUndefined();
  });

  it("reports absent content as undefined", () => {
    expect(toolsFromContent(undefined)).toBeUndefined();
  });
});
