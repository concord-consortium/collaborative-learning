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

interface IConnectButtonInput {
  connected: boolean;
  needsDevice: boolean;
  unseenError: boolean;
  // Connected, but the board isn't answering, or another host owns its session.
  notResponding: boolean;
}

export function connectButtonState(o: IConnectButtonInput): ConnectButtonState {
  if (o.connected) return o.notResponding ? "attention" : "connected";
  return o.needsDevice || o.unseenError ? "attention" : "idle";
}

export function notRespondingMessage(label: string | undefined): string {
  return `The ${label} is not responding.`;
}

export function connectButtonTooltip(o: IConnectButtonInput & { connectedLabel?: string }): string {
  switch (connectButtonState(o)) {
    case "connected": return `Connected: ${o.connectedLabel}`;
    case "attention":
      if (o.connected) return `${notRespondingMessage(o.connectedLabel)} Click for details.`;
      return o.unseenError
        ? "Couldn't connect. Click for details."
        : "This program needs a device. Click to connect.";
    default: return "Connect a device";
  }
}
