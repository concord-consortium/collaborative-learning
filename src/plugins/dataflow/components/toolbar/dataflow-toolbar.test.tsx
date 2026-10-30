import React from "react";
import { render, fireEvent, screen, act, within } from "@testing-library/react";
import { runInAction } from "mobx";
import { destroy } from "mobx-state-tree";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import { ReadOnlyContext } from "../../../../components/document/read-only-context";
import { SerialDevice } from "../../../../models/stores/serial";
import {
  ConnectResult, DeviceChoice, getDeviceConnection, IAttemptOptions, kIdentifyResultMs
} from "../../model/device-connection";
import { FailureKind } from "../../model/connect-failures";
import { ConnectionAttempt } from "../../model/connection-attempt";
import { IdentifyResult } from "../../../../models/stores/cc-device-session";
import { TileModelContext } from "../../../../components/tiles/tile-api";
import { ITileModel, TileModel } from "../../../../models/tiles/tile-model";
import { specStores } from "../../../../models/stores/spec-stores";
import { specAppConfig } from "../../../../models/stores/spec-app-config";
import { TileToolbar } from "../../../../components/toolbar/tile-toolbar";
import { getToolbarButtonInfo } from "../../../../components/toolbar/toolbar-button-manager";
import { DataflowContentModel, DataflowContentModelType } from "../../model/dataflow-content";
import { DataflowNodeModel } from "../../model/dataflow-program-model";
import { DataflowReteManagerContext } from "../dataflow-rete-manager-context";
import { MIN_ZOOM, MAX_ZOOM, ReteManager } from "../../rete/rete-manager";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../../../lib/logger-types";
import "../../dataflow-toolbar-registration";
import "../../dataflow-registration";

jest.mock("../../../../models/tiles/log/log-tile-change-event", () => ({ logTileChangeEvent: jest.fn() }));

// A stub covering just the members the buttons read/call — a real ReteManager needs a live DOM
// area, so tests substitute this via the context rather than constructing one.
type ManagerStub = Pick<ReteManager, "mstContent" | "readOnly" | "zoomIn" | "zoomOut" | "fitContent" | "pan">;

function makeManagerStub(content: DataflowContentModelType): ManagerStub {
  return {
    mstContent: content, readOnly: false,
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
  readOnly?: boolean;
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
  return { ...result, manager: theManager, content: theContent, model };
}

// MST warns when code reads or writes a node that was destroyed.
function deadNodeWarnings(warn: jest.SpyInstance) {
  return warn.mock.calls.filter(args => String(args[0]).includes("no longer part of a state tree"));
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

  // Opening moves focus into the palette, so every close path owes focus somewhere. Closing by
  // clicking outside unmounts the focused arrow, and without this focus falls to <body> — which
  // silently sends the next Tab back to the top of the document.
  it("closing by outside pointerdown returns focus to the trigger", () => {
    const { container } = openPalette();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Pan up" }));
    fireEvent.pointerDown(document.body);
    expect(document.activeElement).toBe(getTrigger(container));
  });

  // Deleting a tile destroys its model before the toolbar unmounts.
  it("unmounting after the tile was deleted does not touch the destroyed content", () => {
    const { model, unmount } = openPalette();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    destroy(model);
    unmount();
    const warnings = deadNodeWarnings(warn);
    warn.mockRestore();
    expect(warnings).toEqual([]);
  });

});

// An open failure. Only a stall's attemptId is compared, so any id serves when none is given.
const openFailedOn = (attemptId = "attempt-1") =>
  ({ attemptId, kind: "openFailed", choice: "spikerbit", step: "open", elapsedMs: 0 }) as const;

// A connect or reconnect that ends in a failure, as DeviceConnection reports it to the tile.
function failingAttempt(kind: FailureKind, choice: DeviceChoice = "spikerbit") {
  return async (...args: unknown[]) => {
    const options = args[args.length - 1] as IAttemptOptions;
    const attempt = new ConnectionAttempt(choice, "connect", options.attemptId);
    attempt.end(kind, { attemptId: attempt.id, kind, choice, step: "open", elapsedMs: 0 });
    options.listener?.onEnded?.(attempt);
    return kind;
  };
}

