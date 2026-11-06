import { DemoOutputNode, DemoOutputNodeModel } from "./demo-output-node";

// Object.create bypasses the constructor, as the live-output-node tests do; stub only what data()
// and the readout touch. The getSetting stub honors the `group` argument (production passes
// "dataflow"), so a dropped or mistyped group reads undefined and the test fails.
function stubbedNode(outputType: string, settings: Record<string, any> = {}) {
  const node: any = Object.create(DemoOutputNode.prototype);
  node.model = { outputType, nodeValue: 0, watchedValues: {}, setTilt: () => undefined };
  node.services = {
    inTick: false,
    stores: { appConfig: { getSetting: (key: string, group?: string) =>
      group === "dataflow" ? settings[key] : undefined } },
  };
  node.saveNodeValue = (v: number) => { node.model.nodeValue = v; };
  return node;
}

function drive(node: any, value: number) {
  node.data({ nodeValue: [value] });
  return node.model.nodeValue;
}

// The helper-only tests in utilities/servo.test.ts never ran through data(), which is where every
// non-binary output used to be clamped to 0-1 -- turning any angle a student types into 1 degree.
describe("DemoOutputNode.data Servo handling", () => {
  it("keeps degrees in degrees mode, which is the default", () => {
    expect(drive(stubbedNode("Servo"), 90)).toBe(90);
    expect(drive(stubbedNode("Servo"), 180)).toBe(180);
    expect(drive(stubbedNode("Servo"), 47)).toBe(47);
  });

  it("clamps an angle past either end", () => {
    expect(drive(stubbedNode("Servo"), 400)).toBe(180);
    expect(drive(stubbedNode("Servo"), -20)).toBe(0);
  });

  it("scales 0-1 across the sweep in proportion mode", () => {
    const proportion = { servoInputMode: "proportion" };
    expect(drive(stubbedNode("Servo", proportion), 0)).toBe(0);
    expect(drive(stubbedNode("Servo", proportion), 0.5)).toBe(90);
    expect(drive(stubbedNode("Servo", proportion), 1)).toBe(180);
  });

  it("still clamps the other outputs to 0-1", () => {
    expect(drive(stubbedNode("Grabber"), 90)).toBe(1);
    expect(drive(stubbedNode("Grabber"), 0.5)).toBe(0.5);
  });

  it("still reduces a binary output to on or off", () => {
    expect(drive(stubbedNode("Light Bulb"), 90)).toBe(1);
    expect(drive(stubbedNode("Light Bulb"), 0)).toBe(0);
  });
});

// The readout is an instance arrow property, so it needs a real node rather than the Object.create
// stub above, and a real MST model for the isAlive guard it opens with.
function realNode(outputType: string, settings: Record<string, any> = {}) {
  const model: any = DemoOutputNodeModel.create({ type: "Demo Output", outputType });
  // nodeValue lives in the entry for the program's current tick. With no program there is no
  // tick, so make the entry under the empty key `currentTick` falls back to.
  model.createNextTickEntry(undefined, "");
  const services: any = {
    inTick: false,
    stores: { appConfig: { getSetting: (key: string, group?: string) =>
      group === "dataflow" ? settings[key] : undefined } },
    update: () => undefined,
  };
  return new DemoOutputNode("demo", model, services);
}

describe("DemoOutputNode.getNodeValueDisplayMessage", () => {
  const read = (node: any) => node.getNodeValueDisplayMessage();

  // A Servo used to fall through to the gripper's formatter and read "50% closed" at half sweep.
  it("reads a Servo in degrees by default", () => {
    const node = realNode("Servo");
    drive(node, 90);
    expect(read(node)).toBe("90°");
  });

  it("reads a Servo as % rotation in proportion mode", () => {
    const node = realNode("Servo", { servoInputMode: "proportion" });
    drive(node, 0.5);
    expect(read(node)).toBe("50% rotation");
  });

  it("still reads a gripper as % closed", () => {
    const node = realNode("Grabber");
    drive(node, 0.5);
    expect(read(node)).toBe("50% closed");
  });

  it("still reads a binary output as on or off", () => {
    const node = realNode("Light Bulb");
    drive(node, 1);
    expect(read(node)).toBe("on");
  });
});

describe("DemoOutputNode.getPlotScale", () => {
  const scaleOf = (type: string, settings?: Record<string, unknown>) =>
    stubbedNode(type as any, settings as any).getPlotScale("nodeValue");

  it("graphs a Servo in % rotation over a 0-100 axis in proportion mode", () => {
    const scale = scaleOf("Servo", { servoInputMode: "proportion" });
    expect(scale?.toPlot?.(90)).toBe(50);
    expect(scale).toMatchObject({ min: 0, max: 100 });
  });

  it("graphs a Servo over its full travel in degrees mode", () => {
    expect(scaleOf("Servo")).toMatchObject({ min: 0, max: 180 });
    expect(scaleOf("Servo")?.toPlot).toBeUndefined();
  });

  // The demo Gripper stores the 0-1 fraction GrabberAnimation takes, unlike the live Gripper,
  // which stores a percentage. Both graph as a percentage, as both fields read.
  it("graphs a Gripper as a percentage of the 0-1 fraction it stores", () => {
    const scale = scaleOf("Grabber");
    expect(scale?.toPlot?.(0.5)).toBe(50);
    expect(scale).toMatchObject({ min: 0, max: 100 });
  });

  it("graphs a binary output over 0-1", () => {
    expect(scaleOf("Light Bulb")).toMatchObject({ min: 0, max: 1 });
  });

  // The axis belongs to the position, which is what the block's field reads out. Tilt declares
  // nothing, so it is drawn on that axis rather than claiming it.
  it("graphs the Advanced Gripper's position as a percentage, like the plain Gripper", () => {
    const scale = scaleOf("Advanced Grabber");
    expect(scale?.toPlot?.(0.5)).toBe(50);
    expect(scale).toMatchObject({ min: 0, max: 100 });
  });

  it("declares nothing for the tilt series", () => {
    expect(stubbedNode("Advanced Grabber" as any).getPlotScale("tilt")).toBeUndefined();
  });
});
