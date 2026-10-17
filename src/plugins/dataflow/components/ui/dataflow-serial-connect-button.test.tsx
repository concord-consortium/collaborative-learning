import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { runInAction } from "mobx";
import { SerialDevice } from "../../../../models/stores/serial";
import { DeviceConnection } from "../../model/device-connection";
import { DataflowSerialConnectButton } from "./dataflow-serial-connect-button";

function setup(options: { connected?: boolean } = {}) {
  const serialDevice = new SerialDevice();
  if (options.connected) {
    serialDevice.setActiveDevice("arduino", { write: jest.fn(), close: jest.fn() });
  }
  const connection = new DeviceConnection(serialDevice);
  const handlers = {
    onConnectDevice: jest.fn(),
    onReconnectDevice: jest.fn(),
    onDisconnectDevice: jest.fn()
  };
  render(
    <DataflowSerialConnectButton
      serialDevice={serialDevice}
      connection={connection}
      needsDevice={true}
      {...handlers}
    />
  );
  fireEvent.click(screen.getByTitle("Connect a device"));
  return { connection, ...handlers };
}

describe("DataflowSerialConnectButton menu", () => {
  it("shows the three device choices when nothing is connected", () => {
    setup();
    expect(screen.getByRole("button", { name: "Arduino" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "micro:bit (radio hub)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spiker:bit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reconnect" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disconnect" })).not.toBeInTheDocument();
  });

  it("shows Reconnect and Disconnect instead when a device is connected", () => {
    const { onReconnectDevice, onDisconnectDevice } = setup({ connected: true });
    expect(screen.queryByRole("button", { name: "Arduino" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "micro:bit (radio hub)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Spiker:bit" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(onReconnectDevice).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTitle("Connect a device"));
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(onDisconnectDevice).toHaveBeenCalledTimes(1);
  });

  it("choosing a device calls onConnectDevice with its choice", () => {
    const { onConnectDevice } = setup();
    fireEvent.click(screen.getByRole("button", { name: "micro:bit (radio hub)" }));
    expect(onConnectDevice).toHaveBeenCalledWith("microbitHub");
  });

  it("disables every menu control while a connection attempt is in progress", () => {
    const { connection } = setup();
    act(() => { runInAction(() => { connection.busyChoice = "arduino"; }); });
    for (const name of ["Arduino", "micro:bit (radio hub)", "Spiker:bit"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("disables Reconnect and Disconnect while a connection attempt is in progress", () => {
    const { connection } = setup({ connected: true });
    act(() => { runInAction(() => { connection.busyChoice = "arduino"; }); });
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeDisabled();
  });
});
