import { FailureKind } from "../model/connect-failures";

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
  // A stall failure (no data, not responding, update stalled) while the device is still open.
  stalled: boolean;
  // The connected device has sent something.
  dataReceived: boolean;
}

export function connectButtonState(o: IConnectButtonInput): ConnectButtonState {
  // A stall can leave the device open but not active, so it counts whether or not `connected`.
  if (o.stalled) return "attention";
  if (o.connected) {
    if (o.notResponding) return "attention";
    return o.dataReceived ? "connected" : "idle";
  }
  return o.needsDevice || o.unseenError ? "attention" : "idle";
}

export function notRespondingMessage(label: string | undefined): string {
  return `The ${label} is not responding.`;
}

interface IConnectButtonTooltipInput extends IConnectButtonInput {
  connectedLabel?: string;
  // The label of the device being connected to, while an attempt is running.
  connecting?: string;
  // Which stall `stalled` is, so the tooltip can say what stopped.
  stallKind?: FailureKind;
  // Why the last device went away, while that loss is kept. Leads the not-connected text, so the
  // button still says so once its pulses end.
  lossMessage?: string;
}

export function connectButtonTooltip(o: IConnectButtonTooltipInput): string {
  if (o.connecting) return `Connecting to ${o.connecting}…`;
  const loss = o.lossMessage ? `${o.lossMessage} ` : "";
  switch (connectButtonState(o)) {
    case "connected": return `Connected: ${o.connectedLabel}`;
    case "attention":
      if (o.stalled && o.stallKind === "updateStalled") {
        return `${o.connectedLabel}: the update stalled. Click for details.`;
      }
      if (o.stalled && !o.notResponding) return `${o.connectedLabel}: no data yet. Click for details.`;
      if (o.connected) return `${notRespondingMessage(o.connectedLabel)} Click for details.`;
      return o.unseenError
        ? "Couldn't connect. Click for details."
        : `${loss}This program needs a device. Click to connect.`;
    default: return o.lossMessage ? `${loss}Click to connect.` : "Connect a device";
  }
}
