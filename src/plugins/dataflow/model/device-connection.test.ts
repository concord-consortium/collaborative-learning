import { SerialDevice } from "../../../models/stores/serial";
import {
  IMicrobitUsbConnection, kSpikerbitFirmwareVersion, SpikerbitDevice
} from "../../../models/stores/spikerbit-device";
import { WebSerialOpenResult, WebSerialTransport } from "../../../models/stores/web-serial-transport";
import {
  DeviceConnection, getDeviceConnection, IDeviceConnectionDeps, kEndSessionTimeoutMs
} from "./device-connection";

function makePort(usbVendorId: number, usbProductId: number) {
  return { getInfo: () => ({ usbVendorId, usbProductId }) } as unknown as SerialPort;
}

function makeTransport(
  results: WebSerialOpenResult[] = ["opened"],
  options: { deviceFamily?: string | undefined, lastPort?: SerialPort } = {}
) {
  const open = jest.fn();
  results.forEach(r => open.mockResolvedValueOnce(r));
  open.mockResolvedValue(results[results.length - 1]);
  return {
    open,
    close: jest.fn().mockResolvedValue(undefined),
    startReading: jest.fn(),
    write: jest.fn(),
    deviceFamily: "deviceFamily" in options ? options.deviceFamily : "arduino",
    raisesWebSerialConnect: true,
    lastPort: options.lastPort ?? makePort(1, 2)
  };
}
type FakeTransport = ReturnType<typeof makeTransport>;

function setup(transports: FakeTransport[], extra: Partial<IDeviceConnectionDeps> = {}) {
  const serialDevice = new SerialDevice();
  const queue = [...transports];
  const createWebSerialTransport = jest.fn(() => queue.shift() as unknown as WebSerialTransport);
  const connection = new DeviceConnection(serialDevice, {
    createWebSerialTransport,
    getSpikerbitFlashDataSource: () => "flash-source",
    ...extra
  });
  return { serialDevice, connection, createWebSerialTransport };
}

function makeSpikerbit(serialDevice: SerialDevice) {
  const transport = { write: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };
  const device = {
    connectAndStream: jest.fn(async () => { serialDevice.setActiveDevice("spikerbit", transport); }),
    disconnect: jest.fn().mockResolvedValue(undefined)
  };
  return { device, transport };
}

// A fake @microbit/microbit-connection USB connection for driving a real SpikerbitDevice.
function makeUsbConnection(options: { failWrite?: boolean } = {}) {
  const serialListeners: Array<(d: { data: string }) => void> = [];
  const connection = {
    addEventListener: jest.fn((type: string, listener: (d: { data: string }) => void) => {
      if (type === "serialdata") serialListeners.push(listener);
    }),
    connect: jest.fn().mockResolvedValue(undefined),
    flash: jest.fn().mockResolvedValue(undefined),
    serialWrite: jest.fn(async (data: string) => {
      if (options.failWrite) throw new Error("write failed");
      if (data === "?\n") {
        serialListeners.forEach(l => l({ data: `CLUE-SPIKERBIT v${kSpikerbitFirmwareVersion}\r\n` }));
      }
    }),
    disconnect: jest.fn().mockResolvedValue(undefined)
  };
  return connection;
}

function realSpikerbitDeps(usbConnection: ReturnType<typeof makeUsbConnection>): Partial<IDeviceConnectionDeps> {
  return {
    createSpikerbitDevice: (serialDevice) =>
      new SpikerbitDevice(serialDevice, usbConnection as unknown as IMicrobitUsbConnection),
    getSpikerbitFlashDataSource: () => "flash-source"
  };
}

