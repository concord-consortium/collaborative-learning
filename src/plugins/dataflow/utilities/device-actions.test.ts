import { destroy } from "mobx-state-tree";
import { LogEventName } from "../../../lib/logger-types";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { addCasesToDataSet } from "../../../models/data/data-set";
import { DataflowContentModel } from "../model/dataflow-content";
import { DataflowNodeModel } from "../model/dataflow-program-model";
import { ConnectResult, DeviceChoice, DeviceConnection } from "../model/device-connection";
import {
  connectDeviceForTile, disconnectDeviceForTile, reconnectDeviceForTile, resetProgramForTile
} from "./device-actions";

jest.mock("../../../models/tiles/log/log-tile-change-event", () => ({ logTileChangeEvent: jest.fn() }));

const tileId = "tile1";

function makeContent() {
  const content = DataflowContentModel.create();
  content.program.addNode(DataflowNodeModel.create({
    id: "num", name: "Number", x: 0, y: 0, data: { type: "Number", value: 7 }
  }));
  content.program.addNewTick("t0");
  for (let i = 0; i < 3; i++) content.program.tickAndProcess(() => {});
  return content;
}

function makeConnection(result: ConnectResult, opts: { lastChoice?: DeviceChoice, isConnected?: boolean } = {}) {
  return {
    lastChoice: opts.lastChoice,
    isConnected: opts.isConnected ?? false,
    connect: jest.fn().mockResolvedValue(result),
    reconnect: jest.fn().mockResolvedValue(result),
    disconnect: jest.fn().mockResolvedValue(undefined)
  } as unknown as DeviceConnection;
}

function expectLog(operation: string, change: object) {
  expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.DATAFLOW_TOOL_CHANGE, { tileId, operation, change });
}

