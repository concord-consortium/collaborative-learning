import { annotationsSummary } from "./annotations-summary";
import { NormalizedAnnotation, TileMap } from "./ai-summarizer-types";

function params(annotations: NormalizedAnnotation[], tileMap: TileMap, minimal = false) {
  return { annotations, tileMap, dataSets: [], variables: [], options: { minimal }, headingLevel: 1 };
}

// An Expression tile has no describer, so every endpoint here falls to the generic backstop.
const expressionTiles: TileMap = {
  t1: { id: "t1", title: "My work", content: { type: "Expression", objects: [{ id: "o1", type: "blob" }] } }
};

describe("annotationsSummary", () => {
  it("writes nothing for a document with no sparrows", () => {
    expect(annotationsSummary(params([], expressionTiles))).toBe("");
  });

  it("renders a two-sided sparrow as an edge labelled with the student's text", () => {
    const result = annotationsSummary(params([{
      id: "a1",
      text: "+10",
      sourceObject: { tileId: "t1", objectId: "o1" },
      targetObject: { tileId: "t1", objectId: "o2" }
    }], expressionTiles));

    expect(result).toContain("## Sparrows");
    expect(result).toContain("digraph sparrows {");
    expect(result).toContain('"t1:o1" -> "t1:o2" [label="+10"];');
    expect(result).toContain("This document has 1 sparrow.");
  });

  // An unknown tile type must be clumsy, never silent: this is what a ninth tile type gets until
  // someone writes it a describer.
  it("labels an object in a tile with no describer from the raw tile JSON", () => {
    const result = annotationsSummary(params([{
      id: "a1",
      sourceObject: { tileId: "t1", objectId: "o1" },
      targetObject: { tileId: "t1", objectId: "o2" }
    }], expressionTiles));

    expect(result).toContain('"t1:o1" [label="blob o1 — Expression \\"My work\\""];');
    expect(result).toContain('"t1:o2" [label="object o2 — Expression \\"My work\\""];');
  });

  it("emits no label attribute for a sparrow the student left untitled", () => {
    const result = annotationsSummary(params([{
      id: "a1",
      sourceObject: { tileId: "t1", objectId: "o1" },
      targetObject: { tileId: "t1", objectId: "o2" }
    }], expressionTiles));

    expect(result).toContain('"t1:o1" -> "t1:o2";');
  });

  // The arrowhead is drawn at the target end, so edge direction is the whole of what a one-sided
  // sparrow means: at an object is a label, away from it is a callout.
  it("points a one-sided sparrow at its object when the object is the target", () => {
    const result = annotationsSummary(params([{
      id: "a1",
      text: ">2",
      targetObject: { tileId: "t1", objectId: "o1" }
    }], expressionTiles));

    expect(result).toContain('"free1" [label="empty space", shape=point];');
    expect(result).toContain('"free1" -> "t1:o1" [label=">2"];');
  });

  it("points a one-sided sparrow away from its object when the object is the source", () => {
    const result = annotationsSummary(params([{
      id: "a1",
      text: "see here",
      sourceObject: { tileId: "t1", objectId: "o1" }
    }], expressionTiles));

    expect(result).toContain('"t1:o1" -> "free1" [label="see here"];');
  });

  // Repeated relations are the point: three anchors joined by two "+10" sparrows have to read as
  // one path through shared nodes, not as two unrelated arrows.
  it("joins a repeated relation into a path through shared nodes", () => {
    const result = annotationsSummary(params([
      { id: "a1", text: "+10", sourceObject: { tileId: "t1", objectId: "o1" },
        targetObject: { tileId: "t1", objectId: "o2" } },
      { id: "a2", text: "+10", sourceObject: { tileId: "t1", objectId: "o2" },
        targetObject: { tileId: "t1", objectId: "o3" } }
    ], expressionTiles));

    expect(result).toContain('"t1:o1" -> "t1:o2" [label="+10"];');
    expect(result).toContain('"t1:o2" -> "t1:o3" [label="+10"];');
    // Anchored to the start of a line: the same text ends the edge that points at the node.
    expect(result.match(/^ {2}"t1:o2" \[label=/gm)).toHaveLength(1);
  });

  it("names a tile with no title by its type alone", () => {
    const result = annotationsSummary(params([{
      id: "a1",
      sourceObject: { tileId: "t2", objectId: "o1" },
      targetObject: { tileId: "t2", objectId: "o2" }
    }], { t2: { id: "t2", content: { type: "Expression" } } }));

    expect(result).toContain('"t2:o1" [label="object o1 — Expression"];');
  });

  // A student's own text is the one thing in the label this code did not write.
  it("escapes a quote and a newline in the student's text", () => {
    const result = annotationsSummary(params([{
      id: "a1",
      text: 'goes up by "10"\nevery time',
      sourceObject: { tileId: "t1", objectId: "o1" },
      targetObject: { tileId: "t1", objectId: "o2" }
    }], expressionTiles));

    expect(result).toContain('[label="goes up by \\"10\\"\\nevery time"];');
  });

  it("drops the explanatory paragraph under minimal but keeps the graph", () => {
    const result = annotationsSummary(params([{
      id: "a1",
      sourceObject: { tileId: "t1", objectId: "o1" },
      targetObject: { tileId: "t1", objectId: "o2" }
    }], expressionTiles, true));

    expect(result).not.toContain("A sparrow is an arrow");
    expect(result).toContain("digraph sparrows {");
    expect(result).toContain("This document has 1 sparrow.");
  });
});

describe("annotationsSummary with endpoints that no longer exist", () => {
  // Nothing prunes an annotation when its anchor is deleted: the arrow stops rendering, but the
  // annotation stays in the document. A skipped sparrow is one the teacher cannot see either.
  const tileMap: TileMap = { t1: { id: "t1", content: { type: "Expression" } } };

  it("skips a sparrow anchored to a tile that is gone, and says so", () => {
    const result = annotationsSummary(params([
      { id: "a1", sourceObject: { tileId: "t1", objectId: "o1" },
        targetObject: { tileId: "t1", objectId: "o2" } },
      { id: "a2", sourceObject: { tileId: "gone", objectId: "o3" },
        targetObject: { tileId: "t1", objectId: "o1" } }
    ], tileMap));

    expect(result).not.toContain("gone:o3");
    expect(result).toContain("This document has 2 sparrows.");
    expect(result).toContain("One is not shown");
  });

  it("counts several missing sparrows in the plural", () => {
    const result = annotationsSummary(params([
      { id: "a1", sourceObject: { tileId: "gone", objectId: "o1" } },
      { id: "a2", sourceObject: { tileId: "gone", objectId: "o2" } }
    ], tileMap));

    expect(result).toContain("This document has 2 sparrows.");
    expect(result).toContain("Both are not shown");
  });

  it("declares no node for the surviving end of a skipped sparrow", () => {
    const result = annotationsSummary(params([
      { id: "a1", sourceObject: { tileId: "gone", objectId: "o3" },
        targetObject: { tileId: "t1", objectId: "o1" } }
    ], tileMap));

    expect(result).not.toContain('"t1:o1" [label=');
  });
});
