import { projectTile } from "./tiles";

describe("projectTile — Text", () => {
  it("converts slate content to markdown", () => {
    const slate = {
      type: "Text", format: "slate",
      text: JSON.stringify({
        document: { children: [{ type: "paragraph", children: [{ text: "Flex to close it." }] }] },
      }),
    };
    const tile = projectTile(slate, "tile-tx-1", "Notes")!;
    expect(tile.type).toBe("Text");
    expect(tile.title).toBe("Notes");
    expect((tile.content as any).text).toEqual(expect.stringContaining("Flex to close it."));
  });

  it("passes non-slate text through and says which format it is", () => {
    const html = {
      type: "Text", format: "html",
      text: ["<p>How would you use these signals?</p>"],
    };
    const tile = projectTile(html, "tile-tx-2")!;
    expect((tile.content as any).format).toBe("html");
    expect((tile.content as any).text).toEqual(
      expect.stringContaining("How would you use these signals?"));
  });
});

describe("projectTile — Simulator", () => {
  // "EMG_and_claw" is an opaque key on its own. The simulation's own description is what tells a
  // diagnostic what the student is working with.
  it("carries the simulation key and its description", () => {
    const tile = projectTile({ type: "Simulator", simulation: "EMG_and_claw" }, "tile-sim-1")!;
    expect(tile.type).toBe("Simulator");
    expect((tile.content as any).simulation).toBe("EMG_and_claw");
    expect(typeof (tile.content as any).description).toBe("string");
    expect((tile.content as any).description.length).toBeGreaterThan(0);
  });

  it("invents no description for a simulation it does not know", () => {
    const tile = projectTile({ type: "Simulator", simulation: "not-a-simulation" }, "tile-sim-2")!;
    expect((tile.content as any).simulation).toBe("not-a-simulation");
    expect((tile.content as any).description).toBeUndefined();
  });
});

describe("projectTile — Table", () => {
  // The whole point of shared_models[]: a Table tile holds column widths, not rows. Sending the
  // widths would suggest we had described the table when we had not.
  it("carries no rows, because a table's data lives in its shared model", () => {
    const tile = projectTile({
      type: "Table", isImported: false, columnWidths: { ATTRx: 120, ATTRy: 90 },
    }, "tile-tbl-1")!;
    expect(tile.type).toBe("Table");
    expect(JSON.stringify(tile)).not.toContain("columnWidths");
    expect(JSON.stringify(tile)).not.toContain("120");
  });
});

describe("projectTile — Other", () => {
  it("names an image and where it came from", () => {
    const tile = projectTile({ type: "Image", url: "brain/images/13.jpg" }, "tile-img-1", "Sketch")!;
    expect(tile.type).toBe("Other");
    expect(tile.title).toBe("Sketch");
    expect(tile.content).toMatchObject({ kind: "Image", url: "brain/images/13.jpg" });
  });

  it("renders a drawing with the summarizer, so its objects can be named", () => {
    const tile = projectTile({ type: "Drawing", objects: [] }, "tile-draw-1")!;
    expect(tile.type).toBe("Other");
    expect((tile.content as any).kind).toBe("Drawing");
    expect(typeof (tile.content as any).rendering).toBe("string");
    expect((tile.content as any).rendering.length).toBeGreaterThan(0);
  });

  // One unreadable tile must cost the reader that tile and no more.
  it("degrades a malformed drawing to a note rather than throwing", () => {
    const tile = projectTile({ type: "Drawing", objects: "not-an-array" }, "tile-draw-2")!;
    expect((tile.content as any).kind).toBe("Drawing");
    expect((tile.content as any).rendering).toEqual(expect.stringMatching(/could not|malformed/i));
  });

  it("names a kind it cannot describe without inventing content for it", () => {
    const tile = projectTile({ type: "Geometry", someInternalShape: 1 }, "tile-geo-1")!;
    expect(tile.type).toBe("Other");
    expect(tile.content).toEqual({ kind: "Geometry" });
  });
});

describe("projectTile — dispatch", () => {
  it("routes each CLUE tile type to its projection", () => {
    expect(projectTile({ type: "Text", format: "html", text: ["hi"] }, "a")!.type).toBe("Text");
    expect(projectTile({ type: "Simulator", simulation: "x" }, "b")!.type).toBe("Simulator");
    expect(projectTile({ type: "Table" }, "c")!.type).toBe("Table");
    expect(projectTile({ type: "Image", url: "u" }, "d")!.type).toBe("Other");
  });

  // Placeholders are the empty scaffolding of an auto-sectioned document, not student work.
  // Sending them would describe a workspace fuller than the one the student sees.
  it("omits placeholder tiles entirely", () => {
    expect(projectTile({ type: "Placeholder", sectionId: "intro" }, "e")).toBeUndefined();
  });
});
