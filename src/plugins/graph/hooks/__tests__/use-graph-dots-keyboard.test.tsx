import React, { useEffect, useRef } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";

import { useGraphDotsKeyboard } from "../use-graph-dots-keyboard";
import { activateDotSelection, buildDotAriaLabel } from "../../utilities/graph-utils";
import { CaseData, DotsElt } from "../../d3-types";

// --- buildDotAriaLabel ----------------------------------------------------------

describe("buildDotAriaLabel", () => {
  const makeDataConfig = (overrides: Record<string, any> = {}) => ({
    dataset: {
      getNumeric: (caseID: string, attrID: string) => {
        if (attrID === "ax") return 12;
        if (attrID === "ay") return 43.5;
        return undefined;
      },
      attrFromID: (id: string) => id === "ay" ? { name: "Distance" } : undefined,
      isCaseSelected: () => false,
      isAttributeSelected: () => false,
      isCellSelected: () => false,
    },
    attributeID: (role: string) => role === "x" ? "ax" : "",
    xAttributeID: "ax",
    yAttributeIDs: ["ay"],
    yAttributeID: () => "ay",
    ...overrides,
  } as any);

  const caseData: CaseData = { dataConfigID: "dc1", plotNum: 0, caseID: "c1" };

  it("formats X and Y values for a single-series scatter plot", () => {
    const cfg = makeDataConfig();
    expect(buildDotAriaLabel(caseData, cfg)).toBe("Point: X=12, Y=43.5");
  });

  it("appends Series when more than one Y attribute is mapped", () => {
    const cfg = makeDataConfig({ yAttributeIDs: ["ay", "ay2"] });
    expect(buildDotAriaLabel(caseData, cfg)).toBe("Point: X=12, Y=43.5, Series: Distance");
  });

  it("appends ', Selected' when the case is selected", () => {
    const cfg = makeDataConfig({
      dataset: {
        getNumeric: (caseID: string, attrID: string) => attrID === "ax" ? 12 : 43.5,
        attrFromID: () => undefined,
        isCaseSelected: () => true,
        isAttributeSelected: () => false,
        isCellSelected: () => false,
      },
    });
    expect(buildDotAriaLabel(caseData, cfg)).toBe("Point: X=12, Y=43.5, Selected");
  });

  it("returns 'Point' alone when no data configuration is available", () => {
    expect(buildDotAriaLabel(caseData, undefined)).toBe("Point");
  });

  it("appends Color when a legend attribute is mapped", () => {
    // Mimic a CODAP-legend graph where the legend attribute provides category
    // colors. The legend attribute's value for this case is "dog".
    const cfg = makeDataConfig({
      dataset: {
        getNumeric: (_caseID: string, attrID: string) => attrID === "ax" ? 12 : 43.5,
        getValue: (_caseID: string, attrID: string) => attrID === "leg" ? "dog" : undefined,
        attrFromID: () => undefined,
        isCaseSelected: () => false,
        isAttributeSelected: () => false,
        isCellSelected: () => false,
      },
      // Override attributeID so the helper can locate the legend mapping.
      attributeID: (role: string) => {
        if (role === "x") return "ax";
        if (role === "legend") return "leg";
        return "";
      },
    });
    expect(buildDotAriaLabel(caseData, cfg)).toBe("Point: X=12, Y=43.5, Color: dog");
  });

  it("aria-label updates when the case's X value changes", () => {
    // Simulates setPointCoordinates re-running after the underlying dataset has
    // changed: the dot's bound CaseData is unchanged, but `getNumeric` returns
    // a new X value, and the aria-label re-derived from the helper reflects it.
    let currentX = 12;
    const cfg = makeDataConfig({
      dataset: {
        getNumeric: (caseID: string, attrID: string) => {
          if (attrID === "ax") return currentX;
          if (attrID === "ay") return 43.5;
          return undefined;
        },
        attrFromID: () => undefined,
        isCaseSelected: () => false,
        isAttributeSelected: () => false,
        isCellSelected: () => false,
      },
    });
    expect(buildDotAriaLabel(caseData, cfg)).toBe("Point: X=12, Y=43.5");
    currentX = 99;
    expect(buildDotAriaLabel(caseData, cfg)).toBe("Point: X=99, Y=43.5");
  });
});

