import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { AttributeLabel, buildAxisAriaLabel } from "../attribute-label";
import { DataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { GraphModelContext } from "../../hooks/use-graph-model-context";
import { GraphSettingsContext, kDefaultGraphSettings } from "../../hooks/use-graph-settings-context";
import { GraphLayoutContext, GraphLayout } from "../../models/graph-layout";
import { ReadOnlyContext } from "../../../../components/document/read-only-context";
import { GraphPlace } from "../../imports/components/axis-graph-shared";

// --- buildAxisAriaLabel helper ---------------------------------------------------

describe("buildAxisAriaLabel", () => {
  it("formats X-axis label with edit affordance when attribute is selected", () => {
    expect(buildAxisAriaLabel("bottom", "Height (cm)", false, true))
      .toBe("X-axis label: Height (cm), press Enter to edit");
  });

  it("formats Y-axis label with edit affordance when attribute is selected", () => {
    expect(buildAxisAriaLabel("left", "Mass", false, true))
      .toBe("Y-axis label: Mass, press Enter to edit");
  });

  it("omits the 'press Enter to edit' suffix in read-only mode", () => {
    expect(buildAxisAriaLabel("bottom", "Height (cm)", true, true))
      .toBe("X-axis label: Height (cm)");
  });

  it("describes the cue affordance when no attribute is selected (editable)", () => {
    expect(buildAxisAriaLabel("bottom", "Click to add...", false, false))
      .toBe("X-axis: no attribute selected, press Enter to choose");
  });

  it("describes the cue state without affordance in read-only mode", () => {
    expect(buildAxisAriaLabel("left", "", true, false))
      .toBe("Y-axis: no attribute selected");
  });
});

// --- AttributeLabel render + keyboard --------------------------------------------

interface IRenderOptions {
  readOnly?: boolean;
  /** When false, drops into CODAP-legend mode so `useClickHereCue` can fire. */
  defaultSeriesLegend?: boolean;
  /** Whether the data configuration reports an attribute mapped to the place. */
  hasAttribute?: boolean;
  xAttributeLabel?: string;
  place?: GraphPlace;
  onChangeAttribute?: () => void;
  onTreatAttributeAs?: () => void;
  onRemoveAttribute?: () => void;
}

function renderAttributeLabel(opts: IRenderOptions = {}) {
  const {
    readOnly = false,
    defaultSeriesLegend = true,
    hasAttribute = true,
    xAttributeLabel = "X",
    place = "bottom",
    onChangeAttribute,
    onTreatAttributeAs,
    onRemoveAttribute,
  } = opts;

  // Minimal fake data configuration covering the surface AttributeLabel + (when
  // CODAP-legend mode renders it) AxisOrLegendAttributeMenu use.
  const dataConfig = {
    placeCanShowClickHereCue: () => !hasAttribute,
    attributeID: () => (hasAttribute ? "att1" : ""),
    yAttributeDescriptionsExcludingY2: [],
    yAttributeDescriptions: [],
    attributeTypeForID: () => "numeric",
    onAction: () => undefined,
    dataset: hasAttribute
      ? {
          attrFromID: () => ({ name: xAttributeLabel, id: "att1" }),
          attributes: [{ id: "att1", name: xAttributeLabel }],
        }
      : { attrFromID: () => undefined, attributes: [] },
  } as any;

  // Minimal graph model fake. plotType="scatterPlot" exercises the multi-Y branch
  // in `getAttributeIDs`, but yAttributeDescriptionsExcludingY2 is empty so the
  // mapping ends up the same — single attribute.
  const graphModel = {
    plotType: "scatterPlot",
    xAttributeLabel,
    yAttributeLabel: xAttributeLabel,
    setXAttributeLabel: jest.fn(),
    setYAttributeLabel: jest.fn(),
  } as any;

  const settings = {
    ...kDefaultGraphSettings,
    defaultSeriesLegend,
  };

  const layout = new GraphLayout();

  // Wrap in a `.graph-plot` parent so AttributeLabel's `positioningParentElt`
  // lookup (`labelElt.closest('.graph-plot')`) resolves, which is required for
  // the CODAP-legend AxisOrLegendAttributeMenu portal to render.
  return render(
    <GraphLayoutContext.Provider value={layout}>
      <GraphSettingsContext.Provider value={settings}>
        <GraphModelContext.Provider value={graphModel}>
          <DataConfigurationContext.Provider value={dataConfig}>
            <ReadOnlyContext.Provider value={readOnly}>
              <div className="graph-plot">
                <svg>
                  <AttributeLabel
                    place={place}
                    onChangeAttribute={onChangeAttribute}
                    onTreatAttributeAs={onTreatAttributeAs}
                    onRemoveAttribute={onRemoveAttribute}
                  />
                </svg>
              </div>
            </ReadOnlyContext.Provider>
          </DataConfigurationContext.Provider>
        </GraphModelContext.Provider>
      </GraphSettingsContext.Provider>
    </GraphLayoutContext.Provider>
  );
}

describe("AttributeLabel — keyboard behaviour (CLUE-502 Phase 2)", () => {
  it("is rendered as a button with aria-label and tabIndex=0", () => {
    renderAttributeLabel({ xAttributeLabel: "Height" });
    const trigger = screen.getByRole("button", { name: /X-axis label: Height/ });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("tabindex", "0");
    expect(trigger).toHaveAttribute("aria-label", "X-axis label: Height, press Enter to edit");
  });

  it("starts editing on Enter when an attribute is selected", () => {
    renderAttributeLabel({ xAttributeLabel: "Height" });
    const trigger = screen.getByRole("button", { name: /X-axis label: Height/ });
    expect(trigger.querySelector("input.input-textbox")).toBeNull();

    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(trigger.querySelector("input.input-textbox")).not.toBeNull();
  });

  it("starts editing on Space", () => {
    renderAttributeLabel({ xAttributeLabel: "Height" });
    const trigger = screen.getByRole("button", { name: /X-axis label: Height/ });
    fireEvent.keyDown(trigger, { key: " " });
    expect(trigger.querySelector("input.input-textbox")).not.toBeNull();
  });

  it("is focusable in read-only mode but Enter does not start editing", () => {
    renderAttributeLabel({ xAttributeLabel: "Height", readOnly: true });
    const trigger = screen.getByRole("button", { name: /X-axis label: Height/ });
    expect(trigger).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(trigger.querySelector("input.input-textbox")).toBeNull();
  });

  it("aria-label omits 'press Enter to edit' suffix in read-only mode", () => {
    renderAttributeLabel({ xAttributeLabel: "Height", readOnly: true });
    const trigger = screen.getByRole("button", { name: /X-axis label: Height/ });
    expect(trigger).toHaveAttribute("aria-label", "X-axis label: Height");
  });

  it("commits the edited label on Enter and returns focus to the axis-label trigger", () => {
    renderAttributeLabel({ xAttributeLabel: "Height" });
    const trigger = screen.getByRole("button", { name: /X-axis label: Height/ });

    fireEvent.keyDown(trigger, { key: "Enter" });
    const input = trigger.querySelector("input.input-textbox") as HTMLInputElement;
    expect(input).not.toBeNull();
    input.focus();
    fireEvent.change(input, { target: { value: "Width" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(trigger.querySelector("input.input-textbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("cancels the edit on Escape and returns focus to the axis-label trigger", () => {
    renderAttributeLabel({ xAttributeLabel: "Height" });
    const trigger = screen.getByRole("button", { name: /X-axis label: Height/ });

    fireEvent.keyDown(trigger, { key: "Enter" });
    const input = trigger.querySelector("input.input-textbox") as HTMLInputElement;
    expect(input).not.toBeNull();
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });

    expect(trigger.querySelector("input.input-textbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("aria-label describes the cue affordance when no attribute is selected (CODAP mode)", () => {
    renderAttributeLabel({
      defaultSeriesLegend: false,
      hasAttribute: false,
      onChangeAttribute: jest.fn(),
      onTreatAttributeAs: jest.fn(),
      onRemoveAttribute: jest.fn(),
    });
    const trigger = screen.getByRole("button", { name: /X-axis: no attribute selected/ });
    expect(trigger).toHaveAttribute("aria-label", "X-axis: no attribute selected, press Enter to choose");
  });

  it("opens the attribute menu on Enter when the empty-graph cue is showing", () => {
    renderAttributeLabel({
      defaultSeriesLegend: false,
      hasAttribute: false,
      onChangeAttribute: jest.fn(),
      onTreatAttributeAs: jest.fn(),
      onRemoveAttribute: jest.fn(),
    });
    const trigger = screen.getByRole("button", { name: /X-axis: no attribute selected/ });

    // Locate the portaled MenuButton tagged with our data-axis-menu-place attribute
    // and assert that pressing Enter on the trigger clicks it (and so opens the menu).
    const menuButton = document.querySelector(
      '[data-axis-menu-place="bottom"]'
    ) as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();
    const clickSpy = jest.spyOn(menuButton!, "click");

    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Edit mode is NOT entered (the cue case opens the menu instead).
    expect(trigger.querySelector("input.input-textbox")).toBeNull();
  });
});
