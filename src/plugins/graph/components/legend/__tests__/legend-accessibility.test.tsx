import React from "react";
import { render, screen } from "@testing-library/react";

import { AddSeriesButton } from "../add-series-button";
import { LegendDropdown } from "../legend-dropdown";
import { SimpleAttributeLabel } from "../../simple-attribute-label";
import { DataConfigurationContext } from "../../../hooks/use-data-configuration-context";
import { GraphModelContext } from "../../../hooks/use-graph-model-context";
import { GraphSettingsContext, kDefaultGraphSettings } from "../../../hooks/use-graph-settings-context";
import { ReadOnlyContext } from "../../../../../components/document/read-only-context";

// --- AddSeriesButton ------------------------------------------------------------

describe("AddSeriesButton — aria contract", () => {
  function renderAddSeries(hasUnplottedAttribute: boolean) {
    const dataConfig = {
      dataset: hasUnplottedAttribute
        ? { attributes: [{ id: "att1" }, { id: "att2" }] }
        : { attributes: [{ id: "att1" }] },
      _attributeDescriptions: new Map([["x", { attributeID: "att1" }]]),
      yAttributeDescriptions: [],
      addYAttribute: jest.fn(),
    } as any;

    return render(
      <DataConfigurationContext.Provider value={dataConfig}>
        <AddSeriesButton />
      </DataConfigurationContext.Provider>
    );
  }

  it("exposes aria-label='Add Y attribute'", () => {
    renderAddSeries(true);
    const button = screen.getByRole("button", { name: "Add Y attribute" });
    expect(button).toBeInTheDocument();
  });

  it("uses aria-disabled='true' rather than HTML disabled when no attribute can be added", () => {
    renderAddSeries(false);
    const button = screen.getByRole("button", { name: "Add Y attribute" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    // The control remains focusable (no native `disabled` attribute).
    expect(button).not.toHaveAttribute("disabled");
  });

  it("is not aria-disabled when an unplotted attribute is available", () => {
    renderAddSeries(true);
    const button = screen.getByRole("button", { name: "Add Y attribute" });
    expect(button).toHaveAttribute("aria-disabled", "false");
  });
});

// --- SimpleAttributeLabel (uses AxisOrLegendAttributeMenu target=null) ----------

describe("SimpleAttributeLabel — legend-case aria-label", () => {
  function renderSimpleAttributeLabel(attrName = "Height", readOnly = false) {
    const dataConfig = {
      dataset: {
        attrFromID: (id: string) => id === "att1" ? { name: attrName, id: "att1" } : undefined,
        attributes: [{ id: "att1", name: attrName }],
        isAttributeSelected: () => false,
      },
      attributeID: () => "att1",
      yAttributeDescriptions: [],
      attributeTypeForID: () => "numeric",
      onAction: () => undefined,
    } as any;
    const graphModel = {
      getColorForId: () => "#000000",
    } as any;
    return render(
      <GraphSettingsContext.Provider value={kDefaultGraphSettings}>
        <GraphModelContext.Provider value={graphModel}>
          <DataConfigurationContext.Provider value={dataConfig}>
            <ReadOnlyContext.Provider value={readOnly}>
              <SimpleAttributeLabel
                attrId="att1"
                place="left"
                onChangeAttribute={jest.fn()}
                onRemoveAttribute={jest.fn()}
                onTreatAttributeAs={jest.fn()}
              />
            </ReadOnlyContext.Provider>
          </DataConfigurationContext.Provider>
        </GraphModelContext.Provider>
      </GraphSettingsContext.Provider>
    );
  }

  it("legend-case MenuButton has aria-label that includes the attribute name", () => {
    renderSimpleAttributeLabel("Height");
    const button = screen.getByRole("button", { name: /Attribute: Height, press Enter for options/ });
    expect(button).toBeInTheDocument();
  });

  it("uses aria-disabled rather than HTML disabled when read-only", () => {
    renderSimpleAttributeLabel("Height", true);
    const button = screen.getByRole("button", { name: /Attribute: Height, press Enter for options/ });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
  });

  it("does not open the attribute menu when activated in read-only mode", () => {
    renderSimpleAttributeLabel("Height", true);
    const button = screen.getByRole("button", { name: /Attribute: Height, press Enter for options/ });
    button.click();
    // Chakra menu items are only rendered when the menu is open; in read-only
    // mode the click is intercepted and no menuitems should appear.
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });
});

// --- LegendDropdown (color picker) ----------------------------------------------

describe("LegendDropdown — aria contract", () => {
  it("MenuButton exposes the buttonAriaLabel as its accessible name", () => {
    render(
      <ReadOnlyContext.Provider value={false}>
        <LegendDropdown
          buttonAriaLabel="Color: blue"
          buttonLabel={<span>swatch</span>}
          menuItems={[
            { ariaLabel: "blue", key: "#0000ff", label: "blue" },
            { ariaLabel: "red",  key: "#ff0000", label: "red" },
          ]}
        />
      </ReadOnlyContext.Provider>
    );
    const button = screen.getByRole("button", { name: "Color: blue" });
    expect(button).toBeInTheDocument();
  });
});
