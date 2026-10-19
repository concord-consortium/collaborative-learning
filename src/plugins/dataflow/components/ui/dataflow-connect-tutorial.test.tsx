import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DataflowContentModel } from "../../model/dataflow-content";
import { DeviceConnection } from "../../model/device-connection";
import { SerialDevice } from "../../../../models/stores/serial";
import { createClueTileStrategy } from "../../../../hooks/create-clue-tile-strategy";
import { DataflowConnectTutorialGate } from "./dataflow-connect-tutorial";
import { getDataflowFocusSlots } from "../dataflow-focus-slots";

const kTitle = "This program uses a real device";

function openedContent() {
  const content = DataflowContentModel.create();
  content.setShowConnectTutorialOnOpen(true);
  return content;
}

function connectedDevice(serialDevice: SerialDevice) {
  serialDevice.setActiveDevice("arduino", { write: jest.fn(), close: jest.fn() });
}

function renderTile(
  content: ReturnType<typeof openedContent>, connection: DeviceConnection, readOnly = false
) {
  return render(
    <DataflowConnectTutorialGate
      content={content} connection={connection} readOnly={readOnly}
      onDismiss={() => connection.dismissConnectTutorial()}
    />
  );
}

describe("DataflowConnectTutorialGate", () => {
  it("shows on an editable tile whose program needed a device when it opened", () => {
    renderTile(openedContent(), new DeviceConnection(new SerialDevice()));
    const dialog = screen.getByRole("dialog", { name: kTitle });
    expect(dialog).toHaveTextContent("Connect your Arduino, micro:bit or Spiker:bit to the computer.");
    expect(dialog).toHaveTextContent("⚡ button in this tile's toolbar");
    expect(screen.getByRole("button", { name: "OK" }).tagName).toBe("BUTTON");
  });

  it("does not move focus when it mounts", () => {
    renderTile(openedContent(), new DeviceConnection(new SerialDevice()));
    expect(document.body).toHaveFocus();
  });

  it("does not show when a device is connected", () => {
    const serialDevice = new SerialDevice();
    connectedDevice(serialDevice);
    renderTile(openedContent(), new DeviceConnection(serialDevice));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not show when read-only", () => {
    renderTile(openedContent(), new DeviceConnection(new SerialDevice()), true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("one OK dismisses it on every tile", () => {
    const connection = new DeviceConnection(new SerialDevice());
    render(
      <>
        <DataflowConnectTutorialGate content={openedContent()} connection={connection}
          onDismiss={() => connection.dismissConnectTutorial()} />
        <DataflowConnectTutorialGate content={openedContent()} connection={connection}
          onDismiss={() => connection.dismissConnectTutorial()} />
      </>
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "OK" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not show when an edit later makes the program need a device", () => {
    const content = DataflowContentModel.create();
    renderTile(content, new DeviceConnection(new SerialDevice()));
    act(() => { content.setNeedsDevice(true); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not come back after a disconnect of a device connected while it was showing", () => {
    const serialDevice = new SerialDevice();
    const connection = new DeviceConnection(serialDevice);
    renderTile(openedContent(), connection);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => { connectedDevice(serialDevice); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => { serialDevice.clearActiveDevice(); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("gives each open dialog its own title id", () => {
    const connection = new DeviceConnection(new SerialDevice());
    render(
      <>
        <DataflowConnectTutorialGate content={openedContent()} connection={connection} onDismiss={jest.fn()} />
        <DataflowConnectTutorialGate content={openedContent()} connection={connection} onDismiss={jest.fn()} />
      </>
    );
    const [a, b] = screen.getAllByRole("dialog");
    expect(a.getAttribute("aria-labelledby")).not.toBe(b.getAttribute("aria-labelledby"));
    expect(a).toHaveAccessibleDescription(/Connect your Arduino/);
  });

  describe("keyboard focus slots", () => {
    function setupTile() {
      const serialDevice = new SerialDevice();
      const connection = new DeviceConnection(serialDevice);
      const { container } = render(
        <div className="tool-tile">
          <div className="editable-tile-title"><input aria-label="title" /></div>
          <div className="program">
            <div className="program-editor-topbar"><button>Record</button></div>
            <div className="dataflow-program-content"><button>Block</button></div>
            <div className="program-toolbar"><button>Add</button></div>
          </div>
          <DataflowConnectTutorialGate content={openedContent()} connection={connection}
            onDismiss={() => connection.dismissConnectTutorial()} />
        </div>
      );
      const tileElt = container.firstElementChild as HTMLElement;
      const strategy = createClueTileStrategy({
        onRegisterTileApi: jest.fn(), onUnregisterTileApi: jest.fn(), tileType: "dataflow",
        getTitleElement: () => getDataflowFocusSlots({ tileElt, programContainerEl: tileElt }).title,
        getContentElement: () => getDataflowFocusSlots({ tileElt, programContainerEl: tileElt }).content,
        getTopbarElement: () => getDataflowFocusSlots({ tileElt, programContainerEl: tileElt }).topbar,
        getPaletteElement: () => getDataflowFocusSlots({ tileElt, programContainerEl: tileElt }).palette
      });
      const firstSlot = () => {
        const elements = strategy.getElements();
        const name = (strategy.cycleOrder ?? []).find(slot => elements[slot]);
        return name && elements[name];
      };
      return { strategy, firstSlot };
    }

    it("makes the dialog the first slot and hides the title, topbar and palette while showing", () => {
      const { strategy, firstSlot } = setupTile();
      const elements = strategy.getElements();
      expect(elements.title).toBeUndefined();
      expect(elements.topbar).toBeUndefined();
      expect(elements.palette).toBeUndefined();
      expect(firstSlot()).toContainElement(screen.getByRole("button", { name: "OK" }));
    });

    it("brings the normal slots back after OK", () => {
      const { strategy, firstSlot } = setupTile();
      fireEvent.click(screen.getByRole("button", { name: "OK" }));
      const elements = strategy.getElements();
      expect(elements.title).toBeDefined();
      expect(elements.topbar).toHaveClass("program-editor-topbar");
      expect(elements.palette).toHaveClass("program-toolbar");
      expect(elements.content).toHaveClass("dataflow-program-content");
      expect(firstSlot()).toBe(elements.title);
    });
  });
});
