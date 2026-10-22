export type ConnectButtonState = "idle" | "connected" | "attention";

export function connectButtonState(o: {
  connected: boolean; needsDevice: boolean; unseenError: boolean;
}): ConnectButtonState {
  if (o.connected) return "connected";
  return o.needsDevice || o.unseenError ? "attention" : "idle";
}

export function connectButtonTooltip(o: {
  connected: boolean; connectedLabel?: string; needsDevice: boolean; unseenError: boolean;
}): string {
  switch (connectButtonState(o)) {
    case "connected": return `Connected: ${o.connectedLabel}`;
    case "attention":
      return o.unseenError
        ? "Couldn't connect. Click for details."
        : "This program needs a device. Click to connect.";
    default: return "Connect a device";
  }
}
