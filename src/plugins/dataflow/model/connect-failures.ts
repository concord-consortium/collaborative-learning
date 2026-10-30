// The ways a hardware connection attempt can fail, and the student-facing text for each. This is
// separate from device-connection.ts so it doesn't pull in the Spiker:bit firmware hex.

// The device choices, in the order the UI lists them. The type is derived from this list, so a
// new choice can't be left out of it.
export const kDeviceChoiceOrder = ["arduino", "microbitHub", "spikerbit"] as const;

export type DeviceChoice = typeof kDeviceChoiceOrder[number];

export const kDeviceChoiceLabels: Record<DeviceChoice, string> = {
  arduino: "Arduino",
  microbitHub: "micro:bit (radio hub)",
  spikerbit: "Spiker:bit"
};

export type AttemptStep = "choose" | "open" | "checkFirmware" | "update" | "waitForData";

export type FailureKind = "openTimeout" | "openFailed" | "inUse" | "updateFailed"
  | "updateStalled" | "notResponding" | "noData";

// A failure kind or a problem that shows up after a connection was made.
export type ProblemKind = FailureKind | "lost" | "noAnswer";

export type AttemptOutcome = "connected" | "canceled" | FailureKind | "unplugged" | "lost";

// The failures where the device is still open but has gone quiet.
export const kStallKinds: readonly FailureKind[] = ["updateStalled", "notResponding", "noData"];

export interface IErrorInfo { name?: string; code?: string; message?: string }

export interface IConnectFailure {
  kind: FailureKind;
  choice: DeviceChoice;
  step: AttemptStep;
  elapsedMs: number;
  error?: IErrorInfo;
}

const kMaxErrorMessageLength = 300;

export function errorInfo(e: unknown): IErrorInfo | undefined {
  if (e == null) return undefined;
  if (typeof e !== "object") return { message: String(e).slice(0, kMaxErrorMessageLength) };
  const { name, code, message } = e as Record<string, unknown>;
  const info: IErrorInfo = {};
  if (typeof name === "string") info.name = name;
  if (typeof code === "string") info.code = code;
  if (typeof message === "string") info.message = message.slice(0, kMaxErrorMessageLength);
  return info;
}

// Short, and never naming the device, so each fits on the palette's second line (see "The status
// area" in docs/connect-palette.md).
const kPaneProblemTexts: Record<ProblemKind, string> = {
  openTimeout: "Stuck while opening.",
  openFailed: "Couldn't open it.",
  inUse: "In use by another tab.",
  updateFailed: "The update failed.",
  updateStalled: "Update stalled.",
  notResponding: "Not responding.",
  noData: "No data yet.",
  lost: "Connection lost.",
  noAnswer: "No answer."
};

// The second line of the connect pane.
export function paneProblemText(kind: ProblemKind) {
  return kPaneProblemTexts[kind];
}

// The sentence announced when a failure is recorded while the connect pane is closed. Unlike the
// pane's short text, it names the device.
export function problemHeadline(kind: ProblemKind, choice: DeviceChoice) {
  const label = kDeviceChoiceLabels[choice];
  switch (kind) {
    case "openTimeout":
    case "openFailed":
      return `The browser couldn't open the ${label}.`;
    case "inUse":
      return `Another tab or app is using the ${label}.`;
    case "updateFailed":
      return "The firmware update didn't finish.";
    case "updateStalled":
      return "The firmware update stopped.";
    case "notResponding":
    case "noData":
    case "noAnswer":
      return `The ${label} isn't sending anything.`;
    case "lost":
      return `The connection to the ${label} was lost.`;
  }
}
