import { ConnectionAttempt } from "../model/connection-attempt";
import {
  HelpKind, IConnectFailure, kDeviceChoiceLabels, kStallKinds, paneProblemText
} from "../model/connect-failures";
import { IdentifyCheckState } from "../model/device-connection";
import { DeviceLoss } from "../../../models/stores/device-transport";

export type PaneLineTone = "plain" | "hint" | "problem";

export interface IPaneStatus {
  line1: string;
  // `progress` (0-100) draws the progress bar. `helpKind` marks a line the component follows with
  // a "More…" link.
  line2?: { text: string; tone: PaneLineTone; helpKind?: HelpKind; progress?: number };
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
}

type Line2 = NonNullable<IPaneStatus["line2"]>;

const status = (line1: string, line2?: Line2): IPaneStatus =>
  ({ line1, line2, announce: line2?.tone === "problem" });

const problem = (kind: HelpKind): Line2 => ({ text: paneProblemText(kind), tone: "problem", helpKind: kind });

export function connectPaneStatus(input: IPaneStatusInput): IPaneStatus {
  const { attempt, isConnected, dataReceived, label, failure, loss, notResponding, check } = input;
  const connected = `Connected: ${label}`;
  const notConnected = "Not connected";

  if (attempt && !attempt.ended) {
    const connecting = `Connecting to ${label ?? kDeviceChoiceLabels[attempt.choice]}…`;
    switch (attempt.step) {
      case "choose":
        return status(connecting, { text: "Choose it in the browser's list.", tone: "hint" });
      case "open":
        return status(connecting, { text: "Opening the connection…", tone: "plain" });
      case "checkFirmware":
        return status(connected, { text: "Checking its firmware…", tone: "plain" });
      case "update": {
        const percent = attempt.updatePercent ?? 0;
        return status("Updating. Keep it plugged in.", { text: `${percent}%`, tone: "plain", progress: percent });
      }
      case "waitForData":
        return status(connected, { text: "Waiting for data…", tone: "plain" });
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
