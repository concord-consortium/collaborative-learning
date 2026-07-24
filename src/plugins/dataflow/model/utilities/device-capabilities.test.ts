import { NodeChannelInfo } from "./channel";
import {
  deviceProtocol, deviceDisplayName, channelSatisfiedBy, deviceSupportsOutput
} from "./device-capabilities";

const arduinoChannel = { deviceFamily: "arduino" } as NodeChannelInfo;
const microbitChannel = { deviceFamily: "microbit" } as NodeChannelInfo;

describe("device-capabilities", () => {
  it("maps device identity to protocol", () => {
    expect(deviceProtocol("arduino")).toBe("arduino");
    expect(deviceProtocol("spikerbit")).toBe("arduino");
    expect(deviceProtocol("microbit")).toBe("microbit");
    expect(deviceProtocol(undefined)).toBeUndefined();
    expect(deviceProtocol("nonsense")).toBeUndefined();
  });

  it("maps device identity to a display name", () => {
    expect(deviceDisplayName("spikerbit")).toBe("Spiker:bit");
    expect(deviceDisplayName(undefined)).toBeUndefined();
  });

  it("satisfies a channel when the device protocol matches the channel protocol tag", () => {
    expect(channelSatisfiedBy("arduino", arduinoChannel)).toBe(true);
    expect(channelSatisfiedBy("spikerbit", arduinoChannel)).toBe(true);
    expect(channelSatisfiedBy("microbit", arduinoChannel)).toBe(false);
    expect(channelSatisfiedBy("spikerbit", microbitChannel)).toBe(false);
    expect(channelSatisfiedBy(undefined, arduinoChannel)).toBe(false);
  });

  it("reports per-device output support", () => {
    expect(deviceSupportsOutput("arduino", "gripper")).toBe(true);
    expect(deviceSupportsOutput("arduino", "servo")).toBe(true);
    expect(deviceSupportsOutput("spikerbit", "servo")).toBe(true);
    expect(deviceSupportsOutput("spikerbit", "gripper")).toBe(false);
    expect(deviceSupportsOutput("microbit", "relay")).toBe(true);
    expect(deviceSupportsOutput("microbit", "servo")).toBe(false);
    expect(deviceSupportsOutput(undefined, "servo")).toBe(false);
  });
});