describe("Dataflow connect button and pane", () => {
  // Pass `stores` to render a second toolbar sharing the first one's device connection, and
  // `strict` to render it in React.StrictMode, which mounts, unmounts and remounts it.
  function renderConnect(opts: RenderOptions & { stores?: ReturnType<typeof specStores>, strict?: boolean } = {}) {
    const info = getToolbarButtonInfo("dataflow", "connect");
    if (!info) throw new Error("connect is not registered");
    const Component = info.component;
    const stores = opts.stores ?? specStores();
    const content = opts.content ?? DataflowContentModel.create();
    const model = TileModel.create({ content });
    const connection = getDeviceConnection(stores.serialDevice);
    const tree = (
      <ModalProvider>
        <Provider stores={stores}>
          <ReadOnlyContext.Provider value={!!opts.readOnly}>
            <TileModelContext.Provider value={model}>
              <DataflowReteManagerContext.Provider value={makeManagerStub(content) as ReteManager}>
                <Component name="connect" />
              </DataflowReteManagerContext.Provider>
            </TileModelContext.Provider>
          </ReadOnlyContext.Provider>
        </Provider>
      </ModalProvider>
    );
    const result = render(opts.strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
    return { ...result, content, stores, connection, model, tileId: model.id };
  }

  function getTrigger(container: HTMLElement) {
    const trigger = container.querySelector<HTMLButtonElement>("button.toolbar-button.connect");
    if (!trigger) throw new Error("connect trigger button not found");
    return trigger;
  }

  function openPane(opts: Parameters<typeof renderConnect>[0] = {}) {
    const r = renderConnect(opts);
    fireEvent.click(getTrigger(r.container));
    return r;
  }

  const fakeTransport = () => ({
    close: jest.fn(), write: jest.fn(), onData: undefined, onDisconnect: undefined
  }) as unknown as Parameters<SerialDevice["setActiveDevice"]>[1];

  function fakeConnected(r: ReturnType<typeof renderConnect>) {
    act(() => {
      r.stores.serialDevice.setActiveDevice("spikerbit", fakeTransport());
      runInAction(() => { r.connection.lastChoice = "spikerbit"; });
    });
  }

  // Starts an attempt on the shared connection the way DeviceConnection does, for the pane to show.
  function startAttempt(r: ReturnType<typeof renderConnect>, trigger: "connect" | "reconnect" = "connect") {
    const attempt = new ConnectionAttempt("spikerbit", trigger);
    act(() => runInAction(() => {
      r.connection.lastChoice = "spikerbit";
      r.connection.busyChoice = "spikerbit";
      r.connection.attempt = attempt;
    }));
    return attempt;
  }

  // A real click starts with a pointerdown, which reaches the pane's outside-click handler first.
  it("'connect' is registered and opens and closes its pane on click", () => {
    const { container, content } = renderConnect();
    const press = () => {
      fireEvent.pointerDown(getTrigger(container));
      fireEvent.click(getTrigger(container));
    };
    expect(screen.queryByRole("group", { name: "Device connection" })).toBeNull();
    expect(getTrigger(container)).toHaveAttribute("aria-expanded", "false");
    press();
    expect(content.connectPaneOpen).toBe(true);
    expect(screen.getByRole("group", { name: "Device connection" })).toBeInTheDocument();
    expect(getTrigger(container)).toHaveAttribute("aria-expanded", "true");
    press();
    expect(content.connectPaneOpen).toBe(false);
    expect(screen.queryByRole("group", { name: "Device connection" })).toBeNull();
    expect(getTrigger(container)).toHaveAttribute("aria-expanded", "false");
  });

  describe("announcing a failure the student can't see", () => {
    const headline = "The browser couldn't open the Spiker:bit.";
    const failure = {
      attemptId: "attempt-1", kind: "openTimeout", choice: "spikerbit", step: "open", elapsedMs: 0
    } as const;

    it("announces the problem headline politely when a failure is recorded with the pane closed", () => {
      const r = renderConnect();
      expect(screen.queryByText(headline)).toBeNull();
      act(() => {
        r.content.setConnectFailure(failure);
        r.content.setUnseenConnectError(true);
      });
      expect(screen.getByText(headline)).toHaveAttribute("aria-live", "polite");
    });

    // A live region inserted already holding its text is often not read, so it stays mounted.
    it("keeps the live region mounted, empty until there is something to announce", () => {
      const r = renderConnect();
      const region = r.container.querySelector("[role='status'][aria-live='polite']");
      expect(region).toBeInTheDocument();
      expect(region).toBeEmptyDOMElement();
      act(() => {
        r.content.setConnectFailure(failure);
        r.content.setUnseenConnectError(true);
      });
      expect(screen.getByText(headline)).toBe(region);
    });

    it("announces when the failure and the unseen flag are recorded in separate renders", () => {
      const r = renderConnect();
      act(() => r.content.setConnectFailure(failure));
      expect(screen.queryByText(headline)).toBeNull();
      act(() => r.content.setUnseenConnectError(true));
      expect(screen.getByText(headline)).toHaveAttribute("aria-live", "polite");
    });

    it("does not announce a failure recorded while the pane is open", () => {
      const r = openPane();
      act(() => {
        r.content.setConnectFailure(failure);
        r.content.setUnseenConnectError(false);
      });
      expect(screen.queryByText(headline)).toBeNull();
    });

    it("does not announce a stale unseen failure on mount", () => {
      const content = DataflowContentModel.create();
      content.setConnectFailure(failure);
      content.setUnseenConnectError(true);
      renderConnect({ content });
      expect(screen.queryByText(headline)).toBeNull();
    });
  });

  it("opening the pane moves focus to the first control", () => {
    openPane();
    const group = screen.getByRole("group", { name: "Device connection" });
    expect(document.activeElement).toBe(within(group).getAllByRole("button")[0]);
  });

  it("Escape closes the pane and returns focus to the trigger", () => {
    const { container, content } = openPane();
    const group = screen.getByRole("group", { name: "Device connection" });
    fireEvent.keyDown(within(group).getAllByRole("button")[0], { key: "Escape" });
    expect(content.connectPaneOpen).toBe(false);
    expect(document.activeElement).toBe(getTrigger(container));
  });

  // See the pan palette's test of the same name for why an ancestor's capture listener stands in for
  // the toolbar's focus-trap exit.
  it("Escape does not reach a capture-phase listener on an ancestor", () => {
    const { container } = openPane();
    const ancestor = container.firstElementChild as HTMLElement;
    const ancestorListener = jest.fn();
    ancestor.addEventListener("keydown", ancestorListener, true);
    const group = screen.getByRole("group", { name: "Device connection" });
    fireEvent.keyDown(within(group).getAllByRole("button")[0], { key: "Escape" });
    ancestor.removeEventListener("keydown", ancestorListener, true);
    expect(ancestorListener).not.toHaveBeenCalled();
  });

  it("pointerdown outside closes the pane; inside it does not", () => {
    const { content } = openPane();
    const group = screen.getByRole("group", { name: "Device connection" });
    fireEvent.pointerDown(within(group).getAllByRole("button")[0]);
    expect(content.connectPaneOpen).toBe(true);
    fireEvent.pointerDown(document.body);
    expect(content.connectPaneOpen).toBe(false);
  });

  it("closing by outside pointerdown returns focus to the trigger", () => {
    const { container } = openPane();
    const group = screen.getByRole("group", { name: "Device connection" });
    expect(group.contains(document.activeElement)).toBe(true);
    fireEvent.pointerDown(document.body);
    expect(document.activeElement).toBe(getTrigger(container));
  });

  it("unmounting the toolbar closes the pane", () => {
    const { content, unmount } = openPane();
    unmount();
    expect(content.connectPaneOpen).toBe(false);
  });

  it("not connected: shows Not connected and a Connect control for each device", () => {
    openPane();
    const group = screen.getByRole("group", { name: "Device connection" });
    expect(within(group).getByRole("status")).toHaveTextContent("Not connected");
    for (const label of ["Arduino", "micro:bit (radio hub)", "Spiker:bit"]) {
      expect(within(group).getByRole("button", { name: `Connect ${label}` })).toBeInTheDocument();
    }
    expect(within(group).queryByRole("button", { name: "Disconnect" })).toBeNull();
  });

  it("connected: shows Connected: Spiker:bit with Reconnect and Disconnect and no device list", () => {
    const r = openPane();
    fakeConnected(r);
    act(() => runInAction(() => { r.stores.serialDevice.dataReceived = true; }));
    const group = screen.getByRole("group", { name: "Device connection" });
    expect(within(group).getByRole("status")).toHaveTextContent("Connected: Spiker:bit");
    expect(within(group).getByRole("button", { name: "Reconnect" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(within(group).queryByRole("button", { name: /^Connect / })).toBeNull();
    expect(getTrigger(r.container).classList.contains("connect-connected")).toBe(true);
  });

  it("pane returns to the device list when the device drops", () => {
    const r = openPane();
    fakeConnected(r);
    act(() => r.stores.serialDevice.clearActiveDevice());
    const group = screen.getByRole("group", { name: "Device connection" });
    expect(within(group).getByRole("status")).toHaveTextContent("Not connected");
    expect(within(group).getByRole("button", { name: "Connect Spiker:bit" })).toBeInTheDocument();
  });

  it("after a failure: shows the message and the device list again", () => {
    const r = openPane();
    act(() => r.content.setConnectFailure(openFailedOn()));
    const group = screen.getByRole("group", { name: "Device connection" });
    expect(within(group).getByRole("status")).toHaveTextContent("Not connected");
    expect(within(group).getByText("Couldn't open it.")).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Connect Spiker:bit" })).toBeInTheDocument();
  });

  it("while connecting: shows Connecting to Spiker:bit… and disables the controls", () => {
    const r = openPane();
    startAttempt(r, "connect");
    const group = screen.getByRole("group", { name: "Device connection" });
    expect(within(group).getByRole("status")).toHaveTextContent("Connecting to Spiker:bit…");
    const controls = within(group).getAllByRole("button");
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach(control => expect(isDisabled(control)).toBe(true));
    const connect = jest.spyOn(r.connection, "connect");
    fireEvent.click(within(group).getByRole("button", { name: "Connect Arduino" }));
    fireEvent.keyDown(within(group).getByRole("button", { name: "Connect Arduino" }), { key: "Enter" });
    expect(connect).not.toHaveBeenCalled();
  });

  it("the button turns yellow when the board stops responding, and green when it answers again", () => {
    const r = renderConnect();
    fakeConnected(r);
    act(() => runInAction(() => { r.stores.serialDevice.dataReceived = true; }));
    const trigger = getTrigger(r.container);
    const session = r.stores.serialDevice.ccDeviceSession!;
    act(() => session.setNotResponding(true));
    expect(trigger.classList.contains("connect-attention")).toBe(true);
    expect(trigger.getAttribute("aria-label")).toBe("The Spiker:bit is not responding. Click for details.");
    act(() => session.setNotResponding(false));
    expect(trigger.classList.contains("connect-connected")).toBe(true);
    act(() => r.stores.serialDevice.clearActiveDevice());
  });

  it("the button's name says the device was unplugged", () => {
    const r = renderConnect();
    fakeConnected(r);
    act(() => r.stores.serialDevice.activeTransport!.onDisconnect!("unplugged"));
    expect(getTrigger(r.container).getAttribute("aria-label"))
      .toBe("The Spiker:bit was unplugged. Click to connect.");
  });

  describe("after a stall", () => {
    const pane = () => screen.getByRole("group", { name: "Device connection" });

    // An Arduino whose attempt ended as noData, with its port still open.
    function stalledArduino(r: ReturnType<typeof renderConnect>) {
      const attempt = new ConnectionAttempt("arduino", "connect");
      const noData = {
        attemptId: attempt.id, kind: "noData", choice: "arduino", step: "waitForData", elapsedMs: 5000
      } as const;
      act(() => {
        r.stores.serialDevice.setActiveDevice("arduino", fakeTransport());
        runInAction(() => {
          attempt.opened("waitForData");
          attempt.end("noData", noData);
          r.connection.attempt = attempt;
          r.connection.lastChoice = "arduino";
          r.connection.lastFailure = noData;
        });
        r.content.setConnectFailure(noData);
      });
    }

    it("Disconnect leaves the button idle and the pane clean", async () => {
      const r = openPane();
      stalledArduino(r);
      const trigger = getTrigger(r.container);
      expect(trigger).toHaveClass("connect-attention");
      expect(within(pane()).getByText("No data yet.")).toBeInTheDocument();

      await act(async () => { fireEvent.click(within(pane()).getByRole("button", { name: "Disconnect" })); });

      expect(trigger).toHaveClass("connect-idle");
      expect(trigger.getAttribute("aria-label")).toBe("Connect a device");
      fireEvent.click(trigger);
      expect(within(pane()).getByRole("status")).toHaveTextContent("Not connected");
      expect(within(pane()).getByText("Plug in a device, then click Connect.")).toBeInTheDocument();
    });

    // A Spiker:bit update that stalled: its board is open but never became the active device.
    function stalledUpdate(r: ReturnType<typeof renderConnect>) {
      const attempt = startAttempt(r);
      const stall = {
        attemptId: attempt.id, kind: "updateStalled", choice: "spikerbit", step: "update", elapsedMs: 45000
      } as const;
      act(() => runInAction(() => {
        attempt.opened("checkFirmware");
        attempt.end("updateStalled", stall);
        r.connection.busyChoice = undefined;
        r.connection.lastFailure = stall;
        // Private: only a real stalled update sets it, and that needs a board.
        (r.connection as unknown as { stalledSpikerbit: object }).stalledSpikerbit = {};
      }));
      return stall;
    }

    it("a stalled update whose board isn't active names the device and says the update stalled", () => {
      const r = renderConnect();
      stalledUpdate(r);
      const trigger = getTrigger(r.container);
      expect(trigger).toHaveClass("connect-attention");
      expect(trigger.getAttribute("aria-label")).toBe("Spiker:bit: the update stalled. Click for details.");
    });

    it("a stalled update making progress again shows as connecting", () => {
      const r = renderConnect();
      stalledUpdate(r);
      act(() => runInAction(() => { r.connection.lastFailure = undefined; }));
      const trigger = getTrigger(r.container);
      expect(trigger).toHaveClass("connect-idle");
      expect(trigger.getAttribute("aria-label")).toBe("Connecting to Spiker:bit…");
    });

    it("a failure that isn't a stall isn't shown as one", () => {
      const r = renderConnect();
      const openFailed = {
        attemptId: "attempt-1", kind: "openFailed", choice: "arduino", step: "open", elapsedMs: 0
      } as const;
      act(() => {
        runInAction(() => { r.connection.lastFailure = openFailed; });
        r.content.setConnectFailure(openFailed);
        r.content.setUnseenConnectError(true);
      });
      expect(getTrigger(r.container).getAttribute("aria-label")).toBe("Couldn't connect. Click for details.");
    });

    it("a tile's stall no longer shows once its device is gone", () => {
      const r = renderConnect();
      stalledArduino(r);
      act(() => r.content.setUnseenConnectError(true));
      expect(getTrigger(r.container)).toHaveClass("connect-attention");

      // Another tile's Disconnect clears the connection's failure, but not this tile's.
      act(() => {
        runInAction(() => { r.connection.lastFailure = undefined; });
        r.stores.serialDevice.clearActiveDevice();
      });

      const trigger = getTrigger(r.container);
      expect(trigger).toHaveClass("connect-idle");
      expect(trigger.getAttribute("aria-label")).toBe("Connect a device");
      fireEvent.click(trigger);
      expect(within(pane()).getByRole("status")).toHaveTextContent("Not connected");
      expect(within(pane()).queryByText("No data yet.")).toBeNull();
    });
  });

  describe("the status area", () => {
    const pane = () => screen.getByRole("group", { name: "Device connection" });
    const lines = () => pane().querySelectorAll(".connect-status-line, .connect-detail");

    it("always has the fixed-height class and exactly two line elements", () => {
      const r = openPane();
      const check = () => {
        const area = pane().querySelector(".connect-status");
        expect(area).not.toBeNull();
        expect(lines()).toHaveLength(2);
      };
      check();
      const attempt = startAttempt(r);
      attempt.chooserClosed();
      check();
      act(() => attempt.end("openFailed", openFailedOn(attempt.id)));
      act(() => r.content.setConnectFailure(openFailedOn()));
      check();
    });

    it("shows the step on line 2 while opening, and the progress bar while updating", () => {
      const r = openPane();
      const attempt = startAttempt(r);
      expect(pane().querySelector(".connect-detail.hint")).toHaveTextContent("Choose it in the browser's list.");
      act(() => attempt.chooserClosed());
      expect(pane().querySelector(".connect-detail.plain")).toHaveTextContent("Opening the connection…");
      expect(pane().querySelector(".connect-progress")).toBeNull();
      act(() => { attempt.opened("checkFirmware"); attempt.firmwareChecked("old", true); attempt.updateProgress(45); });
      const bar = pane().querySelector(".connect-progress");
      expect(bar).toHaveAttribute("role", "progressbar");
      expect(bar).toHaveAttribute("aria-valuenow", "45");
      expect(within(pane()).getByRole("status")).toHaveTextContent("Updating. Keep it plugged in.");
      expect(pane().querySelector(".connect-detail")).toHaveTextContent("45%");
    });

    it("switches to the disabled actions at the open and enables them when the attempt connects", () => {
      const r = openPane();
      const attempt = startAttempt(r);
      expect(within(pane()).getByRole("button", { name: "Connect Arduino" })).toBeInTheDocument();
      act(() => { attempt.chooserClosed(); attempt.opened("checkFirmware"); });
      const reconnect = within(pane()).getByRole("button", { name: "Reconnect" });
      expect(within(pane()).queryByRole("button", { name: /^Connect / })).toBeNull();
      expect(isDisabled(reconnect)).toBe(true);
      expect(isDisabled(within(pane()).getByRole("button", { name: "Disconnect" }))).toBe(true);
      expect(within(pane()).getByRole("status")).toHaveTextContent("Connected: Spiker:bit");
      fakeConnected(r);
      act(() => runInAction(() => { r.connection.busyChoice = undefined; attempt.end("connected"); }));
      expect(isDisabled(within(pane()).getByRole("button", { name: "Reconnect" }))).toBe(false);
      act(() => r.stores.serialDevice.clearActiveDevice());
    });

    it("a failure shows the problem on line 2 and keeps the device rows", () => {
      const r = openPane();
      act(() => r.content.setConnectFailure(openFailedOn()));
      expect(pane().querySelector(".connect-detail.problem")).toHaveTextContent("Couldn't open it.");
      expect(within(pane()).getAllByRole("button", { name: /^Connect / })).toHaveLength(3);
    });

    it("an attempt from tile A shows its step in tile B's pane; only A records the failure", () => {
      const stores = specStores();
      const a = renderConnect({ stores });
      const b = openPane({ stores });
      const attempt = startAttempt(b);
      act(() => attempt.chooserClosed());
      expect(pane().querySelector(".connect-detail")).toHaveTextContent("Opening the connection…");
      act(() => runInAction(() => { b.connection.busyChoice = undefined; }));
      act(() => attempt.end("openFailed", openFailedOn(attempt.id)));
      a.content.setConnectFailure(openFailedOn());
      expect(a.content.connectFailure).toBeDefined();
      expect(b.content.connectFailure).toBeUndefined();
      expect(pane().querySelector(".connect-detail.problem")).toBeNull();
    });

    it("step text is outside the live region; a problem is inside it", () => {
      const r = openPane();
      const attempt = startAttempt(r);
      act(() => attempt.chooserClosed());
      const live = within(pane()).getByRole("status");
      expect(live).toHaveTextContent("Connecting to Spiker:bit…");
      expect(live).not.toHaveTextContent("Opening the connection…");
      act(() => runInAction(() => { r.connection.busyChoice = undefined; }));
      act(() => attempt.end("openFailed", openFailedOn(attempt.id)));
      act(() => r.content.setConnectFailure(openFailedOn()));
      expect(within(pane()).getByRole("status")).toHaveTextContent("Couldn't open it.");
    });
  });

  describe("the second line", () => {
    const pane = () => screen.getByRole("group", { name: "Device connection" });

    it("says the Spiker:bit is not responding, under Connected", () => {
      const r = openPane();
      fakeConnected(r);
      act(() => r.stores.serialDevice.ccDeviceSession!.setNotResponding(true));
      expect(within(pane()).getByRole("status")).toHaveTextContent("Connected: Spiker:bit");
      expect(within(pane()).getByText("Not responding.")).toBeInTheDocument();
      act(() => r.stores.serialDevice.clearActiveDevice());
    });

    it("says the device was unplugged, or that the connection was lost, under Not connected", () => {
      const r = openPane();
      fakeConnected(r);
      act(() => r.stores.serialDevice.activeTransport!.onDisconnect!("unplugged"));
      expect(within(pane()).getByRole("status")).toHaveTextContent("Not connected");
      expect(within(pane()).getByText("It was unplugged.")).toBeInTheDocument();
      fakeConnected(r);
      act(() => r.stores.serialDevice.activeTransport!.onDisconnect!("lost"));
      expect(within(pane()).getByText("Connection lost.")).toBeInTheDocument();
    });
  });

  describe("Is it alive?", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const pane = () => screen.getByRole("group", { name: "Device connection" });
    const aliveButton = () => within(pane()).getByRole("button", { name: "Is it alive?" });

    // Opens the pane on a connected Spiker:bit whose session's identify waits for the test to answer.
    function setupCheck(opts: { strict?: boolean } = {}) {
      const r = openPane(opts);
      fakeConnected(r);
      const answers: Array<(result: IdentifyResult) => void> = [];
      const identify = jest.spyOn(r.stores.serialDevice.ccDeviceSession!, "identify")
        .mockImplementation(() => new Promise(resolve => { answers.push(resolve); }));
      const answer = async (result: IdentifyResult) => {
        await act(async () => { answers.shift()!(result); });
      };
      return { ...r, identify, answer };
    }

    afterEach(() => {
      act(() => { jest.runOnlyPendingTimers(); });
    });

    it("shows only for a connected Spiker:bit", () => {
      const r = openPane();
      expect(within(pane()).queryByRole("button", { name: "Is it alive?" })).toBeNull();
      act(() => {
        r.stores.serialDevice.setActiveDevice("arduino", fakeTransport());
        runInAction(() => { r.connection.lastChoice = "arduino"; });
      });
      expect(within(pane()).queryByRole("button", { name: "Is it alive?" })).toBeNull();
      fakeConnected(r);
      expect(aliveButton()).toBeInTheDocument();
      act(() => r.stores.serialDevice.clearActiveDevice());
    });

    it("checks, reports the answer, then goes back to what the line showed", async () => {
      const r = setupCheck();
      act(() => r.stores.serialDevice.ccDeviceSession!.setNotResponding(true));
      aliveButton().focus();
      fireEvent.click(aliveButton());
      expect(r.identify).toHaveBeenCalledTimes(1);
      expect(within(pane()).getByText("Look for the heart…")).toBeInTheDocument();
      expect(within(pane()).queryByText("Not responding.")).toBeNull();
      expect(isDisabled(aliveButton())).toBe(true);
      await r.answer("answered");
      expect(within(pane()).getByText("It answered.")).toBeInTheDocument();
      expect(isDisabled(aliveButton())).toBe(false);
      expect(document.activeElement).toBe(aliveButton());
      expect(r.content.connectPaneOpen).toBe(true);
      act(() => { jest.advanceTimersByTime(kIdentifyResultMs); });
      expect(within(pane()).queryByText("It answered.")).toBeNull();
      expect(within(pane()).getByText("Not responding.")).toBeInTheDocument();
      act(() => r.stores.serialDevice.clearActiveDevice());
    });

    it("reports when the board didn't answer", async () => {
      const r = setupCheck();
      fireEvent.click(aliveButton());
      await r.answer("noAnswer");
      expect(within(pane()).getByText("No answer.")).toBeInTheDocument();
      act(() => r.stores.serialDevice.clearActiveDevice());
    });

    it("ignores clicks while checking, and a click after the answer starts a new check", async () => {
      const r = setupCheck();
      fireEvent.click(aliveButton());
      fireEvent.click(aliveButton());
      expect(r.identify).toHaveBeenCalledTimes(1);
      await r.answer("answered");
      fireEvent.click(aliveButton());
      expect(r.identify).toHaveBeenCalledTimes(2);
      expect(within(pane()).getByText("Look for the heart…")).toBeInTheDocument();
      act(() => { jest.advanceTimersByTime(kIdentifyResultMs); });
      expect(within(pane()).getByText("Look for the heart…")).toBeInTheDocument();
      await r.answer("answered");
      act(() => r.stores.serialDevice.clearActiveDevice());
    });

    it("the answer is still there when the pane is closed during the check and opened again", async () => {
      const consoleError = jest.spyOn(console, "error");
      const r = setupCheck();
      fireEvent.click(aliveButton());
      fireEvent.keyDown(aliveButton(), { key: "Escape" });
      expect(r.content.connectPaneOpen).toBe(false);
      await r.answer("answered");
      fireEvent.click(getTrigger(r.container));
      expect(within(pane()).getByText("It answered.")).toBeInTheDocument();
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
      act(() => r.stores.serialDevice.clearActiveDevice());
    });

    it("works in React.StrictMode", async () => {
      const r = setupCheck({ strict: true });
      fireEvent.click(aliveButton());
      await r.answer("answered");
      expect(within(pane()).getByText("It answered.")).toBeInTheDocument();
      expect(isDisabled(aliveButton())).toBe(false);
      act(() => r.stores.serialDevice.clearActiveDevice());
    });
  });

  describe("after a loss", () => {
    const pulsing = (r: ReturnType<typeof renderConnect>) =>
      getTrigger(r.container).classList.contains("connect-loss-pulse");
    const lose = (r: ReturnType<typeof renderConnect>, loss: "lost" | "unplugged") => {
      const transport = r.stores.serialDevice.activeTransport ?? r.stores.serialDevice.lastLoss!.transport;
      act(() => transport.onDisconnect!(loss));
    };

    // The pulse is the class's CSS animation, which runs once when the class is added and then
    // shows the state's own look.
    it("the button gets the pulse class over its normal look, kept until the next connect attempt", () => {
      jest.useFakeTimers();
      const r = renderConnect();
      fakeConnected(r);
      lose(r, "lost");
      expect(pulsing(r)).toBe(true);
      expect(getTrigger(r.container).classList.contains("connect-idle")).toBe(true);
      act(() => { jest.advanceTimersByTime(60000); });
      expect(pulsing(r)).toBe(true);
      act(() => r.stores.serialDevice.clearLastLoss());
      expect(pulsing(r)).toBe(false);
      jest.useRealTimers();
    });

    it("a toolbar shown after the loss doesn't pulse", () => {
      const first = renderConnect();
      fakeConnected(first);
      lose(first, "unplugged");
      const second = renderConnect({ stores: first.stores });
      expect(pulsing(second)).toBe(false);
      act(() => first.stores.serialDevice.clearLastLoss());
      expect(pulsing(second)).toBe(false);
    });

    it("an unplug confirming the loss doesn't pulse again", () => {
      const r = renderConnect();
      fakeConnected(r);
      lose(r, "lost");
      const trigger = getTrigger(r.container);
      const observer = new MutationObserver(() => undefined);
      observer.observe(trigger, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
      lose(r, "unplugged");
      const changes = observer.takeRecords();
      observer.disconnect();
      expect(r.stores.serialDevice.lastLoss?.reason).toBe("unplugged");
      expect(pulsing(r)).toBe(true);
      // Taking the class off and putting it back would replay the animation.
      expect(changes.every(c => c.oldValue?.includes("connect-loss-pulse"))).toBe(true);
    });

    it("a later loss pulses again", () => {
      jest.useFakeTimers();
      const r = renderConnect();
      fakeConnected(r);
      lose(r, "lost");
      jest.advanceTimersByTime(1);
      fakeConnected(r);
      expect(pulsing(r)).toBe(false);
      lose(r, "lost");
      expect(pulsing(r)).toBe(true);
      act(() => r.stores.serialDevice.clearActiveDevice());
      jest.useRealTimers();
    });
  });

  it("the button shows the attention state when the program needs a device", () => {
    const content = DataflowContentModel.create();
    content.setNeedsDevice(true);
    const { container } = renderConnect({ content });
    const trigger = getTrigger(container);
    expect(trigger.classList.contains("connect-attention")).toBe(true);
    expect(trigger.getAttribute("aria-label")).toBe("This program needs a device. Click to connect.");
  });

  it("opening the pane clears an unseen error's attention state", () => {
    const content = DataflowContentModel.create();
    content.setUnseenConnectError(true);
    const { container } = renderConnect({ content });
    expect(getTrigger(container).classList.contains("connect-attention")).toBe(true);
    fireEvent.click(getTrigger(container));
    expect(content.unseenConnectError).toBe(false);
    expect(getTrigger(container).classList.contains("connect-attention")).toBe(false);
  });

  it("the button is disabled when read-only", () => {
    const { container } = renderConnect({ readOnly: true });
    expect(isDisabled(getTrigger(container))).toBe(true);
    fireEvent.click(getTrigger(container));
    expect(screen.queryByRole("group", { name: "Device connection" })).toBeNull();
  });

  // The controls are `div role="button"`, so activation keys are handled in the component.
  it.each(["Enter", " "])("'%s' on a pane control activates it", (key) => {
    const r = openPane();
    const connect = jest.spyOn(r.connection, "connect").mockResolvedValue("canceled");
    fireEvent.keyDown(screen.getByRole("button", { name: "Connect Spiker:bit" }), { key });
    expect(connect).toHaveBeenCalledWith("spikerbit", expect.objectContaining({ listener: expect.any(Object) }));
  });

  it("clicking Connect for Spiker:bit calls the connection with \"spikerbit\"", () => {
    const r = openPane();
    const connect = jest.spyOn(r.connection, "connect").mockResolvedValue("canceled");
    fireEvent.click(screen.getByRole("button", { name: "Connect Spiker:bit" }));
    expect(connect).toHaveBeenCalledWith("spikerbit", expect.objectContaining({ listener: expect.any(Object) }));
  });

  it("focus stays in the pane when its controls change", () => {
    const r = openPane();
    act(() => screen.getByRole("button", { name: "Connect Spiker:bit" }).focus());
    fakeConnected(r);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reconnect" }));
    act(() => r.stores.serialDevice.clearActiveDevice());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Connect Arduino" }));
  });

  const paneGroup = () => screen.getByRole("group", { name: "Device connection" });

  it("a successful Connect closes the pane and returns focus to the trigger", async () => {
    const r = openPane();
    jest.spyOn(r.connection, "connect").mockImplementation(async () => {
      r.stores.serialDevice.setActiveDevice("spikerbit", fakeTransport());
      return "connected";
    });
    act(() => screen.getByRole("button", { name: "Connect Spiker:bit" }).focus());
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect Spiker:bit" })); });
    expect(r.content.connectPaneOpen).toBe(false);
    expect(screen.queryByRole("group", { name: "Device connection" })).toBeNull();
    expect(document.activeElement).toBe(getTrigger(r.container));
  });

  it("a successful Reconnect closes the pane and returns focus to the trigger", async () => {
    const r = openPane();
    fakeConnected(r);
    jest.spyOn(r.connection, "reconnect").mockResolvedValue("connected");
    act(() => screen.getByRole("button", { name: "Reconnect" }).focus());
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reconnect" })); });
    expect(r.content.connectPaneOpen).toBe(false);
    expect(screen.queryByRole("group", { name: "Device connection" })).toBeNull();
    expect(document.activeElement).toBe(getTrigger(r.container));
  });

  it("Disconnect closes the pane and returns focus to the trigger", async () => {
    const r = openPane();
    fakeConnected(r);
    jest.spyOn(r.connection, "disconnect").mockImplementation(async () => {
      r.stores.serialDevice.clearActiveDevice();
    });
    act(() => screen.getByRole("button", { name: "Disconnect" }).focus());
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Disconnect" })); });
    expect(r.content.connectPaneOpen).toBe(false);
    expect(screen.queryByRole("group", { name: "Device connection" })).toBeNull();
    expect(document.activeElement).toBe(getTrigger(r.container));
  });

  // Mocks connection.connect with an attempt that stays pending until the test resolves it.
  function pendingConnect(r: ReturnType<typeof renderConnect>) {
    let resolveConnect: (result: ConnectResult) => void = () => undefined;
    jest.spyOn(r.connection, "connect").mockImplementation(() =>
      new Promise<ConnectResult>(resolve => { resolveConnect = resolve; }));
    const connectSpikerbit = () => screen.getByRole("button", { name: "Connect Spiker:bit" });
    act(() => connectSpikerbit().focus());
    fireEvent.click(connectSpikerbit());
    return async (result: ConnectResult) => {
      await act(async () => {
        if (result === "connected") r.stores.serialDevice.setActiveDevice("spikerbit", fakeTransport());
        resolveConnect(result);
      });
    };
  }

  // A Spiker:bit attempt runs for seconds while it flashes, and the user can close and reopen the
  // pane meanwhile. The success then closes the reopened pane, which holds focus.
  it("a success after the pane was closed and reopened returns focus to the trigger", async () => {
    const r = openPane();
    const resolve = pendingConnect(r);
    const trigger = getTrigger(r.container);
    act(() => trigger.focus());
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(paneGroup().contains(document.activeElement)).toBe(true);
    await resolve("connected");
    expect(r.content.connectPaneOpen).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("a success with focus outside the pane leaves focus where it is", async () => {
    const r = openPane();
    const resolve = pendingConnect(r);
    const outside = document.createElement("input");
    document.body.appendChild(outside);
    act(() => outside.focus());
    await resolve("connected");
    expect(r.content.connectPaneOpen).toBe(false);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  // Deleting a tile destroys its model before the toolbar unmounts.
  it("a success after the tile was deleted does not touch the destroyed content", async () => {
    const r = openPane();
    const resolve = pendingConnect(r);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    destroy(r.model);
    r.unmount();
    await resolve("connected");
    const warnings = deadNodeWarnings(warn);
    warn.mockRestore();
    expect(warnings).toEqual([]);
  });

  it("a failed Connect keeps the pane open and shows the error", async () => {
    const r = openPane();
    jest.spyOn(r.connection, "connect").mockImplementation(failingAttempt("openFailed"));
    act(() => screen.getByRole("button", { name: "Connect Spiker:bit" }).focus());
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect Spiker:bit" })); });
    expect(r.content.connectPaneOpen).toBe(true);
    expect(within(paneGroup()).getByText("Couldn't open it.")).toBeInTheDocument();
    expect(within(paneGroup()).getByRole("button", { name: "Connect Arduino" })).toBeInTheDocument();
  });

  it("a failed Connect shows the error only in the pane of the tile where it was clicked", async () => {
    const Component = getToolbarButtonInfo("dataflow", "connect")!.component;
    const stores = specStores();
    const tiles = [TileModel.create({ content: DataflowContentModel.create() }),
      TileModel.create({ content: DataflowContentModel.create() })];
    jest.spyOn(getDeviceConnection(stores.serialDevice), "connect").mockImplementation(failingAttempt("openFailed"));
    render(
      <ModalProvider>
        <Provider stores={stores}>
          {tiles.map(model => (
            <div key={model.id} data-testid={model.id}>
              <TileModelContext.Provider value={model}>
                <Component name="connect" />
              </TileModelContext.Provider>
            </div>
          ))}
        </Provider>
      </ModalProvider>
    );
    const [a, b] = tiles.map(model => within(screen.getByTestId(model.id)));
    fireEvent.click(a.getByTestId("connect-device-button"));
    await act(async () => { fireEvent.click(a.getByRole("button", { name: "Connect Spiker:bit" })); });
    expect(a.getByText("Couldn't open it.")).toBeInTheDocument();
    fireEvent.click(b.getByTestId("connect-device-button"));
    expect(b.getByRole("group", { name: "Device connection" })).toBeInTheDocument();
    expect(b.queryByText(/Couldn't connect/)).toBeNull();
  });

  it("a canceled Connect keeps the pane open", async () => {
    const r = openPane();
    jest.spyOn(r.connection, "connect").mockResolvedValue("canceled");
    act(() => screen.getByRole("button", { name: "Connect Spiker:bit" }).focus());
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect Spiker:bit" })); });
    expect(r.content.connectPaneOpen).toBe(true);
    expect(within(paneGroup()).getByRole("button", { name: "Connect Spiker:bit" })).toBeInTheDocument();
  });

  // Reconnect disconnects first, so after a failed or canceled attempt nothing is connected.
  it.each<ConnectResult>(["openFailed", "canceled"])("a %s Reconnect keeps the pane open", async (result) => {
    const r = openPane();
    fakeConnected(r);
    jest.spyOn(r.connection, "reconnect").mockImplementation(async options => {
      r.stores.serialDevice.clearActiveDevice();
      return result === "openFailed" ? failingAttempt("openFailed")(options) : result;
    });
    act(() => screen.getByRole("button", { name: "Reconnect" }).focus());
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reconnect" })); });
    expect(r.content.connectPaneOpen).toBe(true);
    const error = within(paneGroup()).queryByText("Couldn't open it.");
    if (result === "openFailed") {
      expect(error).toBeInTheDocument();
    } else {
      expect(error).toBeNull();
    }
    expect(within(paneGroup()).getByRole("button", { name: "Connect Spiker:bit" })).toBeInTheDocument();
  });

  it("a device dropping does not pull focus into the pane when focus is elsewhere", () => {
    const r = openPane();
    fakeConnected(r);
    const outside = document.createElement("input");
    document.body.appendChild(outside);
    act(() => outside.focus());
    act(() => r.stores.serialDevice.clearActiveDevice());
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  // Focus that left the pane and then fell to <body> is not the pane's to restore.
  it("a device dropping does not pull focus into the pane after focus left it for <body>", () => {
    const r = openPane();
    fakeConnected(r);
    const outside = document.createElement("input");
    document.body.appendChild(outside);
    act(() => outside.focus());
    act(() => outside.remove());
    expect(document.activeElement).toBe(document.body);
    act(() => r.stores.serialDevice.clearActiveDevice());
    expect(document.activeElement).toBe(document.body);
  });

  it("Reconnect and Disconnect call the connection", async () => {
    const r = openPane();
    fakeConnected(r);
    const reconnect = jest.spyOn(r.connection, "reconnect").mockResolvedValue("canceled");
    const disconnect = jest.spyOn(r.connection, "disconnect").mockResolvedValue();
    fireEvent.keyDown(screen.getByRole("button", { name: "Reconnect" }), { key: " " });
    expect(reconnect).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Disconnect" })); });
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("Dataflow reset button", () => {
  beforeEach(() => (logTileChangeEvent as jest.Mock).mockClear());

  it("'reset' is registered and exposes accessible name 'Reset program'", () => {
    renderToolbarButton("reset");
    expect(screen.getByRole("button", { name: "Reset program" })).toBeInTheDocument();
  });

  it("reset is disabled with no rete manager and with a read-only one", () => {
    const first = renderToolbarButton("reset", { manager: null });
    expect(isDisabled(screen.getByRole("button", { name: "Reset program" }))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reset program" }));
    first.unmount();

    // A read-only manager is what a read-only view and Done-mode playback both use.
    const content = DataflowContentModel.create();
    const readOnlyManager = { ...makeManagerStub(content), readOnly: true };
    renderToolbarButton("reset", { content, manager: readOnlyManager });
    expect(isDisabled(screen.getByRole("button", { name: "Reset program" }))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reset program" }));
    expect(logTileChangeEvent).not.toHaveBeenCalled();
  });

  it("clicking reset resets the tile's program and logs resetProgram", () => {
    const content = DataflowContentModel.create();
    const resetSpy = jest.spyOn(content.program, "resetRunningState");
    renderToolbarButton("reset", { content });
    const button = screen.getByRole("button", { name: "Reset program" });
    expect(isDisabled(button)).toBe(false);
    fireEvent.click(button);
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.DATAFLOW_TOOL_CHANGE, {
      tileId: expect.any(String), operation: "resetProgram", change: { targetType: "program", trigger: "button" }
    });
  });
});

describe("Dataflow connect pane keyboard navigation in the real toolbar", () => {
  function PaneTile({ model }: { model: ITileModel }) {
    const [tileElt, setTileElt] = React.useState<HTMLDivElement | null>(null);
    return (
      <TileModelContext.Provider value={model}>
        <div ref={setTileElt} className="tool-tile" data-tool-id={model.id} tabIndex={-1}>Tile content.</div>
        {tileElt && <TileToolbar readOnly={false} tileElement={tileElt} tileType="dataflow" />}
      </TileModelContext.Provider>
    );
  }

  function renderRealToolbar() {
    const stores = specStores({
      appConfig: specAppConfig({ config: { settings: { dataflow: { tools: ["reset", "connect"] } } } })
    });
    const model = TileModel.create({ content: DataflowContentModel.create() });
    stores.ui.setSelectedTileId(model.id);
    const result = render(
      <ModalProvider>
        <Provider stores={stores}>
          <ReadOnlyContext.Provider value={false}>
            <PaneTile model={model} />
          </ReadOnlyContext.Provider>
        </Provider>
      </ModalProvider>
    );
    return { ...result, content: model.content as DataflowContentModelType };
  }

  const press = (key: string) => fireEvent.keyDown(document.activeElement as Element, { key });
  const focusedName = () => document.activeElement?.getAttribute("aria-label");

  function openRealPane() {
    const r = renderRealToolbar();
    fireEvent.click(screen.getByTestId("tile-toolbar").querySelector("button.toolbar-button.connect")!);
    return r;
  }

  it("arrow keys, Home and End move focus among the pane's controls instead of the toolbar's buttons", () => {
    openRealPane();
    expect(focusedName()).toBe("Connect Arduino");
    press("ArrowDown");
    expect(focusedName()).toBe("Connect micro:bit (radio hub)");
    press("ArrowDown");
    expect(focusedName()).toBe("Connect Spiker:bit");
    press("ArrowDown");
    expect(focusedName()).toBe("Connect Arduino");
    press("ArrowUp");
    expect(focusedName()).toBe("Connect Spiker:bit");
    press("ArrowLeft");
    expect(focusedName()).toBe("Connect micro:bit (radio hub)");
    press("ArrowRight");
    expect(focusedName()).toBe("Connect Spiker:bit");
    press("Home");
    expect(focusedName()).toBe("Connect Arduino");
    press("End");
    expect(focusedName()).toBe("Connect Spiker:bit");
  });

  it("arrow keys in the pane keep the pane open and are not left to default handling", () => {
    const { content } = openRealPane();
    const notCanceled = fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
    expect(notCanceled).toBe(false);
    expect(content.connectPaneOpen).toBe(true);
  });

  // Reset comes first in this toolbar, so a trigger lookup that lands on the row's first button fails.
  it("Escape closes the pane and returns focus to the connect button", () => {
    const { content } = openRealPane();
    press("Escape");
    expect(content.connectPaneOpen).toBe(false);
    expect(document.activeElement).toBe(
      screen.getByTestId("tile-toolbar").querySelector("button.toolbar-button.connect"));
  });
});
