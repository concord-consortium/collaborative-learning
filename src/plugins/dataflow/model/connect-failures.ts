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
  // The attempt it ended or came from, so a stall counts only while that attempt holds its device.
  attemptId: string;
  kind: FailureKind;
  choice: DeviceChoice;
  step: AttemptStep;
  elapsedMs: number;
  error?: IErrorInfo;
}

export interface IHelpTry {
  stillNotWorking: boolean;
  text: string;
}

const kMaxErrorMessageLength = 300;

export const kHelpSuccessLine = "Try these in order. When it works, the connect button turns green.";

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
const kPaletteProblemTexts: Record<ProblemKind, string> = {
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

// The second line of the connect palette, which follows it with Help.
export function paletteProblemText(kind: ProblemKind) {
  return kPaletteProblemTexts[kind];
}

// The Connection help's headline, and the sentence announced when a failure is recorded while the
// connect palette is closed. Unlike the palette's short text, it names the device.
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

const first = (text: string): IHelpTry => ({ stillNotWorking: false, text });
const then = (text: string): IHelpTry => ({ stillNotWorking: true, text });

export function helpTries(kind: ProblemKind, choice: DeviceChoice): IHelpTry[] {
  const label = kDeviceChoiceLabels[choice];
  const board = choice === "arduino" ? label : "micro:bit";
  const replug = `Unplug the ${label}, plug it back in, and click Connect.`;
  const reload = "Reload this page, then click Connect.";
  switch (kind) {
    case "openTimeout":
    case "openFailed":
      return [first(replug), then(reload)];
    case "inUse":
      return [
        first(`Close other tabs that are using the ${board}, such as MakeCode. `
          + `Then unplug the ${label}, plug it back in, and click Connect.`),
        then(reload)
      ];
    case "updateFailed":
    case "updateStalled":
      return [first(`${replug} The update starts over.`), then(reload)];
    case "notResponding":
    case "noAnswer":
      return [
        first("Click Reconnect."),
        then("Click Is it alive? If the heart blinks on the board, another tab is reading it. "
          + "Close that tab, then click Reconnect."),
        then(replug)
      ];
    case "noData":
      return [
        first("Click Reconnect."),
        then(replug),
        then(`The ${label} may not have CLUE's program on it. Ask your teacher.`)
      ];
    case "lost":
      return [first("Click Connect."), then(replug)];
  }
}

// A short technical blurb a student or teacher could search for.
export function failureDetails({ kind, step, elapsedMs, error }: IConnectFailure) {
  const parts = [`Step: ${step}.`];
  if (error && (error.code || error.name || error.message)) {
    const id = error.code ?? error.name;
    parts.push(id && error.message ? `${id}: ${error.message}` : (id ?? error.message ?? ""));
  } else if (kind === "openTimeout") {
    parts.push(`Didn't finish within ${Math.round(elapsedMs / 1000)} s.`);
  } else if (kStallKinds.includes(kind)) {
    parts.push(`Nothing for ${Math.round(elapsedMs / 1000)} s.`);
  }
  return parts.join(" ");
}

// The details for help on a kind: the failure's, when it is that kind. A problem found after the
// connection was made has no failure, so its details say what was noticed.
export function helpDetails(kind: ProblemKind, failure: IConnectFailure | undefined) {
  if (failure?.kind === kind) return failureDetails(failure);
  switch (kind) {
    case "lost": return "After connecting. The connection closed without an unplug.";
    case "noAnswer": return "After connecting. No answer to the identify check.";
    case "notResponding": return "After connecting. No replies to its pings.";
    default: return `After connecting. ${paletteProblemText(kind)}`;
  }
}

// Whether two kinds give a device the same headline and tries, so a change from one to the other
// leaves the help as true as it was.
export function sameHelp(a: ProblemKind, b: ProblemKind, choice: DeviceChoice) {
  const text = (kind: ProblemKind) =>
    [problemHeadline(kind, choice), ...helpTries(kind, choice).map(t => t.text)].join("\n");
  return text(a) === text(b);
}