describe("DeviceConnection", () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => { errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined); });
  afterEach(() => errorSpy.mockRestore());

  it("connect('arduino') opens a Web Serial port, makes it the active device and returns connected", async () => {
    const transport = makeTransport();
    const { serialDevice, connection } = setup([transport]);
    expect(await connection.connect("arduino")).toBe("connected");
    expect(serialDevice.isConnected()).toBe(true);
    expect(serialDevice.deviceFamily).toBe("arduino");
    expect(serialDevice.raisesWebSerialConnect).toBe(true);
    expect(transport.startReading).toHaveBeenCalled();
    expect(connection.connectedLabel).toBe("Arduino");
  });

  it("connectedLabel is the device choice's label, not the detected family", async () => {
    const { connection } = setup([makeTransport(["opened"], { deviceFamily: "arduino" })]);
    await connection.connect("microbitHub");
    expect(connection.connectedLabel).toBe("micro:bit (radio hub)");
  });

  it("connect returns canceled when the chooser is dismissed and leaves nothing connected", async () => {
    const { serialDevice, connection } = setup([makeTransport(["canceled"])]);
    expect(await connection.connect("arduino")).toBe("canceled");
    expect(serialDevice.isConnected()).toBe(false);
    expect(connection.connectedLabel).toBeUndefined();
  });

  it("connect returns failed when the port can't be opened", async () => {
    const { serialDevice, connection } = setup([makeTransport(["failed"])]);
    expect(await connection.connect("arduino")).toBe("failed");
    expect(serialDevice.isConnected()).toBe(false);
  });

  it("connect returns failed and closes the transport when no device family is detected", async () => {
    const transport = makeTransport(["opened"], { deviceFamily: undefined });
    const { serialDevice, connection } = setup([transport]);
    expect(await connection.connect("arduino")).toBe("failed");
    expect(transport.close).toHaveBeenCalled();
    expect(serialDevice.isConnected()).toBe(false);
  });

  it("connect('spikerbit') streams through the Spiker:bit device", async () => {
    const serialDevice = new SerialDevice();
    const { device } = makeSpikerbit(serialDevice);
    const connection = new DeviceConnection(serialDevice, {
      createSpikerbitDevice: () => device as unknown as SpikerbitDevice,
      getSpikerbitFlashDataSource: () => "flash-source"
    });
    expect(await connection.connect("spikerbit")).toBe("connected");
    expect(device.connectAndStream).toHaveBeenCalledWith("flash-source");
    expect(connection.connectedLabel).toBe("Spiker:bit");
  });

  it("connect('spikerbit') returns canceled on no-device-selected", async () => {
    const serialDevice = new SerialDevice();
    const device = {
      connectAndStream: jest.fn().mockRejectedValue({ code: "no-device-selected" }),
      disconnect: jest.fn().mockResolvedValue(undefined)
    };
    const connection = new DeviceConnection(serialDevice, {
      createSpikerbitDevice: () => device as unknown as SpikerbitDevice
    });
    expect(await connection.connect("spikerbit")).toBe("canceled");
    expect(serialDevice.isConnected()).toBe(false);
  });

  it("connect('spikerbit') returns failed on any other error", async () => {
    const serialDevice = new SerialDevice();
    const device = {
      connectAndStream: jest.fn().mockRejectedValue(new Error("boom")),
      disconnect: jest.fn().mockResolvedValue(undefined)
    };
    const connection = new DeviceConnection(serialDevice, {
      createSpikerbitDevice: () => device as unknown as SpikerbitDevice
    });
    expect(await connection.connect("spikerbit")).toBe("failed");
    expect(connection.busyChoice).toBeUndefined();
  });

  it("connect while busy is ignored", async () => {
    const { connection, createWebSerialTransport } = setup([makeTransport()]);
    const first = connection.connect("arduino");
    expect(connection.busyChoice).toBe("arduino");
    expect(await connection.connect("arduino")).toBe("canceled");
    expect(await first).toBe("connected");
    expect(createWebSerialTransport).toHaveBeenCalledTimes(1);
    expect(connection.busyChoice).toBeUndefined();
  });

  it("reconnect with no previous connection returns canceled", async () => {
    const { connection, createWebSerialTransport } = setup([]);
    expect(await connection.reconnect()).toBe("canceled");
    expect(createWebSerialTransport).not.toHaveBeenCalled();
  });

  it("reconnect reopens the last Web Serial port without the chooser", async () => {
    const first = makeTransport();
    const second = makeTransport();
    const { serialDevice, connection } = setup([first, second]);
    await connection.connect("arduino");
    await connection.disconnect();
    expect(await connection.reconnect()).toBe("connected");
    expect(second.open).toHaveBeenCalledWith(first.lastPort);
    expect(serialDevice.isConnected()).toBe(true);
    expect(connection.connectedLabel).toBe("Arduino");
  });

  it("reconnect while connected closes the current transport before reopening", async () => {
    const order: string[] = [];
    const first = makeTransport();
    const second = makeTransport();
    first.close.mockImplementation(async () => { order.push("close"); });
    second.open.mockReset().mockImplementation(async () => { order.push("open"); return "opened"; });
    const { serialDevice, connection } = setup([first, second]);
    await connection.connect("arduino");
    expect(await connection.reconnect()).toBe("connected");
    expect(order).toEqual(["close", "open"]);
    expect(serialDevice.activeTransport).toBe(second);
  });

  it("connect while connected disconnects first", async () => {
    const order: string[] = [];
    const first = makeTransport();
    const second = makeTransport();
    first.close.mockImplementation(async () => { order.push("close"); });
    second.open.mockReset().mockImplementation(async () => { order.push("open"); return "opened"; });
    const { serialDevice, connection } = setup([first, second]);
    await connection.connect("arduino");
    expect(await connection.connect("arduino")).toBe("connected");
    expect(order).toEqual(["close", "open"]);
    expect(serialDevice.activeTransport).toBe(second);
  });

  it("reconnect falls back to the chooser when no known port opens", async () => {
    const first = makeTransport();
    const second = makeTransport(["failed"]);
    const third = makeTransport(["opened"]);
    const { connection } = setup([first, second, third]);
    await connection.connect("arduino");
    await connection.disconnect();
    expect(await connection.reconnect()).toBe("connected");
    expect(second.open).toHaveBeenCalledWith(first.lastPort);
    expect(third.open).toHaveBeenCalledWith();
  });

  it("a late disconnect does not clear a connection made while its close was pending", async () => {
    const first = makeTransport();
    let finishClose: () => void = () => undefined;
    first.close.mockImplementation(() => new Promise<void>(resolve => { finishClose = resolve; }));
    const second = makeTransport();
    const { serialDevice, connection } = setup([first]);
    await connection.connect("arduino");

    const disconnecting = connection.disconnect();
    // Let disconnect reach the pending close, which comes after ending the session.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(first.close).toHaveBeenCalled();
    serialDevice.setActiveDevice("arduino", second);
    finishClose();
    await disconnecting;

    expect(serialDevice.activeTransport).toBe(second);
    expect(serialDevice.isConnected()).toBe(true);
  });

  it("reconnect reuses the Spiker:bit device", async () => {
    const serialDevice = new SerialDevice();
    const { device } = makeSpikerbit(serialDevice);
    const createSpikerbitDevice = jest.fn(() => device as unknown as SpikerbitDevice);
    const connection = new DeviceConnection(serialDevice, { createSpikerbitDevice });
    await connection.connect("spikerbit");
    await connection.disconnect();
    expect(await connection.reconnect()).toBe("connected");
    expect(createSpikerbitDevice).toHaveBeenCalledTimes(1);
    expect(device.connectAndStream).toHaveBeenCalledTimes(2);
  });

  it("connect('spikerbit') after a disconnect uses a fresh device (shows the chooser)", async () => {
    const serialDevice = new SerialDevice();
    const first = makeSpikerbit(serialDevice);
    const second = makeSpikerbit(serialDevice);
    const createSpikerbitDevice = jest.fn()
      .mockReturnValueOnce(first.device)
      .mockReturnValueOnce(second.device);
    const connection = new DeviceConnection(serialDevice, {
      createSpikerbitDevice, getSpikerbitFlashDataSource: () => "flash-source"
    });
    await connection.connect("spikerbit");
    await connection.disconnect();
    expect(await connection.connect("spikerbit")).toBe("connected");
    expect(createSpikerbitDevice).toHaveBeenCalledTimes(2);
    expect(first.device.connectAndStream).toHaveBeenCalledTimes(1);
    expect(first.device.disconnect).toHaveBeenCalled();
    expect(second.device.connectAndStream).toHaveBeenCalledWith("flash-source");
    expect(serialDevice.activeTransport).toBe(second.transport);
  });

  it("reconnect falls back to a fresh Spiker:bit device when the known one fails", async () => {
    const serialDevice = new SerialDevice();
    const first = makeSpikerbit(serialDevice);
    const second = makeSpikerbit(serialDevice);
    const createSpikerbitDevice = jest.fn()
      .mockReturnValueOnce(first.device)
      .mockReturnValueOnce(second.device);
    const connection = new DeviceConnection(serialDevice, {
      createSpikerbitDevice, getSpikerbitFlashDataSource: () => "flash-source"
    });
    await connection.connect("spikerbit");
    await connection.disconnect();
    first.device.connectAndStream.mockRejectedValueOnce(new Error("device unplugged"));
    expect(await connection.reconnect()).toBe("connected");
    expect(first.device.connectAndStream).toHaveBeenCalledTimes(2);
    expect(first.device.disconnect).toHaveBeenCalled();
    expect(createSpikerbitDevice).toHaveBeenCalledTimes(2);
    expect(second.device.connectAndStream).toHaveBeenCalledTimes(1);
    expect(serialDevice.activeTransport).toBe(second.transport);
  });

  it("a failed Spiker:bit attempt disconnects the library connection", async () => {
    const serialDevice = new SerialDevice();
    const usbConnection = makeUsbConnection({ failWrite: true });
    const connection = new DeviceConnection(serialDevice, realSpikerbitDeps(usbConnection));
    expect(await connection.connect("spikerbit")).toBe("failed");
    expect(usbConnection.connect).toHaveBeenCalled();
    expect(usbConnection.disconnect).toHaveBeenCalled();
    expect(serialDevice.isConnected()).toBe(false);
  });

  it("disconnect closes a Spiker:bit connection", async () => {
    const serialDevice = new SerialDevice();
    const usbConnection = makeUsbConnection();
    const connection = new DeviceConnection(serialDevice, realSpikerbitDeps(usbConnection));
    expect(await connection.connect("spikerbit")).toBe("connected");
    expect(usbConnection.disconnect).not.toHaveBeenCalled();
    await connection.disconnect();
    expect(usbConnection.disconnect).toHaveBeenCalled();
    expect(serialDevice.isConnected()).toBe(false);
  });

  it("reconnect while a Spiker:bit is connected closes it, then reopens the same device", async () => {
    const serialDevice = new SerialDevice();
    const usbConnection = makeUsbConnection();
    const deps = realSpikerbitDeps(usbConnection);
    const createSpikerbitDevice = jest.fn(deps.createSpikerbitDevice!);
    const connection = new DeviceConnection(serialDevice, { ...deps, createSpikerbitDevice });
    expect(await connection.connect("spikerbit")).toBe("connected");

    expect(await connection.reconnect()).toBe("connected");
    expect(createSpikerbitDevice).toHaveBeenCalledTimes(1);
    expect(usbConnection.disconnect).toHaveBeenCalledTimes(1);
    expect(usbConnection.connect).toHaveBeenCalledTimes(2);
    expect(usbConnection.disconnect.mock.invocationCallOrder[0])
      .toBeLessThan(usbConnection.connect.mock.invocationCallOrder[1]);
    expect(serialDevice.activeTransport).toBeDefined();
  });

  it("disconnect closes the transport and clears the active device", async () => {
    const transport = makeTransport();
    const { serialDevice, connection } = setup([transport]);
    await connection.connect("arduino");
    await connection.disconnect();
    expect(transport.close).toHaveBeenCalled();
    expect(serialDevice.isConnected()).toBe(false);
    expect(connection.connectedLabel).toBeUndefined();
  });

  it("ends the device session before closing the transport", async () => {
    const transport = makeTransport();
    const { serialDevice, connection } = setup([transport]);
    await connection.connect("arduino");
    const order: string[] = [];
    jest.spyOn(serialDevice, "endSession").mockImplementation(async () => { order.push("endSession"); });
    transport.close.mockImplementation(async () => { order.push("close"); });
    await connection.disconnect();
    expect(order).toEqual(["endSession", "close"]);
  });

  it("still closes the transport when ending the session fails", async () => {
    const transport = makeTransport();
    const { serialDevice, connection } = setup([transport]);
    await connection.connect("arduino");
    jest.spyOn(serialDevice, "endSession").mockRejectedValue(new Error("write failed"));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await connection.disconnect();
    expect(transport.close).toHaveBeenCalled();
    expect(serialDevice.isConnected()).toBe(false);
    consoleError.mockRestore();
  });

  it("still closes the transport when ending the session never settles", async () => {
    jest.useFakeTimers();
    try {
      const transport = makeTransport();
      const { serialDevice, connection } = setup([transport]);
      await connection.connect("arduino");
      jest.spyOn(serialDevice, "endSession").mockImplementation(() => new Promise<void>(() => undefined));
      const disconnecting = connection.disconnect();
      await jest.advanceTimersByTimeAsync(kEndSessionTimeoutMs);
      await disconnecting;
      expect(transport.close).toHaveBeenCalled();
      expect(serialDevice.isConnected()).toBe(false);
      expect(connection.busyChoice).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it("starts with the connect tutorial dismissed when a device is already connected", () => {
    const serialDevice = new SerialDevice();
    serialDevice.setActiveDevice("arduino", { write: jest.fn(), close: jest.fn() });
    const connection = new DeviceConnection(serialDevice);
    expect(connection.connectTutorialDismissed).toBe(true);
    expect(connection.connectTutorialDismissal).toEqual({ by: "connection" });
  });

  it("keeps the first thing that dismissed the connect tutorial", () => {
    const serialDevice = new SerialDevice();
    const connection = new DeviceConnection(serialDevice);
    expect(connection.connectTutorialDismissed).toBe(false);
    connection.dismissConnectTutorial({ by: "ok", tileId: "tile1" });
    serialDevice.setActiveDevice("arduino", { write: jest.fn(), close: jest.fn() });
    expect(connection.connectTutorialDismissal).toEqual({ by: "ok", tileId: "tile1" });
  });

  it("getDeviceConnection returns one instance per SerialDevice", () => {
    const a = new SerialDevice();
    const b = new SerialDevice();
    expect(getDeviceConnection(a)).toBe(getDeviceConnection(a));
    expect(getDeviceConnection(a)).not.toBe(getDeviceConnection(b));
  });
});
