import React from "react";
import { render, fireEvent, screen, act, within } from "@testing-library/react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import { TileModelContext } from "../../../../components/tiles/tile-api";
import { TileModel } from "../../../../models/tiles/tile-model";
import { specStores } from "../../../../models/stores/spec-stores";
import { getToolbarButtonInfo } from "../../../../components/toolbar/toolbar-button-manager";
import { DataflowContentModel, DataflowContentModelType } from "../../model/dataflow-content";
import { DataflowNodeModel } from "../../model/dataflow-program-model";
import { DataflowReteManagerContext } from "../dataflow-rete-manager-context";
import { MIN_ZOOM, MAX_ZOOM, ReteManager } from "../../rete/rete-manager";
import "../../dataflow-toolbar-registration";
import "../../dataflow-registration";

// A stub covering just the members the buttons read/call — a real ReteManager needs a live DOM
// area, so tests substitute this via the context rather than constructing one.
type ManagerStub = Pick<ReteManager, "mstContent" | "zoomIn" | "zoomOut" | "fitContent" | "pan">;

function makeManagerStub(content: DataflowContentModelType): ManagerStub {
  return {
    mstContent: content,
    zoomIn: jest.fn(), zoomOut: jest.fn(), fitContent: jest.fn(), pan: jest.fn()
  };
}

// fit-all's enabled case.
function createContentWithOneNode() {
  const content = DataflowContentModel.create();
  content.program.addNode(DataflowNodeModel.create({ id: "n1", name: "Number", x: 0, y: 0, data: {} }));
  return content;
}

interface RenderOptions {
  manager?: ManagerStub | null;
  content?: DataflowContentModelType;
}

function renderToolbarButton(buttonName: string, opts: RenderOptions = {}) {
  const info = getToolbarButtonInfo("dataflow", buttonName);
  if (!info) throw new Error(`Toolbar button '${buttonName}' is not registered for tileType 'dataflow'`);
  const Component = info.component;
  const stores = specStores();
  const theContent = opts.content ?? DataflowContentModel.create();
  const model = TileModel.create({ content: theContent });
  const theManager = "manager" in opts ? opts.manager : makeManagerStub(theContent);
  const result = render(
    <ModalProvider>
      <Provider stores={stores}>
        <TileModelContext.Provider value={model}>
          <DataflowReteManagerContext.Provider value={theManager as ReteManager | null}>
            <Component name={buttonName} />
          </DataflowReteManagerContext.Provider>
        </TileModelContext.Provider>
      </Provider>
    </ModalProvider>
  );
  return { ...result, manager: theManager, content: theContent };
}

// Disabled state is exposed via aria-disabled, not the native attribute — see tile-toolbar-button.tsx.
function isDisabled(button: HTMLElement) {
  return button.getAttribute("aria-disabled") === "true";
}

