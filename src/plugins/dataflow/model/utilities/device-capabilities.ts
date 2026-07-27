import { NodeChannelInfo } from "./channel";

// The wire protocol a device speaks (which parser/formatter applies). Named for the
// wire format, not the hardware: "keyValue" is labeled `channelId:number` lines (spoken
// by the Arduino and the Spiker:bit); "radioHub" is the multi-hub radio framing (spoken
// by the radio-hub micro:bit).
export type DeviceProtocol = "keyValue" | "radioHub";

// The categories of live output a device can drive.
export type OutputCategory = "gripper" | "servo" | "relay";

export interface DeviceCapability {
  protocol: DeviceProtocol;
  displayName: string;
  outputs: OutputCategory[];
}

// Keyed by device IDENTITY (SerialDevice.deviceFamily), distinct from a channel's
// protocol tag (channel.protocol). See the design spec §3.2.
export const kDeviceCapabilities: Record<string, DeviceCapability> = {
  arduino:   { protocol: "keyValue", displayName: "Arduino",    outputs: ["gripper", "servo"] },
  microbit:  { protocol: "radioHub", displayName: "micro:bit",  outputs: ["relay"] },
  spikerbit: { protocol: "keyValue", displayName: "Spiker:bit", outputs: ["servo"] },
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
  return protocol != null && protocol === channel.protocol;
}

export function deviceSupportsOutput(deviceFamily: string | undefined, category: OutputCategory): boolean {
  const cap = deviceFamily ? kDeviceCapabilities[deviceFamily] : undefined;
  return !!cap && cap.outputs.includes(category);
}
