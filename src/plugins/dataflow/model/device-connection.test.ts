import { autorun } from "mobx";
import { SerialDevice } from "../../../models/stores/serial";
import {
  IMicrobitUsbConnection, ISpikerbitConnectObserver, kSpikerbitFirmwareVersion, SpikerbitDevice
} from "../../../models/stores/spikerbit-device";
import {
  IWebSerialOpenOptions, WebSerialOpenResult, WebSerialTransport
} from "../../../models/stores/web-serial-transport";
import { withChecksum } from "../../../models/stores/cc-device-protocol";
import {
  DeviceConnection, getDeviceConnection, IDeviceConnectionDeps, kFirstDataTimeoutMs, kIdentifyResultMs,
  kOpenTimeoutMs, kUpdateStartMs, kUpdateStallMs
} from "./device-connection";
import { IdentifyResult } from "../../../models/stores/cc-device-session";

function makePort(usbVendorId: number, usbProductId: number) {
  return { getInfo: () => ({ usbVendorId, usbProductId }) } as unknown as SerialPort;
}

// With sendsData (the default), the board sends a line as soon as reading starts.
function makeTransport(
  results: WebSerialOpenResult[] = ["opened"],
  options: { deviceFamily?: string | undefined, lastPort?: SerialPort, sendsData?: boolean } = {}
) {
  const open = jest.fn();
  results.forEach(r => open.mockResolvedValueOnce(r));
  open.mockResolvedValue(results[results.length - 1]);
  const transport = {
    open,
    close: jest.fn().mockResolvedValue(undefined),
    startReading: jest.fn(() => {
      if (options.sendsData ?? true) transport.onData?.("emg:1\r\n");
    }),
    write: jest.fn(),
    deviceFamily: "deviceFamily" in options ? options.deviceFamily : "arduino",
    raisesWebSerialConnect: true,
    lastPort: options.lastPort ?? makePort(1, 2),
    lastOpenError: undefined as unknown,
    onData: undefined as ((chunk: string) => void) | undefined,
    onDisconnect: undefined as ((loss: "unplugged" | "lost") => void) | undefined
  };
  return transport;
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

// A Spiker:bit that connects at once and sends a line as soon as it is active.
function makeSpikerbit(serialDevice: SerialDevice) {
  const transport: { write: jest.Mock, close: jest.Mock, onData?: (chunk: string) => void } =
    { write: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };
  const device = {
    connectAndStream: jest.fn(async (_source: unknown, observer?: ISpikerbitConnectObserver) => {
      observer?.onOpened?.();
      observer?.onFirmwareChecked?.(null, false);
      serialDevice.setActiveDevice("spikerbit", transport);
      transport.onData?.("data\r\n");
    }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn()
  };
  return { device, transport };
}

// A fake @microbit/microbit-connection USB connection for driving a real SpikerbitDevice.
// With reportsDisconnect, its disconnect raises the library's Disconnected status, as the real one does.
function makeUsbConnection(options: { failWrite?: boolean, reportsDisconnect?: boolean, firmware?: number } = {}) {
  const usbDevice = {};
  const serialListeners: Array<(d: { data: string }) => void> = [];
  const statusListeners: Array<(d: { status: string }) => void> = [];
  const connection = {
    addEventListener: jest.fn((type: string, listener: (d: any) => void) => {
      if (type === "serialdata") serialListeners.push(listener);
      if (type === "status") statusListeners.push(listener);
    }),
    connect: jest.fn().mockResolvedValue(undefined),
    flash: jest.fn().mockResolvedValue(undefined),
    serialWrite: jest.fn(async (data: string) => {
      if (options.failWrite) throw new Error("write failed");
      const send = (line: string) => serialListeners.forEach(l => l({ data: `${line}\r\n` }));
      // Answers as firmware 4 does: "!! #n" with an empty line and its ok, "?" with the hello
      // line, and a session's open with its ok.
      data.split("\n").forEach(line => {
        const seq = /^(?:!!|open session:\d+) #(\d+)\*/.exec(line)?.[1];
        if (line.startsWith("!!") && seq) send("");
        if (seq) send(withChecksum(`ok #${seq}`));
        if (line === "?") {
          send(withChecksum(
            `hello protocol:CCDeviceProtocol version:1 device:spikerbit firmware:${
              options.firmware ?? kSpikerbitFirmwareVersion}`));
        }
      });
    }),
    disconnect: jest.fn(async () => {
      if (options.reportsDisconnect) statusListeners.forEach(l => l({ status: "Disconnected" }));
    }),
    getDevice: () => usbDevice
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

  it("connect returns openFailed when the port can't be opened", async () => {
    const { serialDevice, connection } = setup([makeTransport(["failed"])]);
    expect(await connection.connect("arduino")).toBe("openFailed");
    expect(serialDevice.isConnected()).toBe(false);
  });

  it("connect returns openFailed and closes the transport when no device family is detected", async () => {
    const transport = makeTransport(["opened"], { deviceFamily: undefined });
    const { serialDevice, connection } = setup([transport]);
    expect(await connection.connect("arduino")).toBe("openFailed");
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
    expect(device.connectAndStream).toHaveBeenCalledWith("flash-source", expect.any(Object));
    expect(connection.connectedLabel).toBe("Spiker:bit");
  });

  it("connect('spikerbit') returns canceled on no-device-selected", async () => {
    const serialDevice = new SerialDevice();
    const device = {
      connectAndStream: jest.fn().mockRejectedValue({ code: "no-device-selected" }),
      disconnect: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn()
    };
    const connection = new DeviceConnection(serialDevice, {
      createSpikerbitDevice: () => device as unknown as SpikerbitDevice
    });
    expect(await connection.connect("spikerbit")).toBe("canceled");
    expect(serialDevice.isConnected()).toBe(false);
  });

  it("connect('spikerbit') returns openFailed on any other error before the open", async () => {
    const serialDevice = new SerialDevice();
    const device = {
      connectAndStream: jest.fn().mockRejectedValue(new Error("boom")),
      disconnect: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn()
    };
    const connection = new DeviceConnection(serialDevice, {
      createSpikerbitDevice: () => device as unknown as SpikerbitDevice
    });
    expect(await connection.connect("spikerbit")).toBe("openFailed");
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
    expect(second.open).toHaveBeenCalledWith(first.lastPort, expect.anything());
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
    expect(second.open).toHaveBeenCalledWith(first.lastPort, expect.anything());
    expect(third.open).toHaveBeenCalledWith(undefined, expect.anything());
  });

  it("reconnect whose last port is still opening ends as openTimeout without the chooser", async () => {
    const first = makeTransport();
    const second = makeTransport(["stillOpening"]);
    const { connection, createWebSerialTransport } = setup([first, second, makeTransport()]);
    await connection.connect("arduino");
    await connection.disconnect();
    expect(await connection.reconnect()).toBe("openTimeout");
    expect(second.open).toHaveBeenCalledWith(first.lastPort, expect.anything());
    expect(createWebSerialTransport).toHaveBeenCalledTimes(2);
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
    expect(second.device.connectAndStream).toHaveBeenCalledWith("flash-source", expect.any(Object));
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
    expect(await connection.connect("spikerbit")).toBe("updateFailed");
    expect(usbConnection.connect).toHaveBeenCalled();
    expect(usbConnection.disconnect).toHaveBeenCalled();
    expect(serialDevice.isConnected()).toBe(false);
  });

  it("connects to a current Spiker:bit without flashing; disconnect closes its session and link", async () => {
    const serialDevice = new SerialDevice();
    const usbConnection = makeUsbConnection();
    const connection = new DeviceConnection(serialDevice, realSpikerbitDeps(usbConnection));
    expect(await connection.connect("spikerbit")).toBe("connected");
    expect(usbConnection.flash).not.toHaveBeenCalled();
    const written = () => usbConnection.serialWrite.mock.calls.map(([data]) => data as string);
    expect(written().some(data => data.startsWith("open session:"))).toBe(true);
    expect(usbConnection.disconnect).not.toHaveBeenCalled();
    await connection.disconnect();
    expect(written().some(data => data.startsWith("close session:"))).toBe(true);
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
    // The session pings on a timer.
    serialDevice.clearActiveDevice();
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
      // A literal, so a longer timeout, which would hang Disconnect on a stalled port, fails here.
      await jest.advanceTimersByTimeAsync(500);
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

  describe("status", () => {
    const unplugActive = (serialDevice: SerialDevice) => serialDevice.activeTransport!.onDisconnect!("unplugged");
    const loseActive = (serialDevice: SerialDevice) => serialDevice.activeTransport!.onDisconnect!("lost");

    it("a requested disconnect records no loss, even when the library reports Disconnected", async () => {
      const serialDevice = new SerialDevice();
      const usbConnection = makeUsbConnection({ reportsDisconnect: true });
      const connection = new DeviceConnection(serialDevice, realSpikerbitDeps(usbConnection));
      await connection.connect("spikerbit");
      await connection.disconnect();
      expect(serialDevice.isConnected()).toBe(false);
      expect(serialDevice.lastLoss).toBeUndefined();
      expect(connection.lossMessage).toBeUndefined();
    });

    it("after Disconnect and Reconnect of the same Spiker:bit, a loss is recorded again", async () => {
      const serialDevice = new SerialDevice();
      const usbConnection = makeUsbConnection({ reportsDisconnect: true });
      const connection = new DeviceConnection(serialDevice, realSpikerbitDeps(usbConnection));
      await connection.connect("spikerbit");
      await connection.disconnect();
      await connection.reconnect();
      // The library disconnecting itself, as it does after a failed WebUSB call.
      await usbConnection.disconnect();
      expect(serialDevice.isConnected()).toBe(false);
      expect(serialDevice.lastLoss?.reason).toBe("lost");
    });

    it("an unplug gives the unplugged message with the device's label", async () => {
      const { serialDevice, connection } = setup([makeTransport()]);
      await connection.connect("arduino");
      unplugActive(serialDevice);
      expect(connection.lossMessage).toBe("The Arduino was unplugged.");
      expect(connection.lossAt).toBe(serialDevice.lastLoss?.at);
    });

    it("a lost connection gives the lost message", async () => {
      const { serialDevice, connection } = setup([makeTransport(["opened"], { deviceFamily: "microbit" })]);
      await connection.connect("microbitHub");
      loseActive(serialDevice);
      expect(connection.lossMessage).toBe("The connection to the micro:bit (radio hub) was lost.");
    });

    it("a connect attempt clears the loss", async () => {
      const { serialDevice, connection } = setup([makeTransport(), makeTransport(["canceled"])]);
      await connection.connect("arduino");
      unplugActive(serialDevice);
      await connection.connect("arduino");
      expect(serialDevice.lastLoss).toBeUndefined();
      expect(connection.lossMessage).toBeUndefined();
      expect(connection.lossAt).toBeUndefined();
    });

    it("connect('spikerbit') returns inUse when another app has the board, and lets the device go", async () => {
      const serialDevice = new SerialDevice();
      const device = {
        connectAndStream: jest.fn().mockRejectedValue({ code: "device-in-use" }),
        disconnect: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn()
      };
      const connection = new DeviceConnection(serialDevice, {
        createSpikerbitDevice: () => device as unknown as SpikerbitDevice
      });
      expect(await connection.connect("spikerbit")).toBe("inUse");
      expect(device.disconnect).toHaveBeenCalled();
      expect(device.dispose).toHaveBeenCalled();
    });

    it("reconnect returns inUse without falling back to the chooser", async () => {
      const serialDevice = new SerialDevice();
      const { device } = makeSpikerbit(serialDevice);
      const createSpikerbitDevice = jest.fn(() => device as unknown as SpikerbitDevice);
      const connection = new DeviceConnection(serialDevice, {
        createSpikerbitDevice, getSpikerbitFlashDataSource: () => "flash-source"
      });
      await connection.connect("spikerbit");
      device.connectAndStream.mockRejectedValue({ code: "device-in-use" });
      expect(await connection.reconnect()).toBe("inUse");
      expect(createSpikerbitDevice).toHaveBeenCalledTimes(1);
    });

    it("notResponding and canIdentify follow the session", async () => {
      const serialDevice = new SerialDevice();
      const connection = new DeviceConnection(serialDevice, realSpikerbitDeps(makeUsbConnection()));
      await connection.connect("spikerbit");
      expect(connection.canIdentify).toBe(true);
      expect(connection.notResponding).toBe(false);
      serialDevice.ccDeviceSession!.setNotResponding(true);
      expect(connection.notResponding).toBe(true);
      serialDevice.clearActiveDevice();
      expect(connection.canIdentify).toBe(false);
      expect(connection.notResponding).toBe(false);
    });

    it("an Arduino can't identify", async () => {
      const { connection } = setup([makeTransport()]);
      await connection.connect("arduino");
      expect(connection.canIdentify).toBe(false);
      await expect(connection.identify()).resolves.toBe("noAnswer");
    });

    describe("the Is it alive? check", () => {
      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      // A connected Spiker:bit whose session's identify waits for the test to answer.
      async function setupCheck() {
        const serialDevice = new SerialDevice();
        const connection = new DeviceConnection(serialDevice, realSpikerbitDeps(makeUsbConnection()));
        await connection.connect("spikerbit");
        const answers: Array<(result: IdentifyResult) => void> = [];
        jest.spyOn(serialDevice.ccDeviceSession!, "identify")
          .mockImplementation(() => new Promise(resolve => { answers.push(resolve); }));
        const answer = async (result: IdentifyResult) => {
          answers.shift()!(result);
          await jest.advanceTimersByTimeAsync(0);
        };
        return { serialDevice, connection, answer };
      }

      it("is checking, then the answer, then nothing after 3 s", async () => {
        const { serialDevice, connection, answer } = await setupCheck();
        expect(connection.check).toBeUndefined();
        const result = connection.identify();
        expect(connection.check).toBe("checking");
        await answer("answered");
        await expect(result).resolves.toBe("answered");
        expect(connection.check).toBe("answered");
        await jest.advanceTimersByTimeAsync(kIdentifyResultMs - 1);
        expect(connection.check).toBe("answered");
        await jest.advanceTimersByTimeAsync(1);
        expect(connection.check).toBeUndefined();
        serialDevice.clearActiveDevice();
      });

      it("isn't shown for another session, even when its answer comes later", async () => {
        const { serialDevice, connection, answer } = await setupCheck();
        void connection.identify();
        serialDevice.setActiveDevice("spikerbit", { write: jest.fn(), close: jest.fn() });
        expect(connection.check).toBeUndefined();
        await answer("answered");
        expect(connection.check).toBeUndefined();
        serialDevice.clearActiveDevice();
      });

      it("an earlier session's late answer doesn't replace a newer check", async () => {
        const { serialDevice, connection, answer } = await setupCheck();
        void connection.identify();
        serialDevice.setActiveDevice("spikerbit", { write: jest.fn(), close: jest.fn() });
        jest.spyOn(serialDevice.ccDeviceSession!, "identify").mockImplementation(() => new Promise(() => undefined));
        void connection.identify();
        await answer("noAnswer");
        expect(connection.check).toBe("checking");
        serialDevice.clearActiveDevice();
      });

      it("a new check isn't cleared by the timer of the one before it", async () => {
        const { serialDevice, connection, answer } = await setupCheck();
        void connection.identify();
        await answer("answered");
        await jest.advanceTimersByTimeAsync(kIdentifyResultMs - 1000);
        void connection.identify();
        await jest.advanceTimersByTimeAsync(1000);
        expect(connection.check).toBe("checking");
        await answer("noAnswer");
        expect(connection.check).toBe("noAnswer");
        serialDevice.clearActiveDevice();
      });
    });

    it("identify asks the session", async () => {
      const serialDevice = new SerialDevice();
      const connection = new DeviceConnection(serialDevice, realSpikerbitDeps(makeUsbConnection()));
      await connection.connect("spikerbit");
      const identify = jest.spyOn(serialDevice.ccDeviceSession!, "identify").mockResolvedValue("answered");
      await expect(connection.identify()).resolves.toBe("answered");
      expect(identify).toHaveBeenCalled();
      serialDevice.clearActiveDevice();
    });
  });

  describe("an attempt", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    const flush = () => jest.advanceTimersByTimeAsync(0);

    // A Web Serial transport whose open waits for the test or, as WebSerialTransport does, resolves
    // "timeout" once options.timeoutMs has passed. Its board sends nothing until the test says so.
    function makeOpeningTransport() {
      const transport = makeTransport(["opened"], { sendsData: false });
      let finish: (result: WebSerialOpenResult) => void = () => undefined;
      let openOptions: IWebSerialOpenOptions = {};
      transport.open.mockReset().mockImplementation((_port?: SerialPort, options: IWebSerialOpenOptions = {}) =>
        new Promise<WebSerialOpenResult>(resolve => {
          openOptions = options;
          options.onChosen?.();
          finish = resolve;
          if (options.timeoutMs != null) setTimeout(() => resolve("timeout"), options.timeoutMs);
        }));
      const finishOpen = async (result: WebSerialOpenResult = "opened") => {
        await flush();
        finish(result);
        await flush();
      };
      return { transport, finishOpen, openOptions: () => openOptions };
    }

    // A Spiker:bit whose connectAndStream reports the steps the test drives, and ends when the test
    // activates it or fails it.
    function makeSteppedSpikerbit(serialDevice: SerialDevice) {
      const transport: {
        write: jest.Mock, close: jest.Mock, onData?: (chunk: string) => void,
        onDisconnect?: (loss: "unplugged" | "lost") => void
      } =
        { write: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };
      let observer: ISpikerbitConnectObserver = {};
      let settle = { resolve: () => undefined as void, reject: (_e: unknown) => undefined as void };
      const device = {
        transport,
        connectAndStream: jest.fn((_source: unknown, connectObserver: ISpikerbitConnectObserver) => {
          observer = connectObserver;
          return new Promise<void>((resolve, reject) => { settle = { resolve, reject }; });
        }),
        disconnect: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn()
      };
      return {
        device,
        transport,
        observer: () => observer,
        // Makes the board the active device, as connectAndStream does at its end.
        activate: async () => {
          serialDevice.setActiveDevice("spikerbit", transport);
          settle.resolve();
          await flush();
        },
        fail: async (e: unknown) => {
          settle.reject(e);
          await flush();
        }
      };
    }

    function setupSpikerbit(transports: FakeTransport[] = []) {
      const serialDevice = new SerialDevice();
      const stepped = makeSteppedSpikerbit(serialDevice);
      const connection = new DeviceConnection(serialDevice, {
        createWebSerialTransport: () => transports.shift() as unknown as WebSerialTransport,
        createSpikerbitDevice: () => stepped.device as unknown as SpikerbitDevice,
        getSpikerbitFlashDataSource: () => "flash-source"
      });
      return { serialDevice, connection, stepped };
    }

    // Starts a Spiker:bit connect and drives it through the open and the firmware check.
    async function startSpikerbit(
      connection: DeviceConnection, stepped: ReturnType<typeof makeSteppedSpikerbit>, willUpdate: boolean
    ) {
      const result = connection.connect("spikerbit");
      await flush();
      stepped.observer().onOpened!();
      stepped.observer().onFirmwareChecked!(null, willUpdate);
      return { result };
    }

    it("a Web Serial attempt moves from the device list to the actions at the open and ends connected on first data",
      async () => {
        const { transport, finishOpen } = makeOpeningTransport();
        const { connection } = setup([transport]);
        const p = connection.connect("arduino", { attemptId: "attempt-1" });
        expect(connection.paneView).toBe("devices");
        expect(connection.attempt!.id).toBe("attempt-1");
        await finishOpen();
        expect(connection.paneView).toBe("actions");
        expect(connection.actionsEnabled).toBe(false);
        expect(connection.attempt!.step).toBe("waitForData");
        transport.onData!("emg:1\r\n");
        expect(await p).toBe("connected");
        expect(connection.attempt!.steps).toEqual(expect.objectContaining({
          chooserClosed: expect.any(Number), opened: expect.any(Number), active: expect.any(Number),
          firstData: expect.any(Number)
        }));
        expect(connection.actionsEnabled).toBe(true);
        expect(connection.dataReceived).toBe(true);
        expect(connection.lastFailure).toBeUndefined();
      });

    it("an open that hangs ends as openTimeout after 20 s and frees the Connect buttons", async () => {
      const { transport } = makeOpeningTransport();
      const { connection } = setup([transport]);
      const p = connection.connect("arduino");
      await jest.advanceTimersByTimeAsync(kOpenTimeoutMs - 1);
      expect(connection.busyChoice).toBe("arduino");
      await jest.advanceTimersByTimeAsync(1);
      expect(await p).toBe("openTimeout");
      expect(transport.open).toHaveBeenCalledWith(undefined, expect.objectContaining({ timeoutMs: kOpenTimeoutMs }));
      expect(connection.busyChoice).toBeUndefined();
      expect(connection.lastFailure).toMatchObject({ kind: "openTimeout", step: "open", elapsedMs: kOpenTimeoutMs });
      expect(connection.paneView).toBe("devices");
    });

    it("a retry during a pending open is openTimeout too", async () => {
      const transport = makeTransport(["stillOpening"]);
      transport.lastOpenError = new DOMException("A call to open() is already in progress.", "InvalidStateError");
      const { connection } = setup([transport]);
      expect(await connection.connect("arduino")).toBe("openTimeout");
      expect(connection.lastFailure).toMatchObject({ kind: "openTimeout", error: { name: "InvalidStateError" } });
    });

    it("no data 5 s after an Arduino becomes active ends as noData with the actions enabled", async () => {
      const { connection } = setup([makeTransport(["opened"], { sendsData: false })]);
      const p = connection.connect("arduino");
      await flush();
      expect(connection.attempt!.step).toBe("waitForData");
      await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs - 1);
      expect(connection.attempt!.ended).toBe(false);
      expect(connection.actionsEnabled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(await p).toBe("noData");
      expect(connection.lastFailure).toMatchObject({
        kind: "noData", choice: "arduino", step: "waitForData", elapsedMs: kFirstDataTimeoutMs
      });
      expect(connection.actionsEnabled).toBe(true);
      expect(connection.paneView).toBe("actions");
      expect(connection.busyChoice).toBeUndefined();
      expect(connection.isConnected).toBe(true);
      expect(connection.dataReceived).toBe(false);
    });

    it("no data 5 s after a Spiker:bit becomes active ends as notResponding", async () => {
      const { connection, stepped, serialDevice } = setupSpikerbit();
      const { result: p } = await startSpikerbit(connection, stepped, false);
      await stepped.activate();
      expect(connection.attempt!.steps.active).toEqual(expect.any(Number));
      await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs);
      expect(await p).toBe("notResponding");
      expect(connection.lastFailure).toMatchObject({ kind: "notResponding", step: "waitForData" });
      expect(connection.attempt!.firmware).toEqual({ found: null, updated: false });
      serialDevice.clearActiveDevice();
    });

    it("late data after a stall recovers: clears lastFailure and calls onRecovered", async () => {
      const transport = makeTransport(["opened"], { sendsData: false });
      const { connection } = setup([transport]);
      const listener = { onEnded: jest.fn(), onRecovered: jest.fn() };
      const p = connection.connect("arduino", { listener });
      await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs);
      expect(await p).toBe("noData");
      expect(listener.onEnded).toHaveBeenCalledWith(connection.attempt);
      expect(listener.onRecovered).not.toHaveBeenCalled();
      transport.onData!("emg:1\r\n");
      expect(connection.attempt!.recovered).toBe(true);
      expect(connection.attempt!.outcome).toBe("noData");
      expect(connection.attempt!.steps.firstData).toEqual(expect.any(Number));
      expect(connection.lastFailure).toBeUndefined();
      expect(connection.dataReceived).toBe(true);
      expect(listener.onRecovered).toHaveBeenCalledWith(connection.attempt);
    });

    it("disconnect after a stall clears lastFailure, so nothing still says the device stalled", async () => {
      const { connection } = setup([makeTransport(["opened"], { sendsData: false })]);
      const p = connection.connect("arduino");
      await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs);
      expect(await p).toBe("noData");
      expect(connection.lastFailure?.kind).toBe("noData");
      await connection.disconnect();
      expect(connection.lastFailure).toBeUndefined();
    });

    it("a loss after a noData stall calls onLost and clears lastFailure, so the loss shows", async () => {
      const transport = makeTransport(["opened"], { sendsData: false });
      const { connection } = setup([transport]);
      const listener = { onLost: jest.fn() };
      const p = connection.connect("arduino", { listener });
      await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs);
      expect(await p).toBe("noData");
      transport.onDisconnect!("unplugged");
      expect(listener.onLost).toHaveBeenCalledWith(connection.attempt, "unplugged");
      expect(connection.lastFailure).toBeUndefined();
      expect(connection.lossReason).toBe("unplugged");
      expect(connection.attempt!.outcome).toBe("noData");
    });

    it("a stall's failure counts only while its device is held", async () => {
      const { connection, serialDevice } = setup([makeTransport(["opened"], { sendsData: false })]);
      const p = connection.connect("arduino");
      await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs);
      expect(await p).toBe("noData");
      const stall = connection.lastFailure;
      const openFailed = {
        attemptId: "attempt-1", kind: "openFailed", choice: "arduino", step: "open", elapsedMs: 0
      } as const;
      expect(connection.holdsDevice).toBe(true);
      expect(connection.currentFailure(stall)).toBe(stall);
      serialDevice.clearActiveDevice();
      expect(connection.holdsDevice).toBe(false);
      expect(connection.currentFailure(stall)).toBeUndefined();
      expect(connection.currentFailure(openFailed)).toBe(openFailed);
      expect(connection.currentFailure(undefined)).toBeUndefined();
    });

    it("an earlier attempt's stall doesn't count while a newer attempt holds its own device", async () => {
      const { connection, stepped } = setupSpikerbit([makeTransport(["opened"], { sendsData: false })]);
      const first = connection.connect("arduino");
      await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs);
      expect(await first).toBe("noData");
      // Another tile keeps this failure after the Disconnect.
      const earlierStall = connection.lastFailure;
      await connection.disconnect();

      const { result: second } = await startSpikerbit(connection, stepped, true);
      await jest.advanceTimersByTimeAsync(kUpdateStartMs);
      expect(await second).toBe("updateStalled");
      expect(connection.holdsDevice).toBe(true);
      expect(connection.currentFailure(earlierStall)).toBeUndefined();
      expect(connection.currentFailure(connection.lastFailure)).toBe(connection.lastFailure);
    });

    it("an update with no first progress within its start limit, or no progress after that within the stall " +
        "limit, ends as updateStalled and keeps the actions view", async () => {
      const { connection, stepped } = setupSpikerbit();
      const p = connection.connect("spikerbit");
      await flush();
      expect(connection.paneView).toBe("devices");
      stepped.observer().onOpened!();
      expect(connection.paneView).toBe("actions");
      expect(connection.attempt!.step).toBe("checkFirmware");
      stepped.observer().onFirmwareChecked!(null, true);
      expect(connection.attempt!.step).toBe("update");
      expect(connection.attempt!.steps.updateStarted).toEqual(expect.any(Number));
      await jest.advanceTimersByTimeAsync(kUpdateStartMs - 1);
      expect(connection.attempt!.ended).toBe(false);
      stepped.observer().onUpdateProgress!(40);
      expect(connection.attempt!.updatePercent).toBe(40);
      await jest.advanceTimersByTimeAsync(kUpdateStallMs - 1);
      expect(connection.attempt!.ended).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(await p).toBe("updateStalled");
      expect(connection.lastFailure)
        .toMatchObject({ kind: "updateStalled", step: "update", elapsedMs: kUpdateStallMs });
      expect(connection.paneView).toBe("actions");
      expect(connection.actionsEnabled).toBe(true);
      expect(connection.busyChoice).toBeUndefined();
      expect(stepped.device.disconnect).not.toHaveBeenCalled();
    });

    it("a stalled update that finishes carries on to connected", async () => {
      const { connection, stepped, serialDevice } = setupSpikerbit();
      const listener = { onRecovered: jest.fn() };
      const p = connection.connect("spikerbit", { listener });
      await flush();
      stepped.observer().onOpened!();
      stepped.observer().onFirmwareChecked!(null, true);
      await jest.advanceTimersByTimeAsync(kUpdateStartMs);
      expect(await p).toBe("updateStalled");
      stepped.observer().onUpdateFinished!();
      expect(connection.attempt!.firmware).toEqual({ found: null, updated: true });
      expect(connection.attempt!.steps.updateFinished).toEqual(expect.any(Number));
      await stepped.activate();
      expect(connection.attempt!.steps.active).toEqual(expect.any(Number));
      expect(connection.isConnected).toBe(true);
      expect(connection.paneView).toBe("actions");
      stepped.transport.onData!("data\r\n");
      expect(connection.attempt!.recovered).toBe(true);
      expect(connection.lastFailure).toBeUndefined();
      expect(listener.onRecovered).toHaveBeenCalledWith(connection.attempt);
      // The first data stopped the wait for it.
      await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs);
      expect(connection.lastFailure).toBeUndefined();
      serialDevice.clearActiveDevice();
    });

    it("progress after a stall resumes the update until it goes without progress again", async () => {
      const { connection, stepped, serialDevice } = setupSpikerbit();
      const listener = { onStallChanged: jest.fn() };
      const p = connection.connect("spikerbit", { listener });
      await flush();
      stepped.observer().onOpened!();
      stepped.observer().onFirmwareChecked!(null, true);
      await jest.advanceTimersByTimeAsync(kUpdateStartMs);
      expect(await p).toBe("updateStalled");
      expect(connection.updateResumed).toBe(false);
      expect(connection.actionsEnabled).toBe(true);

      stepped.observer().onUpdateProgress!(20);
      expect(connection.lastFailure).toBeUndefined();
      expect(listener.onStallChanged).toHaveBeenLastCalledWith(connection.attempt, undefined);
      expect(connection.updateResumed).toBe(true);
      expect(connection.attempt!.updatePercent).toBe(20);
      // Closing the board would stop the flash.
      expect(connection.actionsEnabled).toBe(false);
      expect(connection.paneView).toBe("actions");

      await jest.advanceTimersByTimeAsync(kUpdateStallMs - 1);
      stepped.observer().onUpdateProgress!(40);
      await jest.advanceTimersByTimeAsync(kUpdateStallMs - 1);
      expect(connection.updateResumed).toBe(true);
      await jest.advanceTimersByTimeAsync(1);
      const stall = {
        attemptId: connection.attempt!.id, kind: "updateStalled", choice: "spikerbit", step: "update",
        elapsedMs: kUpdateStallMs
      };
      expect(connection.lastFailure).toEqual(stall);
      expect(listener.onStallChanged).toHaveBeenLastCalledWith(connection.attempt, stall);
      expect(connection.updateResumed).toBe(false);
      expect(connection.actionsEnabled).toBe(true);

      stepped.observer().onUpdateProgress!(60);
      expect(connection.updateResumed).toBe(true);
      stepped.observer().onUpdateFinished!();
      // The finished update no longer waits for progress.
      await jest.advanceTimersByTimeAsync(kUpdateStallMs);
      expect(connection.lastFailure).toBeUndefined();
      await stepped.activate();
      expect(connection.updateResumed).toBe(false);
      expect(connection.actionsEnabled).toBe(true);
      serialDevice.clearActiveDevice();
    });

    it("a stalled update that finishes clears its updateStalled failure when the board becomes active",
      async () => {
        const { connection, stepped, serialDevice } = setupSpikerbit();
        const listener = { onStallChanged: jest.fn(), onRecovered: jest.fn() };
        const p = connection.connect("spikerbit", { listener });
        await flush();
        stepped.observer().onOpened!();
        stepped.observer().onFirmwareChecked!(null, true);
        await jest.advanceTimersByTimeAsync(kUpdateStartMs);
        expect(await p).toBe("updateStalled");
        stepped.observer().onUpdateFinished!();
        await stepped.activate();
        expect(connection.lastFailure).toBeUndefined();
        expect(listener.onStallChanged).toHaveBeenCalledWith(connection.attempt, undefined);
        expect(connection.attempt!.outcome).toBe("updateStalled");

        // The board still gets the usual wait for its first data, and data after it recovers.
        await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs - 1);
        expect(connection.lastFailure).toBeUndefined();
        await jest.advanceTimersByTimeAsync(1);
        const stall = {
          attemptId: connection.attempt!.id, kind: "notResponding", choice: "spikerbit", step: "waitForData",
          elapsedMs: kFirstDataTimeoutMs
        };
        expect(connection.lastFailure).toEqual(stall);
        expect(listener.onStallChanged).toHaveBeenLastCalledWith(connection.attempt, stall);
        expect(connection.paneView).toBe("actions");
        expect(connection.actionsEnabled).toBe(true);
        stepped.transport.onData!("data\r\n");
        expect(connection.lastFailure).toBeUndefined();
        expect(listener.onRecovered).toHaveBeenCalledWith(connection.attempt);
        serialDevice.clearActiveDevice();
      });

    it("a board lost while it waits for first data after a stalled update reports no stall afterward",
      async () => {
        const { connection, stepped } = setupSpikerbit();
        const listener = { onStallChanged: jest.fn(), onLost: jest.fn() };
        const p = connection.connect("spikerbit", { listener });
        await flush();
        stepped.observer().onOpened!();
        stepped.observer().onFirmwareChecked!(null, true);
        await jest.advanceTimersByTimeAsync(kUpdateStartMs);
        expect(await p).toBe("updateStalled");
        stepped.observer().onUpdateFinished!();
        await stepped.activate();
        listener.onStallChanged.mockClear();

        stepped.transport.onDisconnect!("unplugged");
        expect(listener.onLost).toHaveBeenCalledWith(connection.attempt, "unplugged");
        await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs);
        expect(connection.lastFailure).toBeUndefined();
        expect(listener.onStallChanged).not.toHaveBeenCalled();
      });

    it("a stalled update that resumed and then lost its board reports no stall afterward", async () => {
      const { connection, stepped } = setupSpikerbit();
      const listener = { onStallChanged: jest.fn(), onLost: jest.fn() };
      const p = connection.connect("spikerbit", { listener });
      await flush();
      stepped.observer().onOpened!();
      stepped.observer().onFirmwareChecked!(null, true);
      await jest.advanceTimersByTimeAsync(kUpdateStartMs);
      expect(await p).toBe("updateStalled");
      stepped.observer().onUpdateProgress!(20);
      listener.onStallChanged.mockClear();

      stepped.observer().onLost!("unplugged");
      expect(listener.onLost).toHaveBeenCalledWith(connection.attempt, "unplugged");
      await jest.advanceTimersByTimeAsync(kUpdateStallMs);
      expect(connection.lastFailure).toBeUndefined();
      expect(listener.onStallChanged).not.toHaveBeenCalled();
    });

    it("disconnect while a Spiker:bit checks its firmware closes and disposes the board", async () => {
      const { connection, stepped } = setupSpikerbit();
      const p = connection.connect("spikerbit");
      await flush();
      stepped.observer().onOpened!();
      expect(connection.attempt!.step).toBe("checkFirmware");
      await connection.disconnect();
      expect(await p).toBe("canceled");
      expect(stepped.device.disconnect).toHaveBeenCalled();
      expect(stepped.device.dispose).toHaveBeenCalled();
    });

    it("disconnect during a stalled update disposes the Spiker:bit device", async () => {
      const { connection, stepped } = setupSpikerbit();
      const { result: p } = await startSpikerbit(connection, stepped, true);
      await jest.advanceTimersByTimeAsync(kUpdateStartMs);
      expect(await p).toBe("updateStalled");
      await connection.disconnect();
      expect(stepped.device.disconnect).toHaveBeenCalled();
      expect(stepped.device.dispose).toHaveBeenCalledTimes(1);
      expect(connection.paneView).toBe("devices");
      // The abandoned flash failing later changes nothing.
      await stepped.fail(new Error("disconnected"));
      expect(stepped.device.dispose).toHaveBeenCalledTimes(1);
      expect(connection.attempt!.outcome).toBe("updateStalled");
    });

    it("connect during a stalled update disposes the Spiker:bit device before opening another", async () => {
      const transport = makeTransport();
      const { connection, stepped } = setupSpikerbit([transport]);
      const { result: p } = await startSpikerbit(connection, stepped, true);
      await jest.advanceTimersByTimeAsync(kUpdateStartMs);
      expect(await p).toBe("updateStalled");
      expect(await connection.connect("arduino")).toBe("connected");
      expect(stepped.device.disconnect.mock.invocationCallOrder[0])
        .toBeLessThan(transport.open.mock.invocationCallOrder[0]);
      expect(stepped.device.dispose).toHaveBeenCalled();
    });

    it("a fresh Spiker:bit's open starts when its chooser closes, and its failures are at the open", async () => {
      const { connection, stepped } = setupSpikerbit();
      const p = connection.connect("spikerbit");
      await flush();
      expect(connection.attempt!.step).toBe("choose");
      await jest.advanceTimersByTimeAsync(30000);
      stepped.observer().onOpening!(true);
      expect(connection.attempt!.step).toBe("open");
      expect(connection.attempt!.steps.chooserClosed).toBe(30000);
      await jest.advanceTimersByTimeAsync(3000);
      await stepped.fail({ code: "device-in-use", message: "Unable to claim interface." });
      expect(await p).toBe("inUse");
      expect(connection.lastFailure).toMatchObject({ kind: "inUse", step: "open", elapsedMs: 3000 });
    });

    it("the library's own open time limit is openTimeout", async () => {
      const { connection, stepped } = setupSpikerbit();
      const p = connection.connect("spikerbit");
      await flush();
      stepped.observer().onOpening!(false);
      expect(connection.attempt!.steps.chooserClosed).toBeUndefined();
      await stepped.fail({ code: "timeout", message: "Timeout" });
      expect(await p).toBe("openTimeout");
      expect(connection.lastFailure).toMatchObject({ kind: "openTimeout", step: "open" });
    });

    // The board's close takes kSlowCloseMs, and the flash fails kSlowCloseMs / 2 before the update
    // would count as stalled, so the limit passes while the close is still going.
    const kSlowCloseMs = 200;
    const slowClose = () => new Promise<void>(resolve => setTimeout(resolve, kSlowCloseMs));

    it("a flash that fails just before the stall limit, with a slow close, ends as updateFailed", async () => {
      const { connection, stepped } = setupSpikerbit();
      stepped.device.disconnect.mockImplementation(slowClose);
      const { result: p } = await startSpikerbit(connection, stepped, true);
      await jest.advanceTimersByTimeAsync(kUpdateStartMs - kSlowCloseMs / 2);
      void stepped.fail(new Error("flash failed"));
      await jest.advanceTimersByTimeAsync(kSlowCloseMs * 2);
      expect(await p).toBe("updateFailed");
      expect(connection.paneView).toBe("devices");
      expect(connection.lastFailure?.kind).toBe("updateFailed");
    });

    describe("a real Spiker:bit whose flash fails just before the stall limit, with a slow close", () => {
      function failFlashAfter(usbConnection: ReturnType<typeof makeUsbConnection>, ms: number, progress: boolean) {
        usbConnection.flash.mockImplementation(
          (_source: unknown, options: { progress?: (stage: string, pct?: number) => void }) => {
            if (progress) options.progress?.("PartialFlashing", 0.1);
            return new Promise((_, reject) => setTimeout(() => reject(new Error("flash failed")), ms));
          });
      }

      it("ends as updateFailed before the first progress report", async () => {
        const usbConnection = makeUsbConnection({ firmware: kSpikerbitFirmwareVersion - 1 });
        failFlashAfter(usbConnection, kUpdateStartMs - kSlowCloseMs / 2, false);
        usbConnection.disconnect.mockImplementation(slowClose);
        const connection = new DeviceConnection(new SerialDevice(), realSpikerbitDeps(usbConnection));
        const p = connection.connect("spikerbit");
        await jest.advanceTimersByTimeAsync(kUpdateStartMs + 1000);
        expect(await p).toBe("updateFailed");
        expect(connection.paneView).toBe("devices");
      });

      it("ends as updateFailed after a progress report", async () => {
        const usbConnection = makeUsbConnection({ firmware: kSpikerbitFirmwareVersion - 1 });
        failFlashAfter(usbConnection, kUpdateStallMs - kSlowCloseMs / 2, true);
        usbConnection.disconnect.mockImplementation(slowClose);
        const connection = new DeviceConnection(new SerialDevice(), realSpikerbitDeps(usbConnection));
        const p = connection.connect("spikerbit");
        await jest.advanceTimersByTimeAsync(kUpdateStallMs + 1000);
        expect(await p).toBe("updateFailed");
        expect(connection.paneView).toBe("devices");
      });
    });

    it("a stalled update whose flash fails during a slow close leaves a newer attempt alone", async () => {
      const { connection, stepped } = setupSpikerbit([makeTransport()]);
      const stalledListener = { onLost: jest.fn() };
      const p = connection.connect("spikerbit", { listener: stalledListener });
      await flush();
      stepped.observer().onOpened!();
      stepped.observer().onFirmwareChecked!(null, true);
      await jest.advanceTimersByTimeAsync(kUpdateStartMs);
      expect(await p).toBe("updateStalled");
      stepped.device.disconnect.mockImplementation(slowClose);
      await stepped.fail(new Error("flash failed"));

      // The student connects another device while the stalled board closes.
      const listener = { onLost: jest.fn(), onStallChanged: jest.fn() };
      const next = connection.connect("arduino", { listener });
      await jest.advanceTimersByTimeAsync(kSlowCloseMs * 2);
      expect(await next).toBe("connected");
      expect(connection.lastFailure).toBeUndefined();
      expect(listener.onLost).not.toHaveBeenCalled();
      expect(connection.attempt!.choice).toBe("arduino");
    });

    it("an unplug of a stalled Spiker:bit calls onLost and shows the device list with the unplug", async () => {
      const { connection, stepped } = setupSpikerbit();
      const listener = { onLost: jest.fn() };
      const p = connection.connect("spikerbit", { listener });
      await flush();
      stepped.observer().onOpened!();
      stepped.observer().onFirmwareChecked!(null, true);
      await jest.advanceTimersByTimeAsync(kUpdateStartMs);
      expect(await p).toBe("updateStalled");
      stepped.observer().onLost!("unplugged");
      expect(listener.onLost).toHaveBeenCalledWith(connection.attempt, "unplugged");
      expect(connection.lastFailure).toBeUndefined();
      expect(connection.paneView).toBe("devices");
      expect(connection.lossMessage).toBe("The Spiker:bit was unplugged.");
      await flush();
      expect(stepped.device.dispose).toHaveBeenCalled();
      // The flash failing afterward adds nothing.
      await stepped.fail(new Error("device gone"));
      expect(listener.onLost).toHaveBeenCalledTimes(1);
      expect(connection.lastFailure).toBeUndefined();
    });

    it("an unplug during a running update ends the attempt as unplugged", async () => {
      const { connection, stepped } = setupSpikerbit();
      const { result: p } = await startSpikerbit(connection, stepped, true);
      stepped.observer().onLost!("unplugged");
      expect(await p).toBe("unplugged");
      expect(connection.lastFailure).toBeUndefined();
      expect(connection.lossMessage).toBe("The Spiker:bit was unplugged.");
    });

    it("a stalled update whose flash then fails reports updateFailed to onLost and shows it", async () => {
      const { connection, stepped } = setupSpikerbit();
      const listener = { onLost: jest.fn() };
      const p = connection.connect("spikerbit", { listener });
      await flush();
      stepped.observer().onOpened!();
      stepped.observer().onFirmwareChecked!(null, true);
      await jest.advanceTimersByTimeAsync(kUpdateStartMs);
      expect(await p).toBe("updateStalled");
      await stepped.fail(new Error("flash failed"));
      expect(listener.onLost).toHaveBeenCalledWith(connection.attempt, "updateFailed");
      expect(connection.lastFailure).toMatchObject({
        kind: "updateFailed", step: "update", error: { message: "flash failed" }
      });
      expect(connection.attempt!.outcome).toBe("updateStalled");
      expect(connection.paneView).toBe("devices");
      expect(stepped.device.dispose).toHaveBeenCalled();
    });

    it("disconnect clears a watched stall's failure in an action", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const { connection } = setup([makeTransport(["opened"], { sendsData: false })]);
      const p = connection.connect("arduino");
      await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs);
      expect(await p).toBe("noData");
      const stopWatching = autorun(() => connection.lastFailure);
      await connection.disconnect();
      stopWatching();
      expect(connection.lastFailure).toBeUndefined();
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("[MobX]"));
      warn.mockRestore();
    });

    it("disconnect while a Web Serial board waits for its first data ends the attempt as canceled", async () => {
      const { connection } = setup([makeTransport(["opened"], { sendsData: false })]);
      const listener = { onEnded: jest.fn() };
      const p = connection.connect("arduino", { listener });
      await flush();
      expect(connection.attempt!.step).toBe("waitForData");
      await connection.disconnect();
      expect(await p).toBe("canceled");
      expect(connection.busyChoice).toBeUndefined();
      await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs);
      expect(connection.attempt!.outcome).toBe("canceled");
      expect(connection.lastFailure).toBeUndefined();
      expect(connection.paneView).toBe("devices");
      expect(listener.onEnded).toHaveBeenCalledTimes(1);
    });

    it("reconnect during a stalled update reopens the same Spiker:bit without the chooser", async () => {
      const serialDevice = new SerialDevice();
      const stepped = makeSteppedSpikerbit(serialDevice);
      const createSpikerbitDevice = jest.fn(() => stepped.device as unknown as SpikerbitDevice);
      const connection = new DeviceConnection(serialDevice, {
        createSpikerbitDevice, getSpikerbitFlashDataSource: () => "flash-source"
      });
      const { result: p } = await startSpikerbit(connection, stepped, true);
      await jest.advanceTimersByTimeAsync(kUpdateStartMs);
      expect(await p).toBe("updateStalled");
      const staleObserver = stepped.observer();

      const reconnecting = connection.reconnect();
      await flush();
      expect(stepped.device.disconnect).toHaveBeenCalledTimes(1);
      expect(stepped.device.dispose).not.toHaveBeenCalled();
      expect(createSpikerbitDevice).toHaveBeenCalledTimes(1);
      expect(stepped.device.connectAndStream).toHaveBeenCalledTimes(2);
      expect(connection.attempt!.trigger).toBe("reconnect");
      expect(connection.paneView).toBe("actions");
      // The abandoned run's reports change nothing.
      staleObserver.onUpdateProgress!(90);
      expect(connection.attempt!.updatePercent).toBeUndefined();

      stepped.observer().onOpened!();
      stepped.observer().onFirmwareChecked!(null, false);
      await stepped.activate();
      stepped.transport.onData!("data\r\n");
      expect(await reconnecting).toBe("connected");
      serialDevice.clearActiveDevice();
    });

    it("a flash that throws ends as updateFailed back on the device list", async () => {
      const { connection, stepped } = setupSpikerbit();
      const { result: p } = await startSpikerbit(connection, stepped, true);
      expect(connection.paneView).toBe("actions");
      await stepped.fail(new Error("flash failed"));
      expect(await p).toBe("updateFailed");
      expect(connection.lastFailure).toMatchObject({
        kind: "updateFailed", choice: "spikerbit", step: "update", error: { message: "flash failed" }
      });
      expect(connection.paneView).toBe("devices");
      expect(stepped.device.disconnect).toHaveBeenCalled();
      expect(stepped.device.dispose).toHaveBeenCalled();
    });

    it("a Spiker:bit open that times out ends as openTimeout without waiting for the board to close", async () => {
      const { connection, stepped } = setupSpikerbit();
      stepped.device.disconnect.mockReturnValue(new Promise(() => undefined));
      const p = connection.connect("spikerbit");
      await flush();
      await stepped.fail(Object.assign(new Error("Opening the USB connection timed out"), { code: "open-timeout" }));
      expect(await p).toBe("openTimeout");
      expect(connection.lastFailure).toMatchObject({ kind: "openTimeout", error: { code: "open-timeout" } });
      expect(stepped.device.dispose).toHaveBeenCalled();
    });

    it("reconnect keeps the actions view until the open, and falls back to the device list if it fails before it",
      async () => {
        const second = makeOpeningTransport();
        const third = makeOpeningTransport();
        const { connection, createWebSerialTransport } = setup([makeTransport(), second.transport, third.transport]);
        expect(await connection.connect("arduino")).toBe("connected");

        const reconnecting = connection.reconnect();
        expect(connection.attempt!.trigger).toBe("reconnect");
        expect(connection.paneView).toBe("actions");
        expect(connection.actionsEnabled).toBe(false);
        await second.finishOpen();
        expect(connection.paneView).toBe("actions");
        expect(connection.attempt!.steps.chooserClosed).toBeUndefined();
        second.transport.onData!("emg:1\r\n");
        expect(await reconnecting).toBe("connected");

        const failing = connection.reconnect();
        await flush();
        expect(connection.paneView).toBe("actions");
        await jest.advanceTimersByTimeAsync(kOpenTimeoutMs);
        expect(await failing).toBe("openTimeout");
        expect(connection.paneView).toBe("devices");
        // A port stuck opening isn't offered the chooser.
        expect(createWebSerialTransport).toHaveBeenCalledTimes(3);
      });

    it("an unplug before first data ends the attempt as unplugged at once", async () => {
      const transport = makeTransport(["opened"], { sendsData: false });
      const { connection } = setup([transport]);
      const listener = { onLost: jest.fn() };
      const p = connection.connect("arduino", { listener });
      await flush();
      transport.onDisconnect!("unplugged");
      expect(await p).toBe("unplugged");
      expect(connection.lastFailure).toBeUndefined();
      expect(connection.busyChoice).toBeUndefined();
      expect(connection.paneView).toBe("devices");
      expect(listener.onLost).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs);
      expect(connection.attempt!.outcome).toBe("unplugged");
    });

    it("a loss after first data calls onLost and leaves the attempt as it was", async () => {
      const transport = makeTransport();
      const { connection } = setup([transport]);
      const listener = { onLost: jest.fn() };
      expect(await connection.connect("arduino", { listener })).toBe("connected");
      transport.onDisconnect!("lost");
      expect(listener.onLost).toHaveBeenCalledWith(connection.attempt, "lost");
      expect(connection.attempt!.outcome).toBe("connected");
      expect(connection.paneView).toBe("devices");
    });

    it("a canceled chooser ends as canceled with no failure", async () => {
      const { connection } = setup([makeTransport(["canceled"])]);
      const listener = { onEnded: jest.fn() };
      expect(await connection.connect("arduino", { listener })).toBe("canceled");
      expect(connection.attempt!.outcome).toBe("canceled");
      expect(connection.attempt!.failure).toBeUndefined();
      expect(connection.lastFailure).toBeUndefined();
      expect(connection.paneView).toBe("devices");
      expect(listener.onEnded).toHaveBeenCalledWith(connection.attempt);
    });

    it("an abandoned open's late result reaches onAbandonedOpen", async () => {
      const { transport, openOptions } = makeOpeningTransport();
      const { connection } = setup([transport]);
      const listener = { onAbandonedOpen: jest.fn() };
      const p = connection.connect("arduino", { listener });
      await jest.advanceTimersByTimeAsync(kOpenTimeoutMs);
      expect(await p).toBe("openTimeout");
      openOptions().onAbandoned!({ close: "failed", forget: "ok" });
      openOptions().onAbandoned!({ late: "opened" });
      expect(listener.onAbandonedOpen).toHaveBeenCalledWith(connection.attempt, { close: "failed", forget: "ok" });
      expect(listener.onAbandonedOpen).toHaveBeenLastCalledWith(connection.attempt, { late: "opened" });
    });
  });

  it("getDeviceConnection returns one instance per SerialDevice", () => {
    const a = new SerialDevice();
    const b = new SerialDevice();
    expect(getDeviceConnection(a)).toBe(getDeviceConnection(a));
    expect(getDeviceConnection(a)).not.toBe(getDeviceConnection(b));
  });
});
