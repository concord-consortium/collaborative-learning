import { autorun } from "mobx";
import { LiveOutputNode } from "../nodes/live-output-node";
import { SensorNode, SensorNodeModel } from "../nodes/sensor-node";
import { programNeedsDevice } from "./program-needs-device";

function makeSensorNode(sensor: string) {
  const node = Object.create(SensorNode.prototype);
  node.model = SensorNodeModel.create({ type: "Sensor", sensor });
  return node as SensorNode;
}

function makeLiveOutputNode(wired: boolean, selectedOutput: unknown) {
  const node: any = Object.create(LiveOutputNode.prototype);
  node.isConnected = jest.fn(() => wired);
  node.getSelectedOutputVariable = jest.fn(() => selectedOutput);
  return node as LiveOutputNode;
}

describe("programNeedsDevice", () => {
  it("is false for a program with no hardware blocks", () => {
    expect(programNeedsDevice([])).toBe(false);
    expect(programNeedsDevice([{}, "not a node"])).toBe(false);
  });

  it("is true when a Sensor block reads a live sensor such as emg", () => {
    expect(programNeedsDevice([makeSensorNode("emg")])).toBe(true);
  });

  it("is false for a simulated sensor channel", () => {
    expect(programNeedsDevice([makeSensorNode("SIM-emg")])).toBe(false);
  });

  it("is true for a wired Live Output block without a simulated output", () => {
    expect(programNeedsDevice([makeLiveOutputNode(true, undefined)])).toBe(true);
  });

  it("is false for a Live Output block that is not wired or has a simulated output", () => {
    expect(programNeedsDevice([makeLiveOutputNode(false, undefined)])).toBe(false);
    expect(programNeedsDevice([makeLiveOutputNode(true, {})])).toBe(false);
  });

  it("re-evaluates in an autorun when a Sensor block's sensor changes", () => {
    // setSensor reprocesses the program, which warns because a bare model has no processor.
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const node = makeSensorNode("");
    const seen: boolean[] = [];
    const dispose = autorun(() => { seen.push(programNeedsDevice([node])); });
    node.model.setSensor("emg");
    dispose();
    expect(seen).toEqual([false, true]);
    jest.restoreAllMocks();
  });
});
