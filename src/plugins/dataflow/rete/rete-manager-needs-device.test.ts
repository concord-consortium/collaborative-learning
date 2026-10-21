import { applySnapshot, getSnapshot, SnapshotIn } from "mobx-state-tree";
import { DataflowContentModel } from "../model/dataflow-content";
import { DataflowNodeModel } from "../model/dataflow-program-model";
import { specStores } from "../../../models/stores/spec-stores";
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

async function openProgram(
  nodes: Array<ReturnType<typeof sensorNode | typeof numberNode>>,
  options: { readOnly?: boolean; connected?: boolean } = {}
) {
  const content = DataflowContentModel.create();
  nodes.forEach(node => content.program.addNode(node));
  const stores = specStores();
  const alert = jest.spyOn(stores.ui, "alert").mockImplementation(() => undefined);
  if (options.connected) {
    stores.serialDevice.setActiveDevice("arduino", { write: jest.fn(), close: jest.fn() });
  }
  const manager = new ReteManager(
    content.program, "tile1", document.createElement("div"), content, stores,
    options.readOnly, false
  );
  await manager.setupComplete;
  // Let anything the manager queued after setup run before the test makes its edits.
  await Promise.resolve();
  return { alert, content, manager, stores };
}

describe("ReteManager needs-a-device alert", () => {
  const managers: ReteManager[] = [];
  afterEach(() => {
    managers.splice(0).forEach(m => m.dispose());
    jest.restoreAllMocks();
  });

  it("shows the alert when an editable program that needs a device opens with nothing connected", async () => {
    const { alert, content, manager } = await openProgram([sensorNode("s1", "emg")]);
    managers.push(manager);
    expect(content.needsDevice).toBe(true);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it("does not show the alert when an edit later makes the program need a device", async () => {
    const { alert, content, manager } = await openProgram([numberNode("n1")]);
    managers.push(manager);
    expect(content.needsDevice).toBe(false);

    content.program.addNode(sensorNode("s1", "emg"));
    await Promise.resolve();
    expect(content.needsDevice).toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });

  it("does not show the alert when a sensor is switched to a hardware one", async () => {
    const { alert, content, manager } = await openProgram([sensorNode("s1", "temperature")]);
    managers.push(manager);
    expect(content.needsDevice).toBe(false);

    const { data } = content.program.nodes.get("s1")!;
    applySnapshot(data, { ...getSnapshot(data), sensor: "emg" } as SnapshotIn<typeof data>);
    expect(content.needsDevice).toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });

  it("does not show the alert after a disconnect", async () => {
    const { alert, content, manager, stores } = await openProgram(
      [sensorNode("s1", "emg")], { connected: true }
    );
    managers.push(manager);
    expect(alert).not.toHaveBeenCalled();

    stores.serialDevice.clearActiveDevice();
    await Promise.resolve();
    expect(content.needsDevice).toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });

  it("does not show the alert for a read-only program", async () => {
    const { alert, manager } = await openProgram([sensorNode("s1", "emg")], { readOnly: true });
    managers.push(manager);
    expect(alert).not.toHaveBeenCalled();
  });
});