// --- activateDotSelection ---------------------------------------------------------

describe("activateDotSelection", () => {
  const caseData: CaseData = { dataConfigID: "dc1", plotNum: 0, caseID: "c1" };

  it("sets the y-cell as the sole selection on first activation", () => {
    const setSelectedCells = jest.fn();
    const cfg = {
      dataset: {
        isCellSelected: () => false,
        selectCells: jest.fn(),
        setSelectedCells,
      },
      yAttributeID: () => "ay",
    } as any;
    activateDotSelection(caseData, cfg);
    expect(setSelectedCells).toHaveBeenCalledWith([{ attributeId: "ay", caseId: "c1" }]);
  });

  it("extends the existing selection when extendSelection is true", () => {
    const selectCells = jest.fn();
    const cfg = {
      dataset: {
        isCellSelected: () => false,
        selectCells,
        setSelectedCells: jest.fn(),
      },
      yAttributeID: () => "ay",
    } as any;
    activateDotSelection(caseData, cfg, true);
    expect(selectCells).toHaveBeenCalledWith([{ attributeId: "ay", caseId: "c1" }]);
  });

  it("deselects an already-selected case when extendSelection is true", () => {
    const selectCells = jest.fn();
    const cfg = {
      dataset: {
        isCellSelected: () => true,
        selectCells,
        setSelectedCells: jest.fn(),
      },
      yAttributeID: () => "ay",
    } as any;
    activateDotSelection(caseData, cfg, true);
    expect(selectCells).toHaveBeenCalledWith([{ attributeId: "ay", caseId: "c1" }], false);
  });

  it("no-ops when dataConfiguration is undefined", () => {
    expect(() => activateDotSelection(caseData, undefined)).not.toThrow();
  });
});

// --- useGraphDotsKeyboard hook --------------------------------------------------

interface IFakeDot { caseID: string; x: number; y: number; }

/**
 * Test harness component that mounts the hook against an SVG dots-group surrogate.
 * Lets each test assert focus / aria behaviour after dispatching keyboard events.
 */
function HookHarness(props: {
  dots: IFakeDot[];
  readOnly?: boolean;
  dataConfiguration?: any;
}) {
  const { dots, readOnly = false, dataConfiguration } = props;
  const ref = useRef<DotsElt>(null);

  useGraphDotsKeyboard({
    dotsRef: ref,
    dataConfiguration,
    readOnly,
  });

  // Manually attach __data__ to each <g> after mount so the hook can read the
  // CaseData binding (D3 does this in production via .datum()).
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    Array.from(container.querySelectorAll<SVGGElement>("g.graph-dot")).forEach(g => {
      const id = g.getAttribute("data-case-id") ?? "";
      const caseData: CaseData = { dataConfigID: "dc1", plotNum: 0, caseID: id };
      (g as unknown as { __data__: CaseData }).__data__ = caseData;
    });
  }, [dots]);

  return (
    <div className="graph-wrapper">
      <div data-graph-announcer="" data-testid="announcer" aria-live="polite" />
      <svg
        ref={ref}
        data-graph-dots-group=""
        role="group"
        aria-label="Data points"
        tabIndex={0}
      >
        {dots.map(dot => (
          <g
            key={dot.caseID}
            className="graph-dot"
            role="button"
            tabIndex={-1}
            transform={`translate(${dot.x} ${dot.y})`}
            aria-pressed="false"
            aria-label={`Point: X=${dot.x}, Y=${dot.y}`}
            data-case-id={dot.caseID}
            data-testid={`dot-${dot.caseID}`}
          />
        ))}
      </svg>
    </div>
  );
}


