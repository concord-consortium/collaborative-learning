import { drawingToTable } from "./drawing-to-table";

// Pins the example in drawing-to-table.ts's header comment. If this fails, the format changed and
// that comment is now wrong — update both, and prefer the output shown here over re-deriving it.
it("matches the documented example", () => {
  const result = drawingToTable({ objects: [
    { id: "a7Kd2", type: "rectangle", x: 40, y: 20, width: 120, height: 80,
      fill: "#0069ff", stroke: "#000000", strokeWidth: 2 },
    { id: "c3Mn8", type: "ellipse", x: 200, y: 100, rx: 30, ry: 30, fill: "none", stroke: "#d10000" },
    { id: "Dp47z", type: "variable", x: 320, y: 40, variableId: "v_speed" },
    { id: "Bq91x", type: "group", x: 100, y: 200, width: 200, height: 100, objects: [
      { id: "kid1", type: "rectangle", x: 0, y: 0, width: 0.5, height: 0.5, fill: "#00b400" },
      { id: "kid2", type: "vector", x: 0.5, y: 0.5, dx: 0.5, dy: 0.5, stroke: "#000000" }
    ]},
    { id: "t9Qr4", type: "text", x: 40, y: 320, width: 90, height: 20,
      text: "too fast", rotation: 90, visible: false }
  ]});

  expect(result).toBe(
`This tile contains a drawing with 7 objects, listed back to front. Position, size and rotation \
are in the tile's coordinate space, including for objects inside a group.

| id | type | position | size | rotation | parent | details |
| --- | --- | --- | --- | --- | --- | --- |
| a7Kd2 | rectangle | 40, 20 | 120 x 80 |  |  | fill=#0069ff stroke=#000000 strokeWidth=2 |
| c3Mn8 | ellipse | 170, 70 | 60 x 60 |  |  | rx=30 ry=30 fill=none stroke=#d10000 |
| Dp47z | variable | 320, 40 | 75 x 24 |  |  | variableId=v_speed estimatedSize |
| Bq91x | group | 100, 200 | 200 x 100 |  |  | 2 objects |
| kid1 | rectangle | 100, 200 | 100 x 50 |  | Bq91x | fill=#00b400 |
| kid2 | vector | 200, 250 | 100 x 50 |  | Bq91x | dx=0.5 dy=0.5 stroke=#000000 |
| t9Qr4 | text | 130, 250 | 20 x 90 | 90° |  | text="too fast" visible=false |`);
});

