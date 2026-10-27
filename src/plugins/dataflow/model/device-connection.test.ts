import { SerialDevice } from "../../../models/stores/serial";
import {
  IMicrobitUsbConnection, kSpikerbitFirmwareVersion, SpikerbitDevice
} from "../../../models/stores/spikerbit-device";
import { WebSerialOpenResult, WebSerialTransport } from "../../../models/stores/web-serial-transport";
import { withChecksum } from "../../../models/stores/cc-device-protocol";
import {
  DeviceConnection, getDeviceConnection, IDeviceConnectionDeps, kIdentifyResultMs
} from "./device-connection";
import { IdentifyResult } from "../../../models/stores/cc-device-session";

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
    disconnect: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn()
  };
  return { device, transport };
}

// A fake @microbit/microbit-connection USB connection for driving a real SpikerbitDevice.
// With reportsDisconnect, its disconnect raises the library's Disconnected status, as the real one does.
function makeUsbConnection(options: { failWrite?: boolean, reportsDisconnect?: boolean } = {}) {
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
            `hello protocol:CCDeviceProtocol version:1 device:spikerbit firmware:${kSpikerbitFirmwareVersion}`));
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
      disconnect: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn()
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
      disconnect: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn()
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

  it("getDeviceConnection returns one instance per SerialDevice", () => {
    const a = new SerialDevice();
    const b = new SerialDevice();
    expect(getDeviceConnection(a)).toBe(getDeviceConnection(a));
    expect(getDeviceConnection(a)).not.toBe(getDeviceConnection(b));
  });
});
