import { ConnectionAttempt } from "../model/connection-attempt";
import {
  IConnectFailure, kDeviceChoiceLabels, kStallKinds, paneProblemText, ProblemKind
} from "../model/connect-failures";
import { DeviceConnection, IdentifyCheckState } from "../model/device-connection";
import { DeviceLoss } from "../../../models/stores/device-transport";

export type PaneLineTone = "plain" | "hint" | "problem";

export interface IPaneStatus {
  line1: string;
  // `progress` (0-100) draws the progress bar. `helpKind` marks a line the component follows with
  // a "More…" link.
  line2?: { text: string; tone: PaneLineTone; helpKind?: ProblemKind; progress?: number };
  // Whether line 2 belongs in the live region: problems only.
  announce: boolean;
}

export interface IPaneStatusInput {
  attempt: ConnectionAttempt | undefined;
  isConnected: boolean;
  dataReceived: boolean;
  label: string | undefined;
  failure: IConnectFailure | undefined;
  loss: DeviceLoss | undefined;
  notResponding: boolean;
  check: IdentifyCheckState | undefined;
  // A stalled update is making progress again, so its ended attempt shows as if it still ran.
  updateResumed: boolean;
}

// The status of the shared connection, showing `failure`: the tile's in its pane, or the
// connection's own in the Connection help. A stall's failure shows only while its device is open.
export function connectionStatusInput(
  connection: DeviceConnection, failure: IConnectFailure | undefined
): IPaneStatusInput {
  return {
    attempt: connection.attempt,
    isConnected: connection.isConnected,
    dataReceived: connection.dataReceived,
    label: connection.label,
    failure: connection.currentFailure(failure),
    loss: connection.lossReason,
    notResponding: connection.notResponding,
    check: connection.check,
    updateResumed: connection.updateResumed
  };
}

type Line2 = NonNullable<IPaneStatus["line2"]>;

const status = (line1: string, line2?: Line2): IPaneStatus =>
  ({ line1, line2, announce: line2?.tone === "problem" });

const problem = (kind: ProblemKind): Line2 => ({ text: paneProblemText(kind), tone: "problem", helpKind: kind });

export function connectPaneStatus(input: IPaneStatusInput): IPaneStatus {
  const { attempt, isConnected, dataReceived, label, failure, loss, notResponding, check, updateResumed } = input;
  const connected = `Connected: ${label}`;
  const notConnected = "Not connected";

  // A running attempt names its own device. The connection's label is still the one used before.
  if (attempt && (!attempt.ended || updateResumed)) {
    const attemptLabel = kDeviceChoiceLabels[attempt.choice];
    const connecting = `Connecting to ${attemptLabel}…`;
    const attemptConnected = `Connected: ${attemptLabel}`;
    switch (attempt.step) {
      case "choose":
        return status(connecting, { text: "Choose it in the browser's list.", tone: "hint" });
      case "open":
        return status(connecting, { text: "Opening the connection…", tone: "plain" });
      case "checkFirmware":
        return status(attemptConnected, { text: "Checking its firmware…", tone: "plain" });
      case "update": {
        // The one first line that isn't the phase: keeping the board plugged in matters more.
        const percent = attempt.updatePercent ?? 0;
        return status("Updating. Keep it plugged in.", { text: `${percent}%`, tone: "plain", progress: percent });
      }
      case "waitForData":
        return status(attemptConnected, { text: "Waiting for data…", tone: "plain" });
    }
  }

  if (check === "checking") return status(connected, { text: "Look for the heart…", tone: "plain" });
  if (check === "answered") return status(connected, { text: "It answered.", tone: "plain" });
  if (check === "noAnswer") return status(connected, problem("noAnswer"));

  if (loss === "unplugged") return status(notConnected, { text: "It was unplugged.", tone: "problem" });
  if (loss === "lost") return status(notConnected, problem("lost"));

  if (failure) {
    return status(kStallKinds.includes(failure.kind) ? connected : notConnected, problem(failure.kind));
  }
  if (isConnected && notResponding) return status(connected, problem("notResponding"));
  if (isConnected) {
    return status(connected, dataReceived
      ? { text: "Receiving data.", tone: "hint" }
      : { text: "Waiting for data…", tone: "plain" });
  }
  return status(notConnected, { text: "Plug in a device, then click Connect.", tone: "hint" });
}
