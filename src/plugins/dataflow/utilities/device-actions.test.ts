import { getObserverTree, observable, runInAction } from "mobx";
import { destroy } from "mobx-state-tree";
import { LogEventName } from "../../../lib/logger-types";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { addCasesToDataSet } from "../../../models/data/data-set";
import { DataflowContentModel } from "../model/dataflow-content";
import { DataflowNodeModel } from "../model/dataflow-program-model";
import { AttemptOutcome, FailureKind, IConnectFailure, kStallKinds } from "../model/connect-failures";
import { ConnectionAttempt } from "../model/connection-attempt";
import {
  DeviceChoice, DeviceConnection, IAttemptListener, IAttemptOptions, kFirstDataTimeoutMs
} from "../model/device-connection";
import { SerialDevice } from "../../../models/stores/serial";
import { DeviceLoss } from "../../../models/stores/device-transport";
import { WebSerialTransport } from "../../../models/stores/web-serial-transport";
import { connectionStatusInput, connectPaletteStatus } from "./connect-palette-status";
import {
  connectDeviceForTile, disconnectDeviceForTile, kCheckpointStartMs, newAttemptId, reconnectDeviceForTile,
  resetProgramForTile
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

type Drive = (attempt: ConnectionAttempt, listener: IAttemptListener) => Promise<AttemptOutcome>;

// Ends the attempt the way DeviceConnection does: the outcome is set, then the listener hears of it.
function endAttempt(
  attempt: ConnectionAttempt, listener: IAttemptListener, outcome: AttemptOutcome, extra: Partial<IConnectFailure> = {}
): AttemptOutcome {
  const isFailure = !["connected", "canceled", "unplugged", "lost"].includes(outcome);
  const failure: IConnectFailure | undefined = isFailure
    ? {
      attemptId: attempt.id, kind: outcome as FailureKind, choice: attempt.choice, step: "open", elapsedMs: 0,
      ...extra
    }
    : undefined;
  attempt.end(outcome, failure);
  listener.onEnded?.(attempt);
  return outcome;
}

// A stand-in for DeviceConnection whose attempts are driven by the test. Like the real one, it
// creates the attempt synchronously inside connect or reconnect.
function makeConnection(
  outcomeOrDrive: AttemptOutcome | Drive,
  opts: {
    lastChoice?: DeviceChoice, isConnected?: boolean, paletteView?: "devices" | "actions", busyChoice?: DeviceChoice
  } = {}
) {
  const drive: Drive = typeof outcomeOrDrive === "function"
    ? outcomeOrDrive
    : async (attempt, listener) => {
      // The real connection doesn't finish before its caller has the promise.
      await Promise.resolve();
      if (outcomeOrDrive === "connected") attempt.activated();
      return endAttempt(attempt, listener, outcomeOrDrive);
    };
  // Only `attempt` is observable, as on the real connection, so a reaction can see it replaced.
  const connection = observable({
    lastChoice: opts.lastChoice,
    isConnected: opts.isConnected ?? false,
    busyChoice: opts.busyChoice,
    paletteView: opts.paletteView ?? (opts.isConnected ? "actions" : "devices"),
    attempt: undefined as ConnectionAttempt | undefined,
    lastFailure: undefined as IConnectFailure | undefined,
    connect: jest.fn(),
    reconnect: jest.fn(),
    disconnect: jest.fn().mockResolvedValue(undefined)
  }, {
    lastChoice: false, isConnected: false, busyChoice: false, paletteView: false, attempt: observable.ref,
    lastFailure: false, connect: false, reconnect: false, disconnect: false
  });
  const start = (choice: DeviceChoice, trigger: "connect" | "reconnect", o: IAttemptOptions = {}) => {
    const attempt = new ConnectionAttempt(choice, trigger, o.attemptId);
    runInAction(() => { connection.attempt = attempt; });
    return drive(attempt, o.listener ?? {});
  };
  connection.connect.mockImplementation((choice: DeviceChoice, o?: IAttemptOptions) => start(choice, "connect", o));
  connection.reconnect.mockImplementation((o?: IAttemptOptions) => start(opts.lastChoice!, "reconnect", o));
  return connection as unknown as DeviceConnection & { attempt: ConnectionAttempt | undefined };
}

function ops() {
  return (logTileChangeEvent as jest.Mock).mock.calls.map(c => c[1].operation);
}

function expectLog(operation: string, change: object) {
  expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.DATAFLOW_TOOL_CHANGE, { tileId, operation, change });
}

