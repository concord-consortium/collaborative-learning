import {
  announceGeometry,
  applyBoardA11yAttributes,
  buildBoardSummaryAriaLabel,
  buildPointAriaLabel,
  buildPolygonAriaLabel,
  buildCircleAriaLabel,
  buildInfiniteLineAriaLabel,
  buildMovableLineAriaLabel,
  buildVertexAngleAriaLabel,
  buildCommentAriaLabel,
  buildImageAriaLabel,
  findGeometryAnnouncer,
  focusGeometryContentEntry,
} from "./geometry-aria-utils";

describe("applyBoardA11yAttributes", () => {
  it("makes the SVG element a focusable group with an initial aria-label", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    applyBoardA11yAttributes(svg);
    expect(svg.getAttribute("tabindex")).toBe("0");
    expect(svg.getAttribute("role")).toBe("group");
    expect(svg.getAttribute("aria-label")).toBe("Coordinate grid board: empty");
  });

  it("is a no-op when called with undefined (defensive)", () => {
    expect(() => applyBoardA11yAttributes(undefined)).not.toThrow();
  });
});

describe("buildPointAriaLabel", () => {
  it("labels a named free point with its coordinates", () => {
    expect(buildPointAriaLabel({ name: "P1", x: 3, y: 4, isSelected: false }))
      .toBe("Point P1 at (3, 4)");
  });

  it("omits the name segment when the point has no name", () => {
    expect(buildPointAriaLabel({ x: 3, y: 4, isSelected: false }))
      .toBe("Point at (3, 4)");
  });

  it("appends ', Selected' when selected", () => {
    expect(buildPointAriaLabel({ name: "P1", x: 3, y: 4, isSelected: true }))
      .toBe("Point P1 at (3, 4), Selected");
  });

  it("rounds fractional coordinates to one decimal", () => {
    expect(buildPointAriaLabel({ x: 3.456, y: -1.234, isSelected: false }))
      .toBe("Point at (3.5, -1.2)");
  });

  it("uses 'Linked point' phrasing when the point is linked from a Table", () => {
    expect(buildPointAriaLabel({ x: 3, y: 4, isSelected: false, isLinked: true }))
      .toBe("Linked point at (3, 4)");
  });

  it("labels a polygon vertex with its index, total, and polygon name", () => {
    expect(buildPointAriaLabel({
      name: "B", x: 3, y: 4, isSelected: false,
      vertex: { polygonName: "ABCD", index: 2, total: 4 },
    })).toBe("Vertex 2 of 4 of polygon ABCD: Point B at (3, 4)");
  });

  it("labels an unnamed polygon vertex without the per-point name segment", () => {
    expect(buildPointAriaLabel({
      x: 3, y: 4, isSelected: false,
      vertex: { polygonName: "ABCD", index: 2, total: 4 },
    })).toBe("Vertex 2 of 4 of polygon ABCD: Point at (3, 4)");
  });

  it("preserves the ', Selected' suffix on a vertex label", () => {
    expect(buildPointAriaLabel({
      name: "B", x: 3, y: 4, isSelected: true,
      vertex: { polygonName: "ABCD", index: 2, total: 4 },
    })).toBe("Vertex 2 of 4 of polygon ABCD: Point B at (3, 4), Selected");
  });
});

describe("buildPolygonAriaLabel", () => {
  it("includes the polygon name and vertex count", () => {
    expect(buildPolygonAriaLabel({ name: "ABCD", vertexCount: 4, isSelected: false }))
      .toBe("Polygon ABCD with 4 vertices");
  });

  it("omits the name segment when the polygon has no name", () => {
    expect(buildPolygonAriaLabel({ vertexCount: 5, isSelected: false }))
      .toBe("Polygon with 5 vertices");
  });

  it("uses singular 'vertex' when there is exactly one vertex", () => {
    // A degenerate polygon, but the language should still read naturally.
    expect(buildPolygonAriaLabel({ vertexCount: 1, isSelected: false }))
      .toBe("Polygon with 1 vertex");
  });

  it("appends ', Selected' when selected", () => {
    expect(buildPolygonAriaLabel({ name: "ABCD", vertexCount: 4, isSelected: true }))
      .toBe("Polygon ABCD with 4 vertices, Selected");
  });
});

describe("buildCircleAriaLabel", () => {
  it("describes a circle with its center and radius", () => {
    expect(buildCircleAriaLabel({ centerX: 0, centerY: 0, radius: 3, isSelected: false }))
      .toBe("Circle centered at (0, 0) with radius 3");
  });

  it("rounds fractional center and radius to one decimal", () => {
    expect(buildCircleAriaLabel({ centerX: 1.55, centerY: -2.49, radius: 2.7321, isSelected: false }))
      .toBe("Circle centered at (1.6, -2.5) with radius 2.7");
  });

  it("appends ', Selected' when selected", () => {
    expect(buildCircleAriaLabel({ centerX: 0, centerY: 0, radius: 3, isSelected: true }))
      .toBe("Circle centered at (0, 0) with radius 3, Selected");
  });
});