describe("useGraphDotsKeyboard", () => {
  // Default fake data configuration: knows about selection state and exposes the
  // surfaces buildDotAriaLabel / activateDotSelection read.
  function makeFakeConfig(selected: Set<string> = new Set()) {
    return {
      dataset: {
        getNumeric: () => 0,
        attrFromID: () => undefined,
        isCellSelected: (cell: { caseId: string }) => selected.has(cell.caseId),
        isCaseSelected: (caseId: string) => selected.has(caseId),
        isAttributeSelected: () => false,
        selectCells: jest.fn(),
        setSelectedCells: jest.fn((cells: Array<{ caseId: string }>) => {
          selected.clear();
          cells.forEach(c => selected.add(c.caseId));
        }),
      },
      attributeID: () => "",
      yAttributeIDs: [],
      yAttributeID: () => "ay",
    } as any;
  }

  it("focuses the first data point in reading order when the dots group receives focus", () => {
    const dots: IFakeDot[] = [
      { caseID: "c3", x: 300, y: 50 },
      { caseID: "c1", x: 100, y: 50 },
      { caseID: "c2", x: 200, y: 50 },
    ];
    const { getByRole, getByTestId } = render(
      <HookHarness dots={dots} dataConfiguration={makeFakeConfig()} />
    );
    const group = getByRole("group");
    group.focus();
    fireEvent.focus(group);
    expect(document.activeElement).toBe(getByTestId("dot-c1"));
  });

  it("ArrowRight moves focus to the next dot in screen-X order", () => {
    const dots: IFakeDot[] = [
      { caseID: "c1", x: 100, y: 50 },
      { caseID: "c2", x: 200, y: 50 },
      { caseID: "c3", x: 300, y: 50 },
    ];
    const { getByRole, getByTestId } = render(
      <HookHarness dots={dots} dataConfiguration={makeFakeConfig()} />
    );
    const group = getByRole("group");
    group.focus();
    fireEvent.focus(group);
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(document.activeElement).toBe(getByTestId("dot-c2"));
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(document.activeElement).toBe(getByTestId("dot-c3"));
  });

  it("ArrowLeft wraps from first to last", () => {
    const dots: IFakeDot[] = [
      { caseID: "c1", x: 100, y: 50 },
      { caseID: "c2", x: 200, y: 50 },
    ];
    const { getByRole, getByTestId } = render(
      <HookHarness dots={dots} dataConfiguration={makeFakeConfig()} />
    );
    const group = getByRole("group");
    group.focus();
    fireEvent.focus(group);
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(getByTestId("dot-c2"));
  });

  it("sorts by screen-Y when screen-X is tied", () => {
    const dots: IFakeDot[] = [
      { caseID: "c-bottom", x: 100, y: 200 },
      { caseID: "c-top",    x: 100, y: 50 },
    ];
    const { getByRole, getByTestId } = render(
      <HookHarness dots={dots} dataConfiguration={makeFakeConfig()} />
    );
    const group = getByRole("group");
    group.focus();
    fireEvent.focus(group);
    // First dot in reading order should be the lower screen-Y (top of plot).
    expect(document.activeElement).toBe(getByTestId("dot-c-top"));
  });

  it("Home jumps to first dot, End jumps to last", () => {
    const dots: IFakeDot[] = [
      { caseID: "c1", x: 100, y: 50 },
      { caseID: "c2", x: 200, y: 50 },
      { caseID: "c3", x: 300, y: 50 },
    ];
    const { getByRole, getByTestId } = render(
      <HookHarness dots={dots} dataConfiguration={makeFakeConfig()} />
    );
    const group = getByRole("group");
    group.focus();
    fireEvent.focus(group);
    fireEvent.keyDown(group, { key: "End" });
    expect(document.activeElement).toBe(getByTestId("dot-c3"));
    fireEvent.keyDown(group, { key: "Home" });
    expect(document.activeElement).toBe(getByTestId("dot-c1"));
  });

  it("Enter toggles selection of the focused dot via the dataset action", () => {
    const dots: IFakeDot[] = [{ caseID: "c1", x: 100, y: 50 }];
    const selected = new Set<string>();
    const cfg = makeFakeConfig(selected);
    const { getByRole } = render(<HookHarness dots={dots} dataConfiguration={cfg} />);
    const group = getByRole("group");
    group.focus();
    fireEvent.focus(group);
    fireEvent.keyDown(group, { key: "Enter" });
    expect(cfg.dataset.setSelectedCells).toHaveBeenCalledWith([{ attributeId: "ay", caseId: "c1" }]);
  });

  it("does not toggle selection on Enter in read-only mode", () => {
    const dots: IFakeDot[] = [{ caseID: "c1", x: 100, y: 50 }];
    const cfg = makeFakeConfig();
    const { getByRole } = render(<HookHarness dots={dots} dataConfiguration={cfg} readOnly />);
    const group = getByRole("group");
    group.focus();
    fireEvent.focus(group);
    fireEvent.keyDown(group, { key: "Enter" });
    expect(cfg.dataset.setSelectedCells).not.toHaveBeenCalled();
    expect(cfg.dataset.selectCells).not.toHaveBeenCalled();
  });

  // A data configuration whose `buildDotAriaLabel` output varies per caseID, so
  // tests can verify that the announcer receives the *focused* dot's label.
  function makeConfigWithDistinctLabels() {
    return {
      dataset: {
        getNumeric: (caseID: string, attrID: string) => {
          if (caseID === "c1") return attrID === "ax" ? 10 : 100;
          if (caseID === "c2") return attrID === "ax" ? 20 : 200;
          if (caseID === "c3") return attrID === "ax" ? 30 : 300;
          return undefined;
        },
        attrFromID: () => undefined,
        isCellSelected: () => false,
        isCaseSelected: () => false,
        isAttributeSelected: () => false,
        selectCells: jest.fn(),
        setSelectedCells: jest.fn(),
      },
      attributeID: (role: string) => role === "x" ? "ax" : role === "y" ? "ay" : "",
      xAttributeID: "ax",
      yAttributeIDs: ["ay"],
      yAttributeID: () => "ay",
    } as any;
  }

  it("announces the focused dot's label on ArrowRight", async () => {
    const dots: IFakeDot[] = [
      { caseID: "c1", x: 100, y: 50 },
      { caseID: "c2", x: 200, y: 50 },
    ];
    const { getByRole, getByTestId } = render(
      <HookHarness dots={dots} dataConfiguration={makeConfigWithDistinctLabels()} />
    );
    const group = getByRole("group");
    const announcer = getByTestId("announcer");
    group.focus();
    fireEvent.focus(group);
    fireEvent.keyDown(group, { key: "ArrowRight" });
    await waitFor(() => {
      expect(announcer.textContent).toBe("Point: X=20, Y=200");
    });
  });

  it("announces the focused dot's label on Home and End", async () => {
    const dots: IFakeDot[] = [
      { caseID: "c1", x: 100, y: 50 },
      { caseID: "c2", x: 200, y: 50 },
      { caseID: "c3", x: 300, y: 50 },
    ];
    const { getByRole, getByTestId } = render(
      <HookHarness dots={dots} dataConfiguration={makeConfigWithDistinctLabels()} />
    );
    const group = getByRole("group");
    const announcer = getByTestId("announcer");
    group.focus();
    fireEvent.focus(group);
    fireEvent.keyDown(group, { key: "End" });
    await waitFor(() => {
      expect(announcer.textContent).toBe("Point: X=30, Y=300");
    });
    fireEvent.keyDown(group, { key: "Home" });
    await waitFor(() => {
      expect(announcer.textContent).toBe("Point: X=10, Y=100");
    });
  });

  it("does not announce on initial focus (lets the browser read the focused dot)", async () => {
    const dots: IFakeDot[] = [{ caseID: "c1", x: 100, y: 50 }];
    const { getByRole, getByTestId } = render(
      <HookHarness dots={dots} dataConfiguration={makeConfigWithDistinctLabels()} />
    );
    const group = getByRole("group");
    const announcer = getByTestId("announcer");
    group.focus();
    fireEvent.focus(group);
    // Wait long enough for any double-rAF announce to have flushed.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(announcer.textContent).toBe("");
  });

  it("remembers the focused dot's caseID when focus returns to the group", () => {
    const dots: IFakeDot[] = [
      { caseID: "c1", x: 100, y: 50 },
      { caseID: "c2", x: 200, y: 50 },
      { caseID: "c3", x: 300, y: 50 },
    ];
    const { getByRole, getByTestId } = render(
      <HookHarness dots={dots} dataConfiguration={makeFakeConfig()} />
    );
    const group = getByRole("group");
    group.focus();
    fireEvent.focus(group);
    fireEvent.keyDown(group, { key: "ArrowRight" });
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(document.activeElement).toBe(getByTestId("dot-c3"));
    // Simulate a Tab-out and Tab-back-in by re-focusing the group.
    group.focus();
    fireEvent.focus(group);
    expect(document.activeElement).toBe(getByTestId("dot-c3"));
  });
});