describe("device actions", () => {
  beforeEach(() => {
    (logTileChangeEvent as jest.Mock).mockClear();
  });

  it("a successful connect resets the tile's program and logs connectDevice with the device choice", async () => {
    const content = makeContent();
    expect(content.program.recentTicks.length).toBeGreaterThan(1);
    const connection = makeConnection("connected");

    const result = await connectDeviceForTile({ connection, content, tileId, choice: "microbitHub" });

    expect(result).toBe("connected");
    expect(connection.connect).toHaveBeenCalledWith("microbitHub");
    expect(content.program.recentTicks.length).toBe(1);
    expect(logTileChangeEvent).toHaveBeenCalledTimes(2);
    expect((logTileChangeEvent as jest.Mock).mock.calls.map(c => c[1].operation))
      .toEqual(["connectDevice", "resetProgram"]);
    expectLog("connectDevice", { targetType: "device", device: "microbitHub" });
    expectLog("resetProgram", { targetType: "program", trigger: "connect" });
  });

  it.each(["canceled", "failed"] as ConnectResult[])("a %s connect neither resets nor logs", async result => {
    const content = makeContent();
    const ticks = content.program.recentTicks.length;
    const connection = makeConnection(result);

    expect(await connectDeviceForTile({ connection, content, tileId, choice: "arduino" })).toBe(result);

    expect(content.program.recentTicks.length).toBe(ticks);
    expect(logTileChangeEvent).not.toHaveBeenCalled();
  });

  it("reconnect resets and logs reconnectDevice", async () => {
    const content = makeContent();
    const connection = makeConnection("connected", { lastChoice: "spikerbit" });

    expect(await reconnectDeviceForTile({ connection, content, tileId })).toBe("connected");

    expect(content.program.recentTicks.length).toBe(1);
    expectLog("reconnectDevice", { targetType: "device", device: "spikerbit" });
    expectLog("resetProgram", { targetType: "program", trigger: "reconnect" });
  });

  it("a failed reconnect neither resets nor logs", async () => {
    const content = makeContent();
    const ticks = content.program.recentTicks.length;
    const connection = makeConnection("failed", { lastChoice: "arduino" });

    await reconnectDeviceForTile({ connection, content, tileId });

    expect(content.program.recentTicks.length).toBe(ticks);
    expect(logTileChangeEvent).not.toHaveBeenCalled();
  });

  it.each(["connect", "reconnect"])(
    "a %s that finishes after the tile was deleted does not touch the content or log", async operation => {
      const content = makeContent();
      let finish: (r: ConnectResult) => void = () => undefined;
      const pending = new Promise<ConnectResult>(resolve => { finish = resolve; });
      const connection = makeConnection("connected", { lastChoice: "arduino" });
      (connection.connect as jest.Mock).mockReturnValue(pending);
      (connection.reconnect as jest.Mock).mockReturnValue(pending);

      const acting = operation === "connect"
        ? connectDeviceForTile({ connection, content, tileId, choice: "arduino" })
        : reconnectDeviceForTile({ connection, content, tileId });
      destroy(content);
      finish("connected");

      expect(await acting).toBe("connected");
      expect(logTileChangeEvent).not.toHaveBeenCalled();
    });

  it.each(["connect", "reconnect"])(
    "a %s that fails after the tile was deleted does not throw or log", async operation => {
      const content = makeContent();
      let finish: (r: ConnectResult) => void = () => undefined;
      const pending = new Promise<ConnectResult>(resolve => { finish = resolve; });
      const connection = makeConnection("failed", { lastChoice: "arduino" });
      (connection.connect as jest.Mock).mockReturnValue(pending);
      (connection.reconnect as jest.Mock).mockReturnValue(pending);

      const acting = operation === "connect"
        ? connectDeviceForTile({ connection, content, tileId, choice: "arduino" })
        : reconnectDeviceForTile({ connection, content, tileId });
      destroy(content);
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      finish("failed");

      await expect(acting).resolves.toBe("failed");
      expect(warn).not.toHaveBeenCalled();
      expect(logTileChangeEvent).not.toHaveBeenCalled();
      warn.mockRestore();
    });

  it("disconnect logs disconnectDevice and does not reset", async () => {
    const content = makeContent();
    const ticks = content.program.recentTicks.length;
    const connection = makeConnection("connected", { lastChoice: "arduino", isConnected: true });

    await disconnectDeviceForTile({ connection, content, tileId });

    expect(connection.disconnect).toHaveBeenCalled();
    expect(content.program.recentTicks.length).toBe(ticks);
    expect(logTileChangeEvent).toHaveBeenCalledTimes(1);
    expectLog("disconnectDevice", { targetType: "device", device: "arduino" });
  });

  it("disconnect with nothing connected does nothing and logs nothing", async () => {
    const connection = makeConnection("connected");

    await disconnectDeviceForTile({ connection, content: makeContent(), tileId });

    expect(connection.disconnect).not.toHaveBeenCalled();
    expect(logTileChangeEvent).not.toHaveBeenCalled();
  });

  it.each([[false, true], [true, false]])(
    "a failed connect records the error, and marks it unseen only when the pane is closed (pane open: %s)",
    async (paneOpen, unseen) => {
      const content = makeContent();
      content.setConnectPaneOpen(paneOpen);

      await connectDeviceForTile({ connection: makeConnection("failed"), content, tileId, choice: "spikerbit" });

      expect(content.connectError).toBe("Couldn't connect to Spiker:bit.");
      expect(content.unseenConnectError).toBe(unseen);
    }
  );

  it("a failed reconnect names the last choice", async () => {
    const content = makeContent();

    await reconnectDeviceForTile({
      connection: makeConnection("failed", { lastChoice: "arduino" }), content, tileId
    });

    expect(content.connectError).toBe("Couldn't connect to Arduino.");
    expect(content.unseenConnectError).toBe(true);
  });

  it.each([[false, true], [true, false]])(
    "a connect refused because another app has the board says so (pane open: %s)",
    async (paneOpen, unseen) => {
      const content = makeContent();
      content.setConnectPaneOpen(paneOpen);

      expect(await connectDeviceForTile({ connection: makeConnection("inUse"), content, tileId, choice: "spikerbit" }))
        .toBe("inUse");

      expect(content.connectError).toBe("Another app is using the Spiker:bit.");
      expect(content.unseenConnectError).toBe(unseen);
      expect(logTileChangeEvent).not.toHaveBeenCalled();
    }
  );

  it("a reconnect refused because another app has the board says so", async () => {
    const content = makeContent();

    await reconnectDeviceForTile({
      connection: makeConnection("inUse", { lastChoice: "spikerbit" }), content, tileId
    });

    expect(content.connectError).toBe("Another app is using the Spiker:bit.");
  });

  it("a canceled connect records no error", async () => {
    const content = makeContent();

    await connectDeviceForTile({ connection: makeConnection("canceled"), content, tileId, choice: "arduino" });

    expect(content.connectError).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);
  });

  it("a later connect, reconnect or disconnect clears the error", async () => {
    const content = makeContent();
    const fail = () =>
      connectDeviceForTile({ connection: makeConnection("failed"), content, tileId, choice: "arduino" });

    await fail();
    await connectDeviceForTile({ connection: makeConnection("connected"), content, tileId, choice: "arduino" });
    expect(content.connectError).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);

    await fail();
    await reconnectDeviceForTile({
      connection: makeConnection("connected", { lastChoice: "arduino" }), content, tileId
    });
    expect(content.connectError).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);

    await fail();
    await disconnectDeviceForTile({
      connection: makeConnection("connected", { lastChoice: "arduino", isConnected: true }), content, tileId
    });
    expect(content.connectError).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);
  });

  it("opening the pane marks the error seen", async () => {
    const content = makeContent();
    await connectDeviceForTile({ connection: makeConnection("failed"), content, tileId, choice: "arduino" });
    expect(content.unseenConnectError).toBe(true);

    content.setConnectPaneOpen(true);

    expect(content.unseenConnectError).toBe(false);
    expect(content.connectError).toBe("Couldn't connect to Arduino.");
  });

  it("resetProgramForTile resets the program, logs the trigger and leaves recorded data alone", () => {
    const content = makeContent();
    addCasesToDataSet(content.dataSet, [{ x: 1, y: 2 }]);
    const caseCount = content.dataSet.cases.length;
    expect(caseCount).toBeGreaterThan(0);

    resetProgramForTile({ content, tileId, trigger: "button" });

    expect(content.program.recentTicks.length).toBe(1);
    expect(content.dataSet.cases.length).toBe(caseCount);
    expectLog("resetProgram", { targetType: "program", trigger: "button" });
  });
});
