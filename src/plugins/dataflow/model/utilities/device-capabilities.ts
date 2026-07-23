import { NodeChannelInfo } from "./channel";

// The wire protocol a device speaks (which parser/formatter applies).
export type DeviceProtocol = "arduino" | "microbit";

// The categories of live output a device can drive.
export type OutputCategory = "gripper" | "servo" | "relay";

export interface DeviceCapability {
  protocol: DeviceProtocol;
  displayName: string;
  outputs: OutputCategory[];
}

// Keyed by device IDENTITY (SerialDevice.deviceFamily), distinct from a channel's
// deviceFamily, which is a protocol tag. See the design spec §3.2.
export const kDeviceCapabilities: Record<string, DeviceCapability> = {
  arduino:   { protocol: "arduino",  displayName: "Arduino",    outputs: ["gripper", "servo"] },
  microbit:  { protocol: "microbit", displayName: "micro:bit",  outputs: ["relay"] },
  spikerbit: { protocol: "arduino",  displayName: "Spiker:bit", outputs: ["servo"] },
};

export function deviceProtocol(deviceFamily: string | undefined): DeviceProtocol | undefined {
  return deviceFamily ? kDeviceCapabilities[deviceFamily]?.protocol : undefined;
}

export function deviceDisplayName(deviceFamily: string | undefined): string | undefined {
  return deviceFamily ? kDeviceCapabilities[deviceFamily]?.displayName : undefined;
}

// A connected device satisfies a channel when it speaks the channel's protocol.
export function channelSatisfiedBy(deviceFamily: string | undefined, channel: NodeChannelInfo): boolean {
  const protocol = deviceProtocol(deviceFamily);
  return protocol != null && protocol === channel.deviceFamily;
}

export function deviceSupportsOutput(deviceFamily: string | undefined, category: OutputCategory): boolean {
  const cap = deviceFamily ? kDeviceCapabilities[deviceFamily] : undefined;
  return !!cap && cap.outputs.includes(category);
}