describe("Dataflow toolbar zoom buttons (CLUE-573)", () => {
  it.each([["zoom-in", "Zoom In"], ["zoom-out", "Zoom Out"], ["fit-all", "Fit all"]])(
    "'%s' is registered and exposes accessible name '%s'", (name, label) => {
      renderToolbarButton(name);
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });

  it.each<[string, "zoomIn" | "zoomOut", string]>([
    ["zoom-in", "zoomIn", "Zoom In"],
    ["zoom-out", "zoomOut", "Zoom Out"]
  ])("'%s' dispatches %s exactly once", (name, method, label) => {
    const { manager } = renderToolbarButton(name);
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(manager![method]).toHaveBeenCalledTimes(1);
  });

  it("fit-all dispatches fitContent exactly once", () => {
    const { manager } = renderToolbarButton("fit-all", { content: createContentWithOneNode() });
    fireEvent.click(screen.getByRole("button", { name: "Fit all" }));
    expect(manager!.fitContent).toHaveBeenCalledTimes(1);
  });

  it("all three are disabled with no rete manager in context", () => {
    for (const [name, label] of [["zoom-in", "Zoom In"], ["zoom-out", "Zoom Out"], ["fit-all", "Fit all"]]) {
      const { unmount } = renderToolbarButton(name, { manager: null });
      expect(isDisabled(screen.getByRole("button", { name: label }))).toBe(true);
      unmount();
    }
  });

  it("zoom-in disables at MAX_ZOOM and reactively re-enables", () => {
    const content = DataflowContentModel.create();
    content.setLiveProgramZoom({ k: MAX_ZOOM, x: 0, y: 0 });
    const { manager } = renderToolbarButton("zoom-in", { content });
    expect(isDisabled(screen.getByRole("button", { name: "Zoom In" }))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
    expect(manager!.zoomIn).not.toHaveBeenCalled();
    act(() => content.setLiveProgramZoom({ k: 1, x: 0, y: 0 }));
    expect(isDisabled(screen.getByRole("button", { name: "Zoom In" }))).toBe(false);
  });

  it("zoom-out disables at MIN_ZOOM", () => {
    const content = DataflowContentModel.create();
    content.setLiveProgramZoom({ k: MIN_ZOOM, x: 0, y: 0 });
    renderToolbarButton("zoom-out", { content });
    expect(isDisabled(screen.getByRole("button", { name: "Zoom Out" }))).toBe(true);
  });

  it("fit-all disables when the program has no nodes", () => {
    renderToolbarButton("fit-all");
    expect(isDisabled(screen.getByRole("button", { name: "Fit all" }))).toBe(true);
  });
});

describe("Dataflow pan split button (CLUE-573)", () => {
  // The trigger is the one real <button>; the palette arrows are div role="button", so name-based
  // role queries can collide with it (e.g. "Pan right" names both by default). Query it by tag.
  function getTrigger(container: HTMLElement) {
    const trigger = container.querySelector<HTMLButtonElement>("button.toolbar-button.pan");
    if (!trigger) throw new Error("pan trigger button not found");
    return trigger;
  }

  function openPalette() {
    const r = renderToolbarButton("pan");
    fireEvent.click(screen.getByTestId("pan-expand-triangle"));
    return r;
  }

  it("'pan' is registered; the face is named for the default direction (right)", () => {
    const { container } = renderToolbarButton("pan");
    expect(getTrigger(container).getAttribute("aria-label")).toBe("Pan right");
    expect(isDisabled(getTrigger(container))).toBe(false);
    expect(container.querySelector(".dataflow-pan-face.right")).not.toBeNull();
  });

  it("pan is disabled with no rete manager in context", () => {
    const { container } = renderToolbarButton("pan", { manager: null });
    expect(isDisabled(getTrigger(container))).toBe(true);
  });

  it("clicking the face performs the last direction (default: right) without opening the palette", () => {
    const { container, manager, content } = renderToolbarButton("pan");
    fireEvent.click(getTrigger(container));
    expect(manager!.pan).toHaveBeenCalledTimes(1);
    expect(manager!.pan).toHaveBeenCalledWith(-40, 0);
    expect(content.panPaletteOpen).toBe(false);
  });

  it("the corner triangle toggles the palette open, closed, and open again", () => {
    const { content, manager } = openPalette();
    expect(content.panPaletteOpen).toBe(true);
    expect(screen.getByRole("button", { name: "Pan up" })).toBeInTheDocument();
    expect(manager!.pan).not.toHaveBeenCalled();   // opening is not a pan
    fireEvent.click(screen.getByTestId("pan-expand-triangle"));
    expect(content.panPaletteOpen).toBe(false);
    fireEvent.click(screen.getByTestId("pan-expand-triangle"));
    expect(content.panPaletteOpen).toBe(true);
  });

  it("the palette is a labeled group", () => {
    openPalette();
    expect(screen.getByRole("group", { name: "Pan directions" })).toBeInTheDocument();
  });

  // Deltas are literals rather than kPanStep: the toolbar must pan by the same amount as the arrow
  // keys, so these stay meaningful if the constant changes. Signs match setupArrowKeyPan.
  it.each<[string, "up" | "down" | "left" | "right", number, number]>([
    ["Pan up",    "up",    0, 40],
    ["Pan down",  "down",  0, -40],
    ["Pan left",  "left",  40, 0],
    ["Pan right", "right", -40, 0],
  ])("selecting '%s' pans, becomes the face direction, and keeps the palette open", (label, direction, dx, dy) => {
    const { container, manager, content } = openPalette();
    const group = screen.getByRole("group", { name: "Pan directions" });
    fireEvent.click(within(group).getByRole("button", { name: label }));
    expect(manager!.pan).toHaveBeenCalledTimes(1);
    expect(manager!.pan).toHaveBeenCalledWith(dx, dy);
    expect(content.lastPanDirection).toBe(direction);
    expect(content.panPaletteOpen).toBe(true);   // panning is repetitive: stay open
    expect(getTrigger(container).getAttribute("aria-label")).toBe(label);
    expect(container.querySelector(`.dataflow-pan-face.${direction}`)).not.toBeNull();
  });

  it("repeated arrow clicks pan repeatedly", () => {
    const { manager } = openPalette();
    const group = screen.getByRole("group", { name: "Pan directions" });
    const up = within(group).getByRole("button", { name: "Pan up" });
    fireEvent.click(up);
    fireEvent.click(up);
    fireEvent.click(up);
    expect(manager!.pan).toHaveBeenCalledTimes(3);
  });

  it("after selecting a direction, the face re-performs it and closes the palette", () => {
    const { container, manager, content } = openPalette();
    const group = screen.getByRole("group", { name: "Pan directions" });
    fireEvent.click(within(group).getByRole("button", { name: "Pan up" }));
    fireEvent.click(getTrigger(container));
    expect(manager!.pan).toHaveBeenCalledTimes(2);
    expect(manager!.pan).toHaveBeenLastCalledWith(0, 40);
    expect(content.panPaletteOpen).toBe(false);
  });

  // The arrows are `div role="button"`, so activation keys are handled in the component, not by the DOM.
  it.each(["Enter", " "])("'%s' on an arrow selects it", (key) => {
    const { manager, content } = openPalette();
    fireEvent.keyDown(screen.getByRole("button", { name: "Pan down" }), { key });
    expect(manager!.pan).toHaveBeenCalledTimes(1);
    expect(manager!.pan).toHaveBeenCalledWith(0, -40);
    expect(content.lastPanDirection).toBe("down");
  });

  it("opening the palette moves focus to the first arrow", () => {
    openPalette();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Pan up" }));
  });

  it.each([
    ["ArrowUp", "Pan up"],
    ["ArrowDown", "Pan down"],
    ["ArrowLeft", "Pan left"],
    ["ArrowRight", "Pan right"],
  ])("%s moves focus to '%s'", (key, label) => {
    openPalette();
    fireEvent.keyDown(screen.getByRole("button", { name: "Pan up" }), { key });
    const group = screen.getByRole("group", { name: "Pan directions" });
    expect(document.activeElement).toBe(within(group).getByRole("button", { name: label }));
  });

  // Escape is consumed in the capture phase, ahead of the toolbar's own focus-trap exit listener.
  it("Escape closes the palette without panning and returns focus to the trigger", () => {
    const { container, content, manager } = openPalette();
    fireEvent.keyDown(screen.getByRole("button", { name: "Pan up" }), { key: "Escape" });
    expect(content.panPaletteOpen).toBe(false);
    expect(manager!.pan).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getTrigger(container));
  });

  // The real toolbar container listens for Escape in the capture phase to exit its focus trap
  // (tile-toolbar.tsx); the palette must consume the key first. React delegates at the render root,
  // which is above that node, so its capture handler runs before the listener — which is exactly
  // what this asserts: a capture listener on an ancestor below the root never sees the key.
  it("Escape does not reach a capture-phase listener on an ancestor", () => {
    const { container } = openPalette();
    const ancestor = container.firstElementChild as HTMLElement;
    const ancestorListener = jest.fn();
    ancestor.addEventListener("keydown", ancestorListener, true);
    fireEvent.keyDown(screen.getByRole("button", { name: "Pan up" }), { key: "Escape" });
    ancestor.removeEventListener("keydown", ancestorListener, true);
    expect(ancestorListener).not.toHaveBeenCalled();
  });

  it("unmounting the toolbar closes the palette (deselecting the tile)", () => {
    const { content, unmount } = openPalette();
    unmount();
    expect(content.panPaletteOpen).toBe(false);
  });

  // During recorded-data playback the active manager's mstContent is a snapshot copy whose volatiles
  // reset; the remembered direction must live on the real tile content instead.
  it("pan state lives on the tile content, not the active manager's content copy", () => {
    const tileContent = DataflowContentModel.create();
    const managerCopy = DataflowContentModel.create();
    renderToolbarButton("pan", { content: tileContent, manager: makeManagerStub(managerCopy) });
    fireEvent.click(screen.getByTestId("pan-expand-triangle"));
    fireEvent.click(screen.getByRole("button", { name: "Pan up" }));
    expect(tileContent.lastPanDirection).toBe("up");
    expect(tileContent.panPaletteOpen).toBe(true);
    expect(managerCopy.lastPanDirection).toBe("right");   // the copy is untouched
    expect(managerCopy.panPaletteOpen).toBe(false);
  });

  it("pointerdown outside closes the palette; inside it does not", () => {
    const { content } = openPalette();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Pan up" }));
    expect(content.panPaletteOpen).toBe(true);
    fireEvent.pointerDown(document.body);
    expect(content.panPaletteOpen).toBe(false);
  });

});
