import { applySnapshot, getSnapshot, SnapshotIn } from "mobx-state-tree";
import { DataflowContentModel } from "../model/dataflow-content";
import { DataflowNodeModel } from "../model/dataflow-program-model";
import { specStores } from "../../../models/stores/spec-stores";
import { IDeviceTransport } from "../../../models/stores/device-transport";
import { ReteManager } from "./rete-manager";

function sensorNode(id: string, sensor: string) {
  return DataflowNodeModel.create({
    id, name: "Sensor", x: 0, y: 0, data: { type: "Sensor", sensor }
  });
}

function numberNode(id: string) {
  return DataflowNodeModel.create({
    id, name: "Number", x: 0, y: 0, data: { type: "Number", value: 1 }
  });
}

function fakeTransport(): IDeviceTransport {
  return { write: jest.fn(), close: jest.fn() };
}

async function openProgram(
  nodes: Array<ReturnType<typeof sensorNode | typeof numberNode>>,
  options: { readOnly?: boolean; playback?: boolean; connected?: boolean } = {}
) {
  const content = DataflowContentModel.create();
  nodes.forEach(node => content.program.addNode(node));
  const stores = specStores();
  if (options.connected) stores.serialDevice.setActiveDevice("arduino", fakeTransport());
  const manager = new ReteManager(
    content.program, "tile1", document.createElement("div"), content, stores,
    options.readOnly, options.playback ?? false
  );
  await manager.setupComplete;
  // Let anything the manager queued after setup run before the test makes its edits.
  await Promise.resolve();
  return { content, manager, stores };
}

describe("ReteManager needs-a-device on open", () => {
  const managers: ReteManager[] = [];
  afterEach(() => {
    managers.splice(0).forEach(m => m.dispose());
    jest.restoreAllMocks();
  });

  it("flags an editable program that needs a device and opens with nothing connected", async () => {
    const { content, manager } = await openProgram([sensorNode("s1", "emg")]);
    managers.push(manager);
    expect(content.needsDevice).toBe(true);
    expect(content.showConnectTutorialOnOpen).toBe(true);
  });

  it("does not flag a program that does not need a device", async () => {
    const { content, manager } = await openProgram([numberNode("n1")]);
    managers.push(manager);
    expect(content.showConnectTutorialOnOpen).toBe(false);
  });

  it("does not flag when an edit later makes the program need a device", async () => {
    const { content, manager } = await openProgram([numberNode("n1")]);
    managers.push(manager);
    expect(content.needsDevice).toBe(false);

    content.program.addNode(sensorNode("s1", "emg"));
    await Promise.resolve();
    expect(content.needsDevice).toBe(true);
    expect(content.showConnectTutorialOnOpen).toBe(false);
  });

  it("does not flag when a sensor is switched to a hardware one", async () => {
    const { content, manager } = await openProgram([sensorNode("s1", "temperature")]);
    managers.push(manager);
    expect(content.needsDevice).toBe(false);

    const { data } = content.program.nodes.get("s1")!;
    applySnapshot(data, { ...getSnapshot(data), sensor: "emg" } as SnapshotIn<typeof data>);
    expect(content.needsDevice).toBe(true);
    expect(content.showConnectTutorialOnOpen).toBe(false);
  });

  it("does not flag after a disconnect of a device that was connected at open", async () => {
    const { content, manager, stores } = await openProgram(
      [sensorNode("s1", "emg")], { connected: true }
    );
    managers.push(manager);
    expect(content.showConnectTutorialOnOpen).toBe(false);

    stores.serialDevice.clearActiveDevice();
    await Promise.resolve();
    expect(content.needsDevice).toBe(true);
    expect(content.showConnectTutorialOnOpen).toBe(false);
  });

  it("does not flag a read-only program", async () => {
    const { content, manager } = await openProgram([sensorNode("s1", "emg")], { readOnly: true });
    managers.push(manager);
    expect(content.showConnectTutorialOnOpen).toBe(false);
  });

  it("does not flag for the playback manager in Done mode", async () => {
    const { content, manager } = await openProgram([sensorNode("s1", "emg")], { playback: true });
    managers.push(manager);
    expect(content.showConnectTutorialOnOpen).toBe(false);
  });

  it("does not flag when the manager is disposed before setup finishes", async () => {
    // Disposing mid-setup makes the manager warn that it was asked to process.
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const content = DataflowContentModel.create();
    content.program.addNode(sensorNode("s1", "emg"));
    const manager = new ReteManager(
      content.program, "tile1", document.createElement("div"), content, specStores(), false, false
    );
    manager.dispose();
    await manager.setupComplete;
    expect(content.showConnectTutorialOnOpen).toBe(false);
  });
});

describe("ReteManager connect failure", () => {
  const managers: ReteManager[] = [];
  afterEach(() => {
    managers.splice(0).forEach(m => m.dispose());
  });

  async function openWithError() {
    const opened = await openProgram([sensorNode("s1", "emg")]);
    managers.push(opened.manager);
    opened.content.setConnectFailure({
      attemptId: "attempt-1", kind: "openFailed", choice: "arduino", step: "open", elapsedMs: 0
    });
    opened.content.setUnseenConnectError(true);
    return opened;
  }

  it("clears the tile's error when a device connects from any tile", async () => {
    const { content, stores } = await openWithError();
    stores.serialDevice.setActiveDevice("arduino", fakeTransport());
    expect(content.connectFailure).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);
  });

  it("does not bring the error back when that device disconnects", async () => {
    const { content, stores } = await openWithError();
    stores.serialDevice.setActiveDevice("arduino", fakeTransport());
    stores.serialDevice.clearActiveDevice();
    expect(content.connectFailure).toBeUndefined();
    expect(content.unseenConnectError).toBe(false);
  });
});