function expectLogMatching(operation: string, change: object) {
  expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.DATAFLOW_TOOL_CHANGE, {
    tileId, operation, change: expect.objectContaining(change)
  });
}

function loggedChanges(operation: string) {
  return (logTileChangeEvent as jest.Mock).mock.calls
    .filter(c => c[1].operation === operation).map(c => c[1].change);
}

describe("device actions", () => {
  beforeEach(() => {
    (logTileChangeEvent as jest.Mock).mockClear();
  });

  it("newAttemptId makes a new id each time", () => {
    const ids = [newAttemptId(), newAttemptId()];
    expect(ids[0]).not.toBe("");
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("a successful connect resets the tile's program", async () => {
    const content = makeContent();
    expect(content.program.recentTicks.length).toBeGreaterThan(1);
    const connection = makeConnection("connected");

    const result = await connectDeviceForTile({ connection, content, tileId, choice: "microbitHub" });

    expect(result).toBe("connected");
    expect(connection.connect).toHaveBeenCalledWith("microbitHub",
      { attemptId: expect.any(String), listener: expect.any(Object) });
    expect(content.program.recentTicks.length).toBe(1);
    expectLog("resetProgram", { targetType: "program", trigger: "connect" });
  });

  it("logs connectDevice at the click, then connectResult, for a quick attempt", async () => {
    const connection = makeConnection("connected");

    await connectDeviceForTile({ connection, content: makeContent(), tileId, choice: "spikerbit" });

    expect(ops()).toEqual(["connectDevice", "resetProgram", "connectResult"]);
    expectLog("connectDevice", { targetType: "device", device: "spikerbit", attemptId: expect.any(String) });
    expectLogMatching("connectResult", {
      targetType: "device", device: "spikerbit", attemptId: expect.any(String), outcome: "connected",
      trigger: "connect", elapsedMs: expect.any(Number), steps: expect.objectContaining({ active: expect.any(Number) })
    });
    const ids = (logTileChangeEvent as jest.Mock).mock.calls
      .filter(c => c[1].operation !== "resetProgram").map(c => c[1].change.attemptId);
    expect(new Set(ids).size).toBe(1);
  });

  it("resets the program when the device becomes active, before the attempt ends", async () => {
    const content = makeContent();
    const ticks = content.program.recentTicks.length;
    let finish: () => void = () => undefined;
    const connection = makeConnection((attempt, listener) => new Promise<AttemptOutcome>(resolve => {
      finish = () => resolve(endAttempt(attempt, listener, "connected"));
      setTimeout(() => attempt.activated(), 0);
    }));
    jest.useFakeTimers();
    try {
      const acting = connectDeviceForTile({ connection, content, tileId, choice: "arduino" });
      expect(content.program.recentTicks.length).toBe(ticks);
      jest.advanceTimersByTime(1);
      expect(content.program.recentTicks.length).toBe(1);
      expect(ops()).toEqual(["connectDevice", "resetProgram"]);
      finish();
      await acting;
      expect(ops()).toEqual(["connectDevice", "resetProgram", "connectResult"]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("a canceled attempt logs connectDevice and connectResult with outcome canceled, and records no failure",
    async () => {
      const content = makeContent();
      const ticks = content.program.recentTicks.length;

      expect(await connectDeviceForTile({
        connection: makeConnection("canceled"), content, tileId, choice: "arduino"
      })).toBe("canceled");

      expect(content.program.recentTicks.length).toBe(ticks);
      expect(ops()).toEqual(["connectDevice", "connectResult"]);
      expectLogMatching("connectResult", { outcome: "canceled" });
      expect(loggedChanges("connectResult")[0].failedStep).toBeUndefined();
      expect(content.connectFailure).toBeUndefined();
      expect(content.unseenConnectError).toBe(false);
    });

  it("a failed connect does not reset, and logs connectResult with the failed step and error", async () => {
    const content = makeContent();
    const ticks = content.program.recentTicks.length;
    const connection = makeConnection((attempt, listener) => {
      attempt.chooserClosed();
      return Promise.resolve(endAttempt(attempt, listener, "openFailed", {
        step: "open", error: { name: "NetworkError", message: "Failed to open serial port." }
      }));
    });

    await connectDeviceForTile({ connection, content, tileId, choice: "arduino" });

    expect(content.program.recentTicks.length).toBe(ticks);
    expect(ops()).toEqual(["connectDevice", "connectResult"]);
    expectLogMatching("connectResult", {
      outcome: "openFailed", failedStep: "open",
      error: { name: "NetworkError", message: "Failed to open serial port." },
      steps: { chooserClosed: expect.any(Number) }
    });
  });

  it("connectResult includes the firmware when the attempt recorded it", async () => {
    const connection = makeConnection("connected");
    connection.connect = jest.fn(async (choice: DeviceChoice, o?: IAttemptOptions) => {
      const attempt = new ConnectionAttempt(choice, "connect", o?.attemptId);
      (connection as any).attempt = attempt;
      attempt.firmwareChecked("1.0", false);
      attempt.activated();
      return endAttempt(attempt, o!.listener!, "connected");
    });

    await connectDeviceForTile({ connection, content: makeContent(), tileId, choice: "spikerbit" });

    expectLogMatching("connectResult", { firmware: { found: "1.0", updated: false } });
  });

  it("logs connectProgress at 5, 10 and 20 s while the attempt runs, then stops", async () => {
    jest.useFakeTimers();
    try {
      let finish: () => void = () => undefined;
      const connection = makeConnection((attempt, listener) => new Promise<AttemptOutcome>(resolve => {
        attempt.opened("waitForData");
        finish = () => resolve(endAttempt(attempt, listener, "connected"));
      }));
      const acting = connectDeviceForTile({ connection, content: makeContent(), tileId, choice: "arduino" });

      expect(kCheckpointStartMs).toBe(5000);
      await jest.advanceTimersByTimeAsync(25000);
      const progress = loggedChanges("connectProgress");
      expect(progress.map(c => c.elapsedMs)).toEqual([5000, 10000, 20000]);
      expect(progress[0]).toEqual(expect.objectContaining({
        targetType: "device", device: "arduino", trigger: "connect", step: "waitForData",
        steps: { opened: expect.any(Number) }, attemptId: expect.any(String)
      }));
      expect(progress[0].updatePercent).toBeUndefined();

      finish();
      await acting;
      await jest.advanceTimersByTimeAsync(60000);
      expect(loggedChanges("connectProgress").length).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it("connectProgress reports the update percent during an update", async () => {
    jest.useFakeTimers();
    try {
      const connection = makeConnection(attempt => {
        attempt.opened("checkFirmware");
        attempt.firmwareChecked(null, true);
        attempt.updateProgress(40);
        return new Promise<AttemptOutcome>(() => undefined);
      });
      void connectDeviceForTile({ connection, content: makeContent(), tileId, choice: "spikerbit" });

      await jest.advanceTimersByTimeAsync(5000);

      expectLogMatching("connectProgress", { step: "update", updatePercent: 40 });
    } finally {
      jest.useRealTimers();
    }
  });

  it("logs a checkpoint's elapsedMs from the clock, not the schedule", async () => {
    jest.useFakeTimers();
    try {
      const connection = makeConnection(() => new Promise<AttemptOutcome>(() => undefined));
      void connectDeviceForTile({ connection, content: makeContent(), tileId, choice: "arduino" });
      const attempt = connection.attempt!;
      jest.spyOn(attempt, "elapsedMs", "get").mockReturnValue(5400);

      await jest.advanceTimersByTimeAsync(5000);

      expect(loggedChanges("connectProgress")[0].elapsedMs).toBe(5400);
    } finally {
      jest.useRealTimers();
    }
  });

  it("reconnect resets and logs reconnectDevice then connectResult", async () => {
    const content = makeContent();
    const connection = makeConnection("connected", { lastChoice: "spikerbit" });

    expect(await reconnectDeviceForTile({ connection, content, tileId })).toBe("connected");

    expect(content.program.recentTicks.length).toBe(1);
    expect(connection.reconnect).toHaveBeenCalledWith({ attemptId: expect.any(String), listener: expect.any(Object) });
    expect(ops()).toEqual(["reconnectDevice", "resetProgram", "connectResult"]);
    expectLog("reconnectDevice", { targetType: "device", device: "spikerbit", attemptId: expect.any(String) });
    expectLog("resetProgram", { targetType: "program", trigger: "reconnect" });
    expectLogMatching("connectResult", { trigger: "reconnect", outcome: "connected" });
  });

  it("a connect refused because one is running logs nothing and keeps the tile's failure", async () => {
    const content = makeContent();
    await connectDeviceForTile({ connection: makeConnection("openFailed"), content, tileId, choice: "arduino" });
    (logTileChangeEvent as jest.Mock).mockClear();
    const connection = makeConnection("connected", { busyChoice: "spikerbit" });

    expect(await connectDeviceForTile({ connection, content, tileId, choice: "arduino" })).toBe("canceled");

    expect(connection.connect).not.toHaveBeenCalled();
    expect(logTileChangeEvent).not.toHaveBeenCalled();
    expect(content.connectFailure?.kind).toBe("openFailed");
  });

  it.each([
    ["one is running", { lastChoice: "arduino", busyChoice: "arduino" }],
    ["there is nothing to reconnect", {}]
  ] as [string, { lastChoice?: DeviceChoice, busyChoice?: DeviceChoice }][])(
    "a reconnect refused because %s logs nothing and keeps the tile's failure", async (_name, opts) => {
      const content = makeContent();
      await connectDeviceForTile({ connection: makeConnection("openFailed"), content, tileId, choice: "arduino" });
      (logTileChangeEvent as jest.Mock).mockClear();
      const connection = makeConnection("connected", opts);

      expect(await reconnectDeviceForTile({ connection, content, tileId })).toBe("canceled");

      expect(connection.reconnect).not.toHaveBeenCalled();
      expect(logTileChangeEvent).not.toHaveBeenCalled();
      expect(content.connectFailure?.kind).toBe("openFailed");
    });

  it("a failed reconnect does not reset, and logs only the start and the result", async () => {
    const content = makeContent();
    const ticks = content.program.recentTicks.length;
    const connection = makeConnection("openFailed", { lastChoice: "arduino" });

    await reconnectDeviceForTile({ connection, content, tileId });

    expect(content.program.recentTicks.length).toBe(ticks);
    expect(ops()).toEqual(["reconnectDevice", "connectResult"]);
  });

  it.each(["connect", "reconnect"])(
    "a %s that finishes after the tile was deleted logs its result without touching the content", async operation => {
      const content = makeContent();
      let finish: () => void = () => undefined;
      const connection = makeConnection((attempt, listener) => new Promise<AttemptOutcome>(resolve => {
        finish = () => {
          attempt.activated();
          resolve(endAttempt(attempt, listener, "connected"));
        };
      }), { lastChoice: "arduino" });
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

      const acting = operation === "connect"
        ? connectDeviceForTile({ connection, content, tileId, choice: "arduino" })
        : reconnectDeviceForTile({ connection, content, tileId });
      (logTileChangeEvent as jest.Mock).mockClear();
      destroy(content);
      finish();

      expect(await acting).toBe("connected");
      expect(ops()).toEqual(["connectResult"]);
      expectLogMatching("connectResult", { outcome: "connected" });
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

  it.each(["connect", "reconnect"])(
    "a %s that fails after the tile was deleted logs its result and does not throw", async operation => {
      const content = makeContent();
      let finish: () => void = () => undefined;
      const connection = makeConnection((attempt, listener) => new Promise<AttemptOutcome>(resolve => {
        finish = () => resolve(endAttempt(attempt, listener, "openFailed"));
      }), { lastChoice: "arduino" });

      const acting = operation === "connect"
        ? connectDeviceForTile({ connection, content, tileId, choice: "arduino" })
        : reconnectDeviceForTile({ connection, content, tileId });
      (logTileChangeEvent as jest.Mock).mockClear();
      destroy(content);
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      finish();

      await expect(acting).resolves.toBe("openFailed");
      expect(warn).not.toHaveBeenCalled();
      expect(ops()).toEqual(["connectResult"]);
      expectLogMatching("connectResult", { outcome: "openFailed", failedStep: "open" });
      warn.mockRestore();
    });

  it("a deleted tile's attempt keeps logging its checkpoints until it ends, and nothing throws", async () => {
    jest.useFakeTimers();
    try {
      const content = makeContent();
      let finish: () => void = () => undefined;
      const connection = makeConnection((attempt, listener) => new Promise<AttemptOutcome>(resolve => {
        finish = () => resolve(endAttempt(attempt, listener, "openTimeout"));
      }));
      const acting = connectDeviceForTile({ connection, content, tileId, choice: "arduino" });
      await jest.advanceTimersByTimeAsync(5000);
      expect(loggedChanges("connectProgress").length).toBe(1);

      destroy(content);
      await expect(jest.advanceTimersByTimeAsync(20000)).resolves.not.toThrow();
      expect(loggedChanges("connectProgress").map(c => c.elapsedMs)).toEqual([5000, 10000, 20000]);

      finish();
      await acting;
      await jest.advanceTimersByTimeAsync(60000);
      expect(loggedChanges("connectProgress").length).toBe(3);
      expectLogMatching("connectResult", { outcome: "openTimeout" });
    } finally {
      jest.useRealTimers();
    }
  });

  it("an attempt whose tile was deleted still logs a recovery, an abandoned open and a loss", async () => {
    const content = makeContent();
    let attempt: ConnectionAttempt | undefined;
    let listener: IAttemptListener = {};
    const connection = makeConnection((a, l) => {
      attempt = a;
      listener = l;
      return Promise.resolve(endAttempt(a, l, "noData", { step: "waitForData" }));
    });
    await connectDeviceForTile({ connection, content, tileId, choice: "arduino" });
    destroy(content);
    (logTileChangeEvent as jest.Mock).mockClear();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    attempt!.dataArrived();
    listener.onRecovered?.(attempt!);
    listener.onAbandonedOpen?.(attempt!, { late: "opened" });
    listener.onLost?.(attempt!, "unplugged");

    expect(ops()).toEqual(["connectRecovered", "abandonedOpen", "deviceLost"]);
    expect(warn).not.toHaveBeenCalled();
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

  it("disconnect works on a device that is open but not the active one", async () => {
    const connection = makeConnection("connected", {
      lastChoice: "spikerbit", isConnected: false, paletteView: "actions"
    });

    await disconnectDeviceForTile({ connection, content: makeContent(), tileId });

    expect(connection.disconnect).toHaveBeenCalled();
    expectLog("disconnectDevice", { targetType: "device", device: "spikerbit" });
  });

  it("disconnect with nothing connected does nothing and logs nothing", async () => {
    const connection = makeConnection("connected");

    await disconnectDeviceForTile({ connection, content: makeContent(), tileId });

    expect(connection.disconnect).not.toHaveBeenCalled();
    expect(logTileChangeEvent).not.toHaveBeenCalled();
  });

  it.each([[false, true], [true, false]])(
    "a failed connect records the failure, and marks it unseen only when the palette is closed (palette open: %s)",
    async (paletteOpen, unseen) => {
      const content = makeContent();
      content.setConnectPaletteOpen(paletteOpen);

      await connectDeviceForTile({ connection: makeConnection("openFailed"), content, tileId, choice: "spikerbit" });

      expect(content.connectFailure).toEqual(expect.objectContaining({ kind: "openFailed", choice: "spikerbit" }));
      expect(content.unseenConnectError).toBe(unseen);
    }
  );

  it("a failed reconnect records a failure for the last choice", async () => {
    const content = makeContent();

    await reconnectDeviceForTile({
      connection: makeConnection("openFailed", { lastChoice: "arduino" }), content, tileId
    });

    expect(content.connectFailure).toEqual(expect.objectContaining({ kind: "openFailed", choice: "arduino" }));
    expect(content.unseenConnectError).toBe(true);
  });

  it("a connect refused because another app has the board records inUse", async () => {
    const content = makeContent();

    expect(await connectDeviceForTile({ connection: makeConnection("inUse"), content, tileId, choice: "spikerbit" }))
      .toBe("inUse");

    expect(content.connectFailure?.kind).toBe("inUse");
    expect(content.unseenConnectError).toBe(true);
  });

  it.each(kStallKinds)("a %s stall records the failure and still logs the result", async kind => {
    const content = makeContent();
    content.setConnectPaletteOpen(true);

    await connectDeviceForTile({ connection: makeConnection(kind), content, tileId, choice: "spikerbit" });

    expect(content.connectFailure?.kind).toBe(kind);
    expect(content.unseenConnectError).toBe(false);
    expectLogMatching("connectResult", { outcome: kind });
  });

  it.each(["unplugged", "lost"] as AttemptOutcome[])("an attempt that ends as %s records no failure", async outcome => {
    const content = makeContent();

    await connectDeviceForTile({ connection: makeConnection(outcome), content, tileId, choice: "arduino" });

    expect(content.connectFailure).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);
  });

  it("a failure stores the tile's connectFailure and logs failedStep and error", async () => {
    const content = makeContent();
    const connection = makeConnection((attempt, listener) => Promise.resolve(endAttempt(
      attempt, listener, "updateFailed", { step: "update", error: { code: "E1", message: "flash failed" } }
    )));

    await connectDeviceForTile({ connection, content, tileId, choice: "spikerbit" });

    expect(content.connectFailure).toEqual({
      attemptId: expect.any(String), kind: "updateFailed", choice: "spikerbit", step: "update", elapsedMs: 0,
      error: { code: "E1", message: "flash failed" }
    });
    expectLogMatching("connectResult", {
      outcome: "updateFailed", failedStep: "update", error: { code: "E1", message: "flash failed" }
    });
  });

  it("a recovery logs connectRecovered and clears the tile's failure", async () => {
    const content = makeContent();
    let attempt: ConnectionAttempt | undefined;
    let listener: IAttemptListener = {};
    const connection = makeConnection((a, l) => {
      attempt = a;
      listener = l;
      return Promise.resolve(endAttempt(a, l, "notResponding"));
    });
    await connectDeviceForTile({ connection, content, tileId, choice: "spikerbit" });
    expect(content.connectFailure?.kind).toBe("notResponding");

    attempt!.dataArrived();
    listener.onRecovered?.(attempt!);

    expect(content.connectFailure).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);
    expectLogMatching("connectRecovered", {
      targetType: "device", device: "spikerbit", attemptId: attempt!.id, elapsedMs: expect.any(Number),
      steps: { firstData: expect.any(Number) }
    });
  });

  it("logs abandonedOpen with what the attempt reports", async () => {
    const content = makeContent();
    let attempt: ConnectionAttempt | undefined;
    let listener: IAttemptListener = {};
    const connection = makeConnection((a, l) => {
      attempt = a;
      listener = l;
      return Promise.resolve(endAttempt(a, l, "openTimeout"));
    });
    await connectDeviceForTile({ connection, content, tileId, choice: "arduino" });

    listener.onAbandonedOpen?.(attempt!, { close: "ok", forget: "unsupported", late: "opened" });

    expectLogMatching("abandonedOpen", {
      targetType: "device", device: "arduino", attemptId: attempt!.id,
      close: "ok", forget: "unsupported", late: "opened"
    });
  });

  it("deviceLost is logged with the reason after a connection", async () => {
    const content = makeContent();
    let attempt: ConnectionAttempt | undefined;
    let listener: IAttemptListener = {};
    const connection = makeConnection((a, l) => {
      attempt = a;
      listener = l;
      a.activated();
      return Promise.resolve(endAttempt(a, l, "connected"));
    });
    await connectDeviceForTile({ connection, content, tileId, choice: "spikerbit" });

    listener.onLost?.(attempt!, "unplugged");

    expectLogMatching("deviceLost", {
      targetType: "device", device: "spikerbit", attemptId: attempt!.id, reason: "unplugged"
    });
    expect(content.connectFailure).toBeUndefined();
  });

  it("a stalled update that later fails replaces the tile's failure with the connection's", async () => {
    const content = makeContent();
    content.setConnectPaletteOpen(true);
    let attempt: ConnectionAttempt | undefined;
    let listener: IAttemptListener = {};
    const connection = makeConnection((a, l) => {
      attempt = a;
      listener = l;
      return Promise.resolve(endAttempt(a, l, "updateStalled", { step: "update" }));
    });
    await connectDeviceForTile({ connection, content, tileId, choice: "spikerbit" });
    expect(content.connectFailure?.kind).toBe("updateStalled");

    connection.lastFailure = {
      attemptId: attempt!.id, kind: "updateFailed", choice: "spikerbit", step: "update", elapsedMs: 12000
    };
    listener.onLost?.(attempt!, "updateFailed");

    expect(content.connectFailure?.kind).toBe("updateFailed");
    expectLogMatching("deviceLost", { reason: "updateFailed" });
  });

  it.each(["unplugged", "lost"] as const)(
    "a loss (%s) after a stall clears the tile's stall failure and marks nothing unseen", async reason => {
      const content = makeContent();
      content.setConnectPaletteOpen(true);
      let attempt: ConnectionAttempt | undefined;
      let listener: IAttemptListener = {};
      const connection = makeConnection((a, l) => {
        attempt = a;
        listener = l;
        return Promise.resolve(endAttempt(a, l, "noData", { step: "waitForData" }));
      });
      await connectDeviceForTile({ connection, content, tileId, choice: "arduino" });
      content.setConnectPaletteOpen(false);

      // Only a stalled update's failed flash is a failure to show; the reason says which it is.
      connection.lastFailure = attempt!.failure;
      listener.onLost?.(attempt!, reason);

      expect(content.connectFailure).toBeUndefined();
      expect(content.unseenConnectError).toBe(false);
      expectLogMatching("deviceLost", { reason });
    });

  it("an unplug after a real connection's noData stall shows the loss, not the stall", async () => {
    jest.useFakeTimers();
    try {
      const transport = {
        open: jest.fn().mockResolvedValue("opened"), close: jest.fn().mockResolvedValue(undefined),
        startReading: jest.fn(), write: jest.fn(), deviceFamily: "arduino", raisesWebSerialConnect: true,
        onData: undefined, onDisconnect: undefined as ((loss: DeviceLoss) => void) | undefined
      };
      const connection = new DeviceConnection(new SerialDevice(), {
        createWebSerialTransport: () => transport as unknown as WebSerialTransport
      });
      const content = makeContent();
      content.setConnectPaletteOpen(true);
      const acting = connectDeviceForTile({ connection, content, tileId, choice: "arduino" });
      await jest.advanceTimersByTimeAsync(kFirstDataTimeoutMs);
      expect(await acting).toBe("noData");
      expect(content.connectFailure?.kind).toBe("noData");
      content.setConnectPaletteOpen(false);

      transport.onDisconnect!("unplugged");

      expect(content.connectFailure).toBeUndefined();
      expect(content.unseenConnectError).toBe(false);
      expect(connectPaletteStatus(connectionStatusInput(connection, content.connectFailure)).line2?.text)
        .toBe("It was unplugged.");
      expectLogMatching("deviceLost", { reason: "unplugged" });
    } finally {
      jest.useRealTimers();
    }
  });

  it("a stalled update that finishes later resets the program", async () => {
    const content = makeContent();
    let attempt: ConnectionAttempt | undefined;
    const connection = makeConnection(async (a, l) => {
      attempt = a;
      await Promise.resolve();
      return endAttempt(a, l, "updateStalled", { step: "update" });
    });
    await connectDeviceForTile({ connection, content, tileId, choice: "spikerbit" });
    expect(ops()).not.toContain("resetProgram");

    attempt!.activated();
    expect(content.program.recentTicks.length).toBe(1);
    expectLog("resetProgram", { targetType: "program", trigger: "connect" });
  });

  it("a stalled update's reset ends when a newer attempt replaces it", async () => {
    const content = makeContent();
    let stalled: ConnectionAttempt | undefined;
    const connection = makeConnection(async (a, l) => {
      stalled ??= a;
      await Promise.resolve();
      return endAttempt(a, l, a === stalled ? "updateStalled" : "openFailed");
    });
    const watched = () => !!getObserverTree(stalled!, "steps").observers?.length;
    await connectDeviceForTile({ connection, content, tileId, choice: "spikerbit" });
    expect(watched()).toBe(true);
    await connectDeviceForTile({ connection, content, tileId, choice: "arduino" });
    expect(watched()).toBe(false);

    // Only the stalled attempt's own board could set this, and it was let go.
    stalled!.activated();
    expect(ops()).not.toContain("resetProgram");
    expect(content.program.recentTicks.length).toBeGreaterThan(1);
  });

  it("a stall that changes after the attempt ended updates the tile's failure", async () => {
    const content = makeContent();
    let attempt: ConnectionAttempt | undefined;
    let listener: IAttemptListener = {};
    const connection = makeConnection((a, l) => {
      attempt = a;
      listener = l;
      return Promise.resolve(endAttempt(a, l, "updateStalled", { step: "update" }));
    });
    await connectDeviceForTile({ connection, content, tileId, choice: "spikerbit" });
    expect(content.connectFailure?.kind).toBe("updateStalled");

    listener.onStallChanged?.(attempt!, undefined);
    expect(content.connectFailure).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);

    const stall: IConnectFailure = {
      attemptId: attempt!.id, kind: "notResponding", choice: "spikerbit", step: "waitForData", elapsedMs: 5000
    };
    listener.onStallChanged?.(attempt!, stall);
    expect(content.connectFailure).toEqual(stall);
    expect(content.unseenConnectError).toBe(true);
  });

  it("a canceled connect records no failure", async () => {
    const content = makeContent();

    await connectDeviceForTile({ connection: makeConnection("canceled"), content, tileId, choice: "arduino" });

    expect(content.connectFailure).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);
  });

  it("a later connect, reconnect or disconnect clears the failure", async () => {
    const content = makeContent();
    const fail = () =>
      connectDeviceForTile({ connection: makeConnection("openFailed"), content, tileId, choice: "arduino" });

    await fail();
    await connectDeviceForTile({ connection: makeConnection("connected"), content, tileId, choice: "arduino" });
    expect(content.connectFailure).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);

    await fail();
    await reconnectDeviceForTile({
      connection: makeConnection("connected", { lastChoice: "arduino" }), content, tileId
    });
    expect(content.connectFailure).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);

    await fail();
    await disconnectDeviceForTile({
      connection: makeConnection("connected", { lastChoice: "arduino", isConnected: true }), content, tileId
    });
    expect(content.connectFailure).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);
  });

  it("opening the palette marks the failure seen", async () => {
    const content = makeContent();
    await connectDeviceForTile({ connection: makeConnection("openFailed"), content, tileId, choice: "arduino" });
    expect(content.unseenConnectError).toBe(true);

    content.setConnectPaletteOpen(true);

    expect(content.unseenConnectError).toBe(false);
    expect(content.connectFailure?.kind).toBe("openFailed");
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
