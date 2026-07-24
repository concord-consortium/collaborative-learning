import { outputGateState, unsupportedOutputOption } from "./node";

describe("output gating helpers", () => {
  it("resolves the three gate states", () => {
    // connected + supported -> live
    expect(outputGateState(true, "spikerbit", "servo")).toBe("live");
    expect(outputGateState(true, "arduino", "gripper")).toBe("live");
    expect(outputGateState(true, "microbit", "relay")).toBe("live");
    // connected + unsupported -> unsupported
    expect(outputGateState(true, "spikerbit", "gripper")).toBe("unsupported");
    expect(outputGateState(true, "microbit", "servo")).toBe("unsupported");
    // not connected -> no-device (regardless of family)
    expect(outputGateState(false, undefined, "servo")).toBe("no-device");
    expect(outputGateState(false, "arduino", "servo")).toBe("no-device");
  });

  it("builds an unsupported option that names the connected device", () => {
    const opt = unsupportedOutputOption("gripper", "Spiker:bit");
    expect(opt.name).toBe("Physical Gripper");   // stable selection value
    expect(opt.displayName).toContain("Spiker:bit");
    expect(opt.displayName).toContain("⚠️");
  });

  it("falls back to a generic label when no device name is given", () => {
    const opt = unsupportedOutputOption("servo");
    expect(opt.name).toBe("Physical Servo");
    expect(opt.displayName).toContain("⚠️");
  });
});