describe("buildInfiniteLineAriaLabel", () => {
  it("describes an infinite line by its two defining points", () => {
    expect(buildInfiniteLineAriaLabel({
      p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 }, isSelected: false,
    })).toBe("Line through (0, 0) and (1, 1)");
  });

  it("appends ', Selected' when selected", () => {
    expect(buildInfiniteLineAriaLabel({
      p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 }, isSelected: true,
    })).toBe("Line through (0, 0) and (1, 1), Selected");
  });
});

describe("buildMovableLineAriaLabel", () => {
  it("describes a movable line as 'from … to …' (segment-like, not infinite)", () => {
    expect(buildMovableLineAriaLabel({
      p1: { x: 0, y: 0 }, p2: { x: 5, y: 5 }, isSelected: false,
    })).toBe("Movable line from (0, 0) to (5, 5)");
  });

  it("appends ', Selected' when selected", () => {
    expect(buildMovableLineAriaLabel({
      p1: { x: 0, y: 0 }, p2: { x: 5, y: 5 }, isSelected: true,
    })).toBe("Movable line from (0, 0) to (5, 5), Selected");
  });
});

describe("buildVertexAngleAriaLabel", () => {
  it("describes a vertex angle as 'NN degrees at (x, y)' with the vertex location", () => {
    expect(buildVertexAngleAriaLabel({ degrees: 90, vertexX: 1, vertexY: 1, isSelected: false }))
      .toBe("Vertex angle of 90 degrees at (1, 1)");
  });

  it("rounds the degree value to one decimal", () => {
    expect(buildVertexAngleAriaLabel({ degrees: 42.678, vertexX: 0, vertexY: 0, isSelected: false }))
      .toBe("Vertex angle of 42.7 degrees at (0, 0)");
  });

  it("appends ', Selected' when selected", () => {
    expect(buildVertexAngleAriaLabel({ degrees: 90, vertexX: 1, vertexY: 1, isSelected: true }))
      .toBe("Vertex angle of 90 degrees at (1, 1), Selected");
  });
});

describe("buildCommentAriaLabel", () => {
  it("formats a comment with its anchor label and full text when short", () => {
    expect(buildCommentAriaLabel({ text: "Looks good", anchorLabel: "Point P1" }))
      .toBe("Comment on Point P1: Looks good");
  });

  it("truncates comment text longer than ~50 characters with an ellipsis", () => {
    const longText = "This is a very long comment that exceeds the announcement budget for screen readers";
    expect(buildCommentAriaLabel({ text: longText, anchorLabel: "Point P1" }))
      .toBe(`Comment on Point P1: ${longText.slice(0, 50)}…`);
  });

  it("omits the anchor segment when none is supplied", () => {
    expect(buildCommentAriaLabel({ text: "Hi" }))
      .toBe("Comment: Hi");
  });
});

describe("buildImageAriaLabel", () => {
  it("formats a background image with its pixel dimensions", () => {
    expect(buildImageAriaLabel({ width: 480, height: 320 }))
      .toBe("Background image, 480 × 320 pixels");
  });
});

describe("findGeometryAnnouncer", () => {
  it("returns the direct-child announcer of the nearest .geometry-tool ancestor", () => {
    document.body.innerHTML = `
      <div class="geometry-tool">
        <div data-grid-announcer="" aria-live="polite"></div>
        <div class="geometry-content"><svg><g></g></svg></div>
      </div>`;
    const start = document.querySelector(".geometry-content g") as Element;
    const announcer = findGeometryAnnouncer(start);
    expect(announcer).not.toBeNull();
    expect(announcer?.hasAttribute("data-grid-announcer")).toBe(true);
  });

  it("returns the correct announcer when geometry tiles are nested (uses :scope)", () => {
    document.body.innerHTML = `
      <div class="geometry-tool" data-id="outer">
        <div data-grid-announcer="" data-id="outer-announcer"></div>
        <div class="geometry-tool" data-id="inner">
          <div data-grid-announcer="" data-id="inner-announcer"></div>
          <div class="geometry-content"><svg><g></g></svg></div>
        </div>
      </div>`;
    const start = document.querySelector('[data-id="inner"] .geometry-content g') as Element;
    const announcer = findGeometryAnnouncer(start);
    expect(announcer?.getAttribute("data-id")).toBe("inner-announcer");
  });

  it("returns null when there is no .geometry-tool ancestor", () => {
    document.body.innerHTML = `<div class="not-geometry"><span></span></div>`;
    const start = document.querySelector("span") as Element;
    expect(findGeometryAnnouncer(start)).toBeNull();
  });
});