describe("drawingToTable", () => {
  it("returns the legacy sentence for an empty drawing", () => {
    expect(drawingToTable({ objects: [] })).toBe("This tile contains a drawing.");
    expect(drawingToTable({})).toBe("This tile contains a drawing.");
  });

  it("emits a row per object carrying its id and type", () => {
    const result = drawingToTable({ objects: [
      { id: "a7Kd2", type: "rectangle", x: 40, y: 20, width: 120, height: 80, fill: "#0069ff" }
    ]});
    expect(result).toContain("This tile contains a drawing with 1 object, listed back to front.");
    expect(result).toContain("| a7Kd2 | rectangle | 40, 20 | 120 x 80 |");
    expect(result).toContain("fill=#0069ff");
  });

  it("reports position as the box's north-west corner, not the stored x,y", () => {
    // An ellipse stores its centre. Every row means the same thing, so rows are comparable.
    const result = drawingToTable({ objects: [
      { id: "c3Mn8", type: "ellipse", x: 100, y: 100, rx: 30, ry: 30 }
    ]});
    expect(result).toContain("| c3Mn8 | ellipse | 70, 70 | 60 x 60 |");
    expect(result).toContain("rx=30 ry=30");
  });

  it("keeps document order, which is back to front", () => {
    const result = drawingToTable({ objects: [
      { id: "back", type: "rectangle", x: 0, y: 0, width: 1, height: 1 },
      { id: "front", type: "rectangle", x: 0, y: 0, width: 1, height: 1 }
    ]});
    expect(result.indexOf("| back |")).toBeLessThan(result.indexOf("| front |"));
  });

  it("includes hidden objects and marks them", () => {
    const result = drawingToTable({ objects: [
      { id: "h1", type: "rectangle", x: 0, y: 0, width: 1, height: 1, visible: false }
    ]});
    expect(result).toContain("| h1 |");
    expect(result).toContain("visible=false");
  });

  it("emits a variable chip's variableId", () => {
    const result = drawingToTable({ objects: [
      { id: "Dp47z", type: "variable", x: 110, y: 150, variableId: "v_speed" }
    ]});
    expect(result).toContain("| Dp47z | variable | 110, 150 | 75 x 24 |");
    // Marked estimated: the chip re-measures itself on render and that size is never persisted.
    expect(result).toContain("variableId=v_speed estimatedSize");
  });

  it("keeps multi-line text inside its own cell", () => {
    // Drawing text is edited in a textarea, so a newline is ordinary. Left raw it would end the
    // row and corrupt every column after it.
    const result = drawingToTable({ objects: [
      { id: "m1", type: "text", x: 0, y: 0, width: 50, height: 40, text: "too\nfast" },
      { id: "m2", type: "rectangle", x: 0, y: 0, width: 1, height: 1 }
    ]});
    expect(result).toContain(String.raw`text="too\nfast"`);
    expect(result).not.toContain("too\nfast");
    // The row after it is still a row.
    expect(result).toContain("| m2 | rectangle |");
    expect(result.split("\n")).toHaveLength(6); // preamble, blank, header, separator, 2 rows
  });

  it("escapes quotes and backslashes in text", () => {
    const result = drawingToTable({ objects: [
      { id: "q1", type: "text", x: 0, y: 0, width: 50, height: 20, text: 'say "hi" c:\\x' }
    ]});
    expect(result).toContain(String.raw`text="say \"hi\" c:\\x"`);
  });

  it("emits a text object's content and an image's url", () => {
    const result = drawingToTable({ objects: [
      { id: "t1", type: "text", x: 0, y: 0, width: 50, height: 20, text: "slower here" },
      { id: "i1", type: "image", x: 0, y: 0, width: 10, height: 10, url: "curriculum/x.png" }
    ]});
    expect(result).toContain('text="slower here"');
    expect(result).toContain("url=curriculum/x.png");
  });

  it("counts a line's points rather than listing its deltas", () => {
    const result = drawingToTable({ objects: [
      { id: "l1", type: "line", x: 0, y: 0, deltaPoints: [{ dx: 5, dy: 5 }, { dx: 5, dy: 5 }] }
    ]});
    expect(result).toContain("points=3");
  });

  it("names an unknown object type instead of dropping it", () => {
    const result = drawingToTable({ objects: [
      { id: "u1", type: "sparkline", x: 4, y: 6 }
    ]});
    expect(result).toContain("| u1 | sparkline | 4, 6 | 0 x 0 |");
  });
});

