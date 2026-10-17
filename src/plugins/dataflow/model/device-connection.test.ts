import { SerialDevice } from "../../../models/stores/serial";
import { SpikerbitDevice } from "../../../models/stores/spikerbit-device";
import { WebSerialOpenResult, WebSerialTransport } from "../../../models/stores/web-serial-transport";
import { DeviceConnection, getDeviceConnection, IDeviceConnectionDeps } from "./device-connection";

jest.mock("../firmware/spikerbit-clue.hex", () => "hex", { virtual: true });

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
    getGrantedSerialPorts: jest.fn().mockResolvedValue([]),
    getSpikerbitFlashDataSource: () => "flash-source",
    ...extra
  });
  return { serialDevice, connection, createWebSerialTransport };
}

function makeSpikerbit(serialDevice: SerialDevice) {
  const transport = { write: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };
  const device = {
    connectAndStream: jest.fn(async () => { serialDevice.setActiveDevice("spikerbit", transport); })
  };
  return { device, transport };
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

  it("connectedLabel is the menu choice's label, not the detected family", async () => {
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
    const device = { connectAndStream: jest.fn().mockRejectedValue({ code: "no-device-selected" }) };
    const connection = new DeviceConnection(serialDevice, {
      createSpikerbitDevice: () => device as unknown as SpikerbitDevice
    });
    expect(await connection.connect("spikerbit")).toBe("canceled");
    expect(serialDevice.isConnected()).toBe(false);
  });

  it("connect('spikerbit') returns failed on any other error", async () => {
    const serialDevice = new SerialDevice();
    const device = { connectAndStream: jest.fn().mockRejectedValue(new Error("boom")) };
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

  it("reconnect falls back to a granted port with the same USB ids", async () => {
    const first = makeTransport(["opened"], { lastPort: makePort(1, 2) });
    const second = makeTransport(["failed"]);
    const third = makeTransport(["opened"]);
    const match = makePort(1, 2);
    const other = makePort(3, 4);
    const { connection } = setup([first, second, third], {
      getGrantedSerialPorts: jest.fn().mockResolvedValue([other, match])
    });
    await connection.connect("arduino");
    await connection.disconnect();
    expect(await connection.reconnect()).toBe("connected");
    expect(second.open).toHaveBeenCalledWith(first.lastPort);
    expect(third.open).toHaveBeenCalledWith(match);
  });

  it("reconnect falls back to the chooser when no known port opens", async () => {
    const first = makeTransport();
    const second = makeTransport(["failed"]);
    const third = makeTransport(["opened"]);
    const { connection } = setup([first, second, third], {
      getGrantedSerialPorts: jest.fn().mockResolvedValue([makePort(3, 4)])
    });
    await connection.connect("arduino");
    await connection.disconnect();
    expect(await connection.reconnect()).toBe("connected");
    expect(third.open).toHaveBeenCalledWith();
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

  it("disconnect closes the transport and clears the active device", async () => {
    const transport = makeTransport();
    const { serialDevice, connection } = setup([transport]);
    await connection.connect("arduino");
    await connection.disconnect();
    expect(transport.close).toHaveBeenCalled();
    expect(serialDevice.isConnected()).toBe(false);
    expect(connection.connectedLabel).toBeUndefined();
  });

  it("getDeviceConnection returns one instance per SerialDevice", () => {
    const a = new SerialDevice();
    const b = new SerialDevice();
    expect(getDeviceConnection(a)).toBe(getDeviceConnection(a));
    expect(getDeviceConnection(a)).not.toBe(getDeviceConnection(b));
  });
});
