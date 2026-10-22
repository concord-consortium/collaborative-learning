export type ConnectButtonState = "idle" | "connected" | "attention";

/**
 * Whether the DataFlow tile toolbar shows the `connect` button, given the configured
 * `settings.dataflow.tools` value. The toolbar renders only the buttons in that list, so a unit
 * with its own list that leaves out `connect` gets the older connect button at the top of the
 * tile instead.
 */
export function toolbarShowsConnect(tools: unknown): boolean {
  return Array.isArray(tools) && tools.includes("connect");
}

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