describe("drawingToTable groups", () => {
  // Members are stored as fractions of the group's box by assimilateObjects.
  const group = {
    id: "Bq91x", type: "group", x: 100, y: 200, width: 200, height: 100,
    objects: [
      { id: "kid1", type: "rectangle", x: 0, y: 0, width: 0.5, height: 0.5 },
      { id: "kid2", type: "rectangle", x: 0.5, y: 0.5, width: 0.5, height: 0.5 }
    ]
  };

  it("converts a child's fractions to absolute coordinates", () => {
    const result = drawingToTable({ objects: [group] });
    expect(result).toContain("| Bq91x | group | 100, 200 | 200 x 100 |");
    expect(result).toContain("| kid1 | rectangle | 100, 200 | 100 x 50 |  | Bq91x |");
    expect(result).toContain("| kid2 | rectangle | 200, 250 | 100 x 50 |  | Bq91x |");
  });

  it("lists a child immediately after its group", () => {
    const result = drawingToTable({ objects: [group] });
    expect(result.indexOf("| Bq91x |")).toBeLessThan(result.indexOf("| kid1 |"));
  });

  it("counts nested children in the total", () => {
    expect(drawingToTable({ objects: [group] }))
      .toContain("This tile contains a drawing with 3 objects, listed back to front.");
  });

  it("composes nested groups", () => {
    const result = drawingToTable({ objects: [{
      id: "outer", type: "group", x: 0, y: 0, width: 100, height: 100,
      objects: [{
        id: "inner", type: "group", x: 0.5, y: 0, width: 0.5, height: 1,
        objects: [{ id: "leaf", type: "rectangle", x: 0, y: 0, width: 1, height: 1 }]
      }]
    }]});
    expect(result).toContain("| inner | group | 50, 0 | 50 x 100 |  | outer |");
    expect(result).toContain("| leaf | rectangle | 50, 0 | 50 x 100 |  | inner |");
  });

  it("reports a rotated object's turned box, not its unturned one", () => {
    // A 100x50 rectangle turned 90 degrees occupies 50x100. Reporting the stored box would describe
    // a shape the student cannot see.
    const result = drawingToTable({ objects: [
      { id: "r90", type: "rectangle", x: 0, y: 0, width: 100, height: 50, rotation: 90 }
    ]});
    // Rotation is its own column: once the box is turned, 50 x 100 here is indistinguishable from
    // an unturned 50 x 100 rectangle, so the columns alone could not say which this is.
    expect(result).toContain("| r90 | rectangle | 100, -50 | 50 x 100 | 90° |");
    expect(result).not.toContain("rotation=90");
  });

  it("leaves the rotation column empty for an unrotated object", () => {
    const result = drawingToTable({ objects: [
      { id: "flat", type: "rectangle", x: 0, y: 0, width: 10, height: 10, rotation: 0 }
    ]});
    expect(result).toContain("| flat | rectangle | 0, 0 | 10 x 10 |  |  |");
  });

  it("keeps flips in details, since they do not change the box", () => {
    const result = drawingToTable({ objects: [
      { id: "f1", type: "rectangle", x: 0, y: 0, width: 10, height: 10, hFlip: true }
    ]});
    expect(result).toContain("| f1 | rectangle | 0, 0 | 10 x 10 |  |  | hFlip=true |");
  });

  it("carries an outer group's rotation down to a nested group's children", () => {
    // Each level fills its parent exactly, so the leaf must land on the outer group's own box. If
    // the walk collapsed to an axis-aligned box between levels, the outer rotation would be lost
    // here and the leaf would come back in the wrong quadrant.
    const result = drawingToTable({ objects: [{
      id: "outer", type: "group", x: 0, y: 0, width: 100, height: 50, rotation: 90,
      objects: [{
        id: "inner", type: "group", x: 0, y: 0, width: 1, height: 1,
        objects: [{ id: "leaf", type: "rectangle", x: 0, y: 0, width: 1, height: 1 }]
      }]
    }]});
    expect(result).toContain("| outer | group | 100, -50 | 50 x 100 | 90° |  |");
    // The inner group and the leaf inherit the outer group's turn, since that is how they sit on
    // the page even though neither stores a rotation of its own.
    expect(result).toContain("| inner | group | 100, -50 | 50 x 100 | 90° | outer |");
    expect(result).toContain("| leaf | rectangle | 100, -50 | 50 x 100 | 90° | inner |");
  });

  it("reports rotation against the document, so compensating turns cancel", () => {
    // Turn an object 90 clockwise, group it, turn the group 90 counter-clockwise: on screen the
    // object is upright again, and that is what the column has to say. Its stored rotation is
    // still 90 — reporting that would disagree with the position and size beside it.
    const result = drawingToTable({ objects: [{
      id: "grp", type: "group", x: 0, y: 0, width: 100, height: 50, rotation: 270,
      objects: [{ id: "kid", type: "rectangle", x: 0, y: 0, width: 1, height: 1, rotation: 90 }]
    }]});
    expect(result).toContain("| grp | group |");
    expect(result).toContain("270°");
    expect(result).toMatch(/\| kid \| rectangle \|[^|]+\|[^|]+\|\s*\| grp \|/);
  });

  it("accumulates rotation through the group chain", () => {
    const result = drawingToTable({ objects: [{
      id: "grp", type: "group", x: 0, y: 0, width: 100, height: 100, rotation: 90,
      objects: [{ id: "kid", type: "rectangle", x: 0, y: 0, width: 1, height: 1, rotation: 90 }]
    }]});
    // 90 from the group and 90 of its own. Position is covered by the un-normalizing tests above.
    expect(result).toContain("| 180° | grp |");
  });

  it("reverses a child's rotation under a mirrored group", () => {
    // A mirror turns a clockwise quarter turn into a counter-clockwise one.
    const result = drawingToTable({ objects: [{
      id: "grp", type: "group", x: 0, y: 0, width: 100, height: 100, hFlip: true,
      objects: [{ id: "kid", type: "rectangle", x: 0, y: 0, width: 1, height: 1, rotation: 90 }]
    }]});
    expect(result).toContain("| 270° | grp |");
  });

  it("normalizes a rotation that has grown past a full turn", () => {
    // rotateBy deliberately does not constrain the stored value, so it can exceed 360.
    const result = drawingToTable({ objects: [
      { id: "spun", type: "rectangle", x: 0, y: 0, width: 10, height: 10, rotation: 450 }
    ]});
    expect(result).toContain("| spun | rectangle |");
    expect(result).toContain("| 90° |");
    expect(result).not.toContain("450°");
  });

  it("leaves a pre-1.1.0 group's members alone, since they are already absolute", () => {
    // Groups gained width/height in v1.1.0; before that a group carried objectExtents and its
    // members were stored in absolute pixels. The browser never sees this because DrawingMigrator
    // normalizes on load, but Cloud Functions summarize the raw stored snapshot, so the summarizer
    // meets unmigrated content directly. Treating those members as fractions of a zero-size group
    // reports every one of them as a zero-size point at the group's origin.
    const result = drawingToTable({ objects: [{
      id: "g1", type: "group", x: 0, y: 0,
      // The v1.0.0 marker: per-child fractional sides, and no width/height on the group itself.
      objectExtents: { rA: { top: 0, right: 0.6, bottom: 1, left: 0 } },
      objects: [
        { id: "rA", type: "rectangle", x: 140, y: 50, width: 50, height: 50 },
        { id: "eA", type: "ellipse", x: 205, y: 45, rx: 25, ry: 25 }
      ]
    } as any]});
    // Members keep the absolute coordinates they are stored in, and the group's box is the union of
    // them — the same derivation assimilateObjects performs when the browser loads this content.
    expect(result).toContain("| rA | rectangle | 140, 50 | 50 x 50 |");
    expect(result).toContain("| eA | ellipse | 180, 20 | 50 x 50 |");
    expect(result).toContain("| g1 | group | 140, 20 | 90 x 80 |");
    expect(result).not.toContain("0 x 0");
  });

  it("mirrors children of a flipped group", () => {
    const result = drawingToTable({ objects: [{
      id: "flip", type: "group", x: 0, y: 0, width: 100, height: 100, hFlip: true,
      objects: [{ id: "fkid", type: "rectangle", x: 0, y: 0, width: 0.25, height: 1 }]
    }]});
    expect(result).toContain("| fkid | rectangle | 75, 0 | 25 x 100 |  | flip |");
  });
});
