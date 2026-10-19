import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DataflowContentModel } from "../../model/dataflow-content";
import { DeviceConnection } from "../../model/device-connection";
import { SerialDevice } from "../../../../models/stores/serial";
import { DataflowConnectTutorialGate } from "./dataflow-connect-tutorial";

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

  it("does not come back after a disconnect when the flag was never set", () => {
    const serialDevice = new SerialDevice();
    connectedDevice(serialDevice);
    renderTile(DataflowContentModel.create(), new DeviceConnection(serialDevice));
    act(() => { serialDevice.clearActiveDevice(); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
