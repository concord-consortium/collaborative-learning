import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import { GraphControllerContext } from "../../models/graph-controller";
import { GraphModelContext } from "../../hooks/use-graph-model-context";
import { TileModelContext } from "../../../../components/tiles/tile-api";
import { TileModel } from "../../../../models/tiles/tile-model";
import { specStores } from "../../../../models/stores/spec-stores";
import { getToolbarButtonInfo } from "../../../../components/toolbar/toolbar-button-manager";
import { createGraphModel } from "../../models/graph-model";
import "../graph-toolbar-registration";
import "../../graph-registration";

function renderToolbarButton(buttonName: string, modelOverrides: any = {}) {
  const info = getToolbarButtonInfo("graph", buttonName);
  if (!info) throw new Error(`Toolbar button '${buttonName}' is not registered for tileType 'graph'`);
  const Component = info.component;

  const stores = specStores();
  const content = createGraphModel();
  const model = TileModel.create({ content });
  // Merge per-test overrides onto the live MST instance so toggle tests can
  // pre-set things like graph.lockAxes without running through the full action.
  Object.assign(content, modelOverrides);

  // GraphControllerContext is consumed by FitAllButton. We don't need a real
  // controller for an aria-label test — a stub with the methods used is fine.
  const controller = { autoscaleAllAxes: jest.fn() } as any;

  return render(
    <ModalProvider>
      <Provider stores={stores}>
        <TileModelContext.Provider value={model}>
          <GraphModelContext.Provider value={content}>
            <GraphControllerContext.Provider value={controller}>
              <Component name={buttonName} />
            </GraphControllerContext.Provider>
          </GraphModelContext.Provider>
        </TileModelContext.Provider>
      </Provider>
    </ModalProvider>
  );
}

// --- aria-label parametric audit ------------------------------------------------

const expectedLabels: Array<[string, string]> = [
  ["link-tile",          "Link data"],
  ["link-tile-multiple", "Add data"],
  ["fit-all",            "Fit All"],
  ["toggle-lock",        "Lock Axes"], // unlocked label (default state)
  ["movable-line",       "Movable line"],
  ["add-points-by-hand", "Add points by hand"],
  ["add-points",         "Add point"],
  ["move-points",        "Select/Move point"],
  ["delete",             "Delete"],
];

describe("Graph toolbar buttons — aria-label audit", () => {
  it.each(expectedLabels)("'%s' button exposes aria-label '%s'", (name, expected) => {
    renderToolbarButton(name);
    const button = screen.getByRole("button", { name: expected });
    expect(button).toBeInTheDocument();
    expect(button.getAttribute("aria-label")).toBe(expected);
  });

  it("every registered graph toolbar button has a non-empty aria-label", () => {
    for (const [name] of expectedLabels) {
      const { unmount } = renderToolbarButton(name);
      const buttons = document.querySelectorAll(`button.toolbar-button.${name}`);
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach(btn => {
        const label = btn.getAttribute("aria-label");
        expect(label).toBeTruthy();
        expect(label?.length).toBeGreaterThan(0);
      });
      unmount();
    }
  });
});

// --- aria-pressed on toggle-state buttons ---------------------------------------

describe("Graph toolbar — aria-pressed on toggle buttons", () => {
  it("toggle-lock starts aria-pressed='false' and flips to 'true' after activation", () => {
    renderToolbarButton("toggle-lock");
    const button = document.querySelector("button.toolbar-button.toggle-lock") as HTMLButtonElement;
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    // After click, MST updated graph.lockAxes; the observer re-renders with
    // the new label and aria-pressed='true'.
    const updated = document.querySelector("button.toolbar-button.toggle-lock") as HTMLButtonElement;
    expect(updated.getAttribute("aria-pressed")).toBe("true");
  });

  it("add-points reports aria-pressed='false' when editing mode is not 'add'", () => {
    renderToolbarButton("add-points");
    const button = document.querySelector("button.toolbar-button.add-points") as HTMLButtonElement;
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("move-points reports aria-pressed='false' when editing mode is not 'edit'", () => {
    renderToolbarButton("move-points");
    const button = document.querySelector("button.toolbar-button.move-points") as HTMLButtonElement;
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});

// --- aria-disabled (not HTML disabled) per memory rule --------------------------

describe("Graph toolbar — disabled state uses aria-disabled", () => {
  // The delete button is disabled when nothing is selected. A fresh graph
  // model has no selection, so it's a convenient default-disabled case.
  it("delete button uses aria-disabled='true' and remains focusable (no HTML disabled)", () => {
    renderToolbarButton("delete");
    const button = document.querySelector("button.toolbar-button.delete") as HTMLButtonElement;
    expect(button.getAttribute("aria-disabled")).toBe("true");
    // Native `disabled` would short-circuit focusability — must not be set.
    expect(button.hasAttribute("disabled")).toBe(false);
  });
});