describe("announceGeometry", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="geometry-tool">
        <div data-grid-announcer="" aria-live="polite"></div>
      </div>`;
  });

  function nextDoubleRaf(): Promise<void> {
    return new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  it("writes the message to the [data-grid-announcer] element after a double rAF", async () => {
    const start = document.querySelector(".geometry-tool") as HTMLElement;
    announceGeometry(start, "Point P1 at (3, 4), Selected");
    await nextDoubleRaf();
    expect(document.querySelector("[data-grid-announcer]")?.textContent)
      .toBe("Point P1 at (3, 4), Selected");
  });

  it("re-announces the same message by clearing textContent first", async () => {
    const start = document.querySelector(".geometry-tool") as HTMLElement;
    const announcer = document.querySelector("[data-grid-announcer]") as HTMLElement;
    announceGeometry(start, "Same message");
    await nextDoubleRaf();
    expect(announcer.textContent).toBe("Same message");

    // Pre-set to the same string to verify the clear+re-set behaviour.
    announcer.textContent = "Same message";
    announceGeometry(start, "Same message");
    // Mid-rAF the announcer is cleared so the screen reader notices the change.
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    expect(announcer.textContent).toBe("");
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    expect(announcer.textContent).toBe("Same message");
  });

  it("is a no-op when called from outside a .geometry-tool subtree", async () => {
    document.body.innerHTML = `<div class="some-other-tile"><span></span></div>`;
    const stray = document.querySelector("span") as HTMLElement;
    expect(() => announceGeometry(stray, "should not throw")).not.toThrow();
  });
});

describe("focusGeometryContentEntry", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="geometry-content">
        <svg tabindex="0" role="group">
          <ellipse tabindex="0" data-object-id="p1" id="p1"></ellipse>
          <ellipse tabindex="0" data-object-id="p2" id="p2"></ellipse>
        </svg>
      </div>`;
  });

  function content() {
    return document.querySelector(".geometry-content") as HTMLElement;
  }

  it("focuses the SVG board on forward entry (Tab from title)", () => {
    const ok = focusGeometryContentEntry(content(), /* reverse */ false);
    expect(ok).toBe(true);
    expect(document.activeElement?.tagName).toBe("svg");
  });

  it("focuses the last focusable rendNode on reverse entry (Shift+Tab from toolbar)", () => {
    const ok = focusGeometryContentEntry(content(), /* reverse */ true);
    expect(ok).toBe(true);
    expect((document.activeElement as Element).getAttribute("data-object-id")).toBe("p2");
  });

  it("falls back to the SVG board on reverse entry when there are no focusable objects", () => {
    document.body.innerHTML = `
      <div class="geometry-content">
        <svg tabindex="0" role="group"></svg>
      </div>`;
    const ok = focusGeometryContentEntry(content(), /* reverse */ true);
    expect(ok).toBe(true);
    expect(document.activeElement?.tagName).toBe("svg");
  });

  it("returns false when the content element is undefined", () => {
    expect(focusGeometryContentEntry(undefined, false)).toBe(false);
    expect(focusGeometryContentEntry(undefined, true)).toBe(false);
  });
});

describe("buildBoardSummaryAriaLabel", () => {
  it("returns 'empty' when there are no objects", () => {
    expect(buildBoardSummaryAriaLabel({
      byType: { points: 0, polygons: 0, circles: 0, lines: 0 },
      selectedCount: 0,
    })).toBe("Coordinate grid board: empty");
  });

  it("summarises a mixed board with type counts and selection count", () => {
    expect(buildBoardSummaryAriaLabel({
      byType: { points: 3, polygons: 1, circles: 0, lines: 0 },
      selectedCount: 1,
    })).toBe("Coordinate grid board: 3 points, 1 polygon, 1 selected");
  });

  it("uses singular type names when the count is 1", () => {
    expect(buildBoardSummaryAriaLabel({
      byType: { points: 1, polygons: 0, circles: 0, lines: 0 },
      selectedCount: 0,
    })).toBe("Coordinate grid board: 1 point");
  });

  it("omits zero-count types from the summary", () => {
    expect(buildBoardSummaryAriaLabel({
      byType: { points: 2, polygons: 0, circles: 1, lines: 0 },
      selectedCount: 0,
    })).toBe("Coordinate grid board: 2 points, 1 circle");
  });

  it("omits the selection segment when nothing is selected", () => {
    expect(buildBoardSummaryAriaLabel({
      byType: { points: 2, polygons: 0, circles: 0, lines: 0 },
      selectedCount: 0,
    })).toBe("Coordinate grid board: 2 points");
  });
});
