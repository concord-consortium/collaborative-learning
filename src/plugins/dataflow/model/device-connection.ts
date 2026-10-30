// This lives in the DataFlow plugin, not src/models/stores, because it imports the Spiker:bit
// firmware hex, which has to stay in the DataFlow chunk.
import { makeAutoObservable, observable, reaction, runInAction, when } from "mobx";
import { SerialDevice } from "../../../models/stores/serial";
import { CcDeviceSession, IdentifyResult } from "../../../models/stores/cc-device-session";
import { DeviceLoss, IAbandonedOpenInfo, IDeviceTransport } from "../../../models/stores/device-transport";
import { FirmwareReply } from "../../../models/stores/serial-protocol";
import { ISpikerbitConnectObserver, SpikerbitDevice } from "../../../models/stores/spikerbit-device";
import {
  createSpikerbitConnection, makeSpikerbitFlashDataSource
} from "../../../models/stores/spikerbit-connection";
import { WebSerialOpenResult, WebSerialTransport } from "../../../models/stores/web-serial-transport";
import spikerbitHex from "../firmware/spikerbit-clue.hex";
import {
  AttemptOutcome, AttemptStep, DeviceChoice, errorInfo, FailureKind, HelpKind, helpDetails, IConnectFailure,
  kDeviceChoiceLabels, kStallKinds, sameHelp
} from "./connect-failures";
import { AttemptTrigger, AttemptView, ConnectionAttempt } from "./connection-attempt";

export { kDeviceChoiceOrder, kDeviceChoiceLabels } from "./connect-failures";
export type { DeviceChoice } from "./connect-failures";

// How long disconnect waits for the board to take the `close` write before closing the transport
// anyway. A write to a stalled port may never settle.
export const kEndSessionTimeoutMs = 500;

// How long the answer to "Is it alive?" stays before the check is cleared.
export const kIdentifyResultMs = 3000;

// An "Is it alive?" check: waiting for the board, or its answer.
export type IdentifyCheckState = "checking" | IdentifyResult;

interface IIdentifyCheck {
  session: CcDeviceSession;
  state: IdentifyCheckState;
}

// How long the open may take before the attempt ends as openTimeout.
export const kOpenTimeoutMs = 20000;

// How long the device may take to send its first data, from when it becomes the active device,
// before the attempt ends as noData, or notResponding for a Spiker:bit.
export const kFirstDataTimeoutMs = 5000;

// How long a firmware update may take to report its first progress before the attempt ends as
// updateStalled. Before writing its first page, the library halts the board, fills DAPLink's
// serial buffers on the first flash after the board is plugged in, resets it and reads its page
// checksums, all without reporting progress. That took about 25 s on a Chromebook.
export const kUpdateStartMs = 45000;

// How long a firmware update may go between progress reports before it counts as stalled. A page
// took about 8 s on a Chromebook.
export const kUpdateStallMs = 20000;

export type ConnectResult = AttemptOutcome;

// Why a device the attempt left open went away: a loss, or the failed flash of a stalled update.
export type AttemptLoss = DeviceLoss | "updateFailed";

// What a caller of connect or reconnect hears about its attempt besides the outcome.
export interface IAttemptListener {
  // Called as the promise from connect or reconnect resolves.
  onEnded?(attempt: ConnectionAttempt): void;
  // The first data arrived after a stall ended the attempt.
  onRecovered?(attempt: ConnectionAttempt): void;
  // After a stall ended the attempt, the stall changed: a stalled update finished, so it no longer
  // stalls (undefined), or the board it then made active sent no data in time (that failure).
  onStallChanged?(attempt: ConnectionAttempt, failure: IConnectFailure | undefined): void;
  // An open the attempt gave up on was closed and forgotten, or settled late.
  onAbandonedOpen?(attempt: ConnectionAttempt, info: IAbandonedOpenInfo): void;
  // The device went away without being asked to, after the attempt had ended with it open. For
  // "updateFailed", `lastFailure` is that failure.
  onLost?(attempt: ConnectionAttempt, reason: AttemptLoss): void;
}

export interface IAttemptOptions {
  attemptId?: string;
  listener?: IAttemptListener;
}

// The attempt DeviceConnection follows: the latest one, until a newer attempt or a Disconnect.
interface IFollowedAttempt {
  attempt: ConnectionAttempt;
  listener?: IAttemptListener;
  resolve(outcome: ConnectResult): void;
  // The running step's limit: the update's no-progress limit or the wait for the first data.
  timer?: ReturnType<typeof setTimeout>;
  // Stop watching the attempt's active device.
  disposers: Array<() => void>;
}

// How one way of opening a device didn't work out.
interface IOpenFailure {
  outcome: AttemptOutcome;
  error?: unknown;
}

// What the Connection help is about. `tileId` is the tile it was opened from, which its log events
// name; the help itself follows the connection, so it outlives that tile.
export interface IHelpTopic {
  kind: HelpKind;
  choice: DeviceChoice;
  details: string;
  tileId: string;
}

// What the help's notices follow: a problem, "working" once data is arriving, a stalled update
// that is making progress again, or a device that was unplugged or isn't connected, which has no
// help of its own.
export type HelpState = HelpKind | "working" | "updating" | "unplugged" | "notConnected";

// What has changed since the help's topic was shown: the device works now, its update is going
// again, it has a problem with other help, or it is no longer connected.
export type HelpNotice =
  { type: "working" | "updating" | "unplugged" | "notConnected" }
  | { type: "differentProblem"; topic: IHelpTopic };

// The Connection help's state, kept here rather than in its component, which unmounts while Ada's
// tab is selected.
export interface IConnectionHelp {
  shown: IHelpTopic;
  notice: HelpNotice | undefined;
  detailsExpanded: boolean;
}

export interface IHelpListener {
  // A notice appeared.
  onNotice?(notice: HelpNotice): void;
}

// What dismissed the connect tutorial: OK in one tile, or any connection.
export type ConnectTutorialDismissal = { by: "ok", tileId: string } | { by: "connection" };

export interface IDeviceConnectionDeps {
  createWebSerialTransport(): WebSerialTransport;
  createSpikerbitDevice(serialDevice: SerialDevice): SpikerbitDevice;
  getSpikerbitFlashDataSource(): unknown;
}

const kNoDeviceSelected = "no-device-selected";

const kDeviceInUse = "device-in-use";

const kOpenTimeout = "open-timeout";

// The code of the error @microbit/microbit-connection throws when its own time limit passes.
const kLibraryTimeout = "timeout";

function errorCode(error: unknown) {
  return (error as { code?: string } | null)?.code;
}

function isFailureKind(outcome: AttemptOutcome): outcome is FailureKind {
  return outcome !== "connected" && outcome !== "canceled" && outcome !== "lost" && outcome !== "unplugged";
}

function webSerialOutcome(result: Exclude<WebSerialOpenResult, "opened">): AttemptOutcome {
  switch (result) {
    case "canceled": return "canceled";
    case "failed": return "openFailed";
    // "stillOpening" is a retry refused because the browser is still opening the port for an
    // earlier attempt. Unplugging the board is the fix for both.
    case "timeout":
    case "stillOpening": return "openTimeout";
  }
}

// The firmware a Spiker:bit answered with, as the log records it.
function describeFirmware(reply: FirmwareReply | null) {
  if (!reply) return null;
  return reply.kind === "legacy"
    ? `legacy v${reply.firmware}`
    : `device:${reply.hello.device} firmware:${reply.hello.firmware}`;
}

/**
 * The one device connection shared by every DataFlow tile. It owns connect, reconnect and
 * disconnect. Tiles start them through the tile device actions in `device-actions.ts`.
 */
export class DeviceConnection {
  // The device choice the user last connected with. Reconnect repeats it, and the log events name
  // the device by it.
  lastChoice: DeviceChoice | undefined = undefined;
  // Set from the click until the attempt ends, which a stall also does.
  busyChoice: DeviceChoice | undefined = undefined;
  // The latest connect or reconnect attempt.
  attempt: ConnectionAttempt | undefined = undefined;
  // The latest attempt's failure. The next attempt clears it, and so do a Disconnect, first data
  // after a stall, and the loss of the device a stall left open.
  lastFailure: IConnectFailure | undefined = undefined;
  // What first dismissed the connect tutorial, which then stays dismissed on every tile. In memory
  // only, so it can show again after a page reload.
  connectTutorialDismissal: ConnectTutorialDismissal | undefined = undefined;
  // The Connection help, while it is open.
  help: IConnectionHelp | undefined = undefined;

  private serialDevice: SerialDevice;
  private deps: IDeviceConnectionDeps;
  private lastWebSerialTransport: WebSerialTransport | undefined;
  // The Spiker:bit from the last Spiker:bit attempt, cleared when an attempt fails. Its library
  // connection remembers the board, so Reconnect reopens it without the chooser. Connect
  // replaces it with a fresh one, which shows the chooser.
  private spikerbitDevice: SpikerbitDevice | undefined;
  // The latest "Is it alive?" check, with the CcDeviceSession it asked. It counts only while that
  // object is the active one, so a reconnect or a new device never shows an earlier board's answer.
  private identifyCheck: IIdentifyCheck | undefined = undefined;
  // A Spiker:bit whose update stalled. It is open but not active. The update may still finish, so
  // the attempt keeps it until then, or until a Disconnect, Connect or Reconnect disposes it.
  private stalledSpikerbit: SpikerbitDevice | undefined = undefined;
  private followed: IFollowedAttempt | undefined = undefined;
  private helpListener: IHelpListener | undefined = undefined;
  // Set when the help opens, until its panel moves focus to its heading. Showing the panel again
  // after Ada's tab leaves focus where it is.
  private helpFocusRequested = false;

  constructor(serialDevice: SerialDevice, deps?: Partial<IDeviceConnectionDeps>) {
    this.serialDevice = serialDevice;
    this.deps = {
      createWebSerialTransport: () => new WebSerialTransport(),
      createSpikerbitDevice: (device) =>
        new SpikerbitDevice(device, createSpikerbitConnection(), { openTimeoutMs: kOpenTimeoutMs }),
      getSpikerbitFlashDataSource: () => makeSpikerbitFlashDataSource(spikerbitHex),
      ...deps
    };
    makeAutoObservable<DeviceConnection,
        "serialDevice" | "deps" | "lastWebSerialTransport" | "spikerbitDevice" | "identifyCheck"
        | "stalledSpikerbit" | "followed" | "helpListener" | "helpFocusRequested">(
      this,
      {
        serialDevice: false,
        deps: false,
        lastWebSerialTransport: false,
        spikerbitDevice: false,
        identifyCheck: observable.ref,
        attempt: observable.ref,
        lastFailure: observable.ref,
        stalledSpikerbit: observable.ref,
        followed: false,
        help: observable.ref,
        helpListener: false,
        helpFocusRequested: false,
        takeHelpFocusRequest: false,
        connect: false,
        reconnect: false,
        disconnect: false,
        identify: false
      }
    );
    // A connection made any way, from any tile, ends the connect tutorial, so a later disconnect
    // can't bring it back. fireImmediately covers a connection that exists before this is created.
    reaction(() => this.isConnected, connected => {
      if (connected) this.dismissConnectTutorial({ by: "connection" });
    }, { fireImmediately: true });
    // The help's steps stay as they were opened; a change in the problem shows as a notice.
    reaction(() => this.currentProblem, problem => this.problemChanged(problem));
  }

  get isConnected() {
    return this.serialDevice.isConnected();
  }

  // Which of the connect pane's views shows. While the attempt runs, or holds a stalled update,
  // it is the attempt's own, which doesn't follow isConnected: a Reconnect keeps the actions while
  // nothing is connected, and a Connect shows them as soon as the device opens.
  get paneView(): AttemptView {
    const attempt = this.attempt;
    if (attempt && (!attempt.ended || this.stalledSpikerbit)) return attempt.view;
    return this.isConnected ? "actions" : "devices";
  }

  // The connected actions are disabled while an attempt is starting its device up, and while a
  // stalled update is making progress again, since closing the board would stop the flash.
  get actionsEnabled() {
    const attempt = this.attempt;
    if (this.updateResumed) return false;
    return !attempt || attempt.ended || attempt.actionsEnabled;
  }

  get dataReceived() {
    return this.isConnected && this.serialDevice.dataReceived;
  }

  // Whether a device is open: the active one, or a Spiker:bit a stalled update holds open.
  get holdsDevice() {
    return this.isConnected || this.paneView === "actions";
  }

  // Whether an update that stalled is making progress again. Its attempt has ended, but the pane
  // shows the update as it runs.
  get updateResumed() {
    return !!this.stalledSpikerbit && !this.lastFailure;
  }

  // `failure`, unless it is a stall whose device is no longer open, which another tile's
  // Disconnect can leave on a tile.
  currentFailure(failure: IConnectFailure | undefined) {
    return failure && (!kStallKinds.includes(failure.kind) || this.holdsDevice) ? failure : undefined;
  }

  get connectedLabel(): string | undefined {
    return this.isConnected && this.lastChoice ? kDeviceChoiceLabels[this.lastChoice] : undefined;
  }

  // The label of the device last connected, whether or not it still is.
  get label(): string | undefined {
    return this.lastChoice ? kDeviceChoiceLabels[this.lastChoice] : undefined;
  }

  get notResponding() {
    return this.isConnected && !!this.serialDevice.ccDeviceSession?.notResponding;
  }

  // Only a device speaking the CC Device Protocol can be asked to identify itself.
  get canIdentify() {
    return this.isConnected && !!this.serialDevice.ccDeviceSession;
  }

  // The "Is it alive?" check for the connected device, as every tile's pane shows it.
  get check(): IdentifyCheckState | undefined {
    const check = this.identifyCheck;
    return this.isConnected && check?.session === this.serialDevice.ccDeviceSession ? check?.state : undefined;
  }

  // Asks the device to identify itself, and keeps `check` up to date: checking, then the answer for
  // kIdentifyResultMs.
  async identify(): Promise<IdentifyResult> {
    const session = this.serialDevice.ccDeviceSession;
    if (!session) return "noAnswer";
    const checking: IIdentifyCheck = { session, state: "checking" };
    runInAction(() => { this.identifyCheck = checking; });
    const result = await session.identify();
    // A newer check replaces this one, and its answer stands.
    if (this.identifyCheck !== checking) return result;
    const answered: IIdentifyCheck = { session, state: result };
    runInAction(() => { this.identifyCheck = answered; });
    // A newer check by then keeps its own state.
    setTimeout(() => {
      runInAction(() => { if (this.identifyCheck === answered) this.identifyCheck = undefined; });
    }, kIdentifyResultMs);
    return result;
  }

  // Why the last device went away without the user asking, until the next connect attempt.
  get lossMessage(): string | undefined {
    const loss = this.serialDevice.lastLoss;
    if (this.isConnected || !loss) return undefined;
    const label = this.label ?? "device";
    return loss.reason === "unplugged"
      ? `The ${label} was unplugged.`
      : `The connection to the ${label} was lost.`;
  }

  // When that loss happened. A new value means a new loss; an unplug confirming a loss keeps it.
  get lossAt(): number | undefined {
    return this.serialDevice.lastLoss?.at;
  }

  // Why the last device went away without the user asking, while nothing is connected.
  get lossReason(): DeviceLoss | undefined {
    return this.isConnected ? undefined : this.serialDevice.lastLoss?.reason;
  }

  // The state the connection's help follows now. Undefined while an attempt runs, and while a
  // device is open with neither a problem nor data.
  get currentProblem(): HelpState | undefined {
    const attempt = this.attempt;
    if (attempt && !attempt.ended) return undefined;
    if (this.check === "noAnswer") return "noAnswer";
    const loss = this.lossReason;
    if (loss) return loss;
    if (this.lastFailure) return this.lastFailure.kind;
    if (this.updateResumed) return "updating";
    if (this.notResponding) return "notResponding";
    if (this.dataReceived) return "working";
    return this.holdsDevice ? undefined : "notConnected";
  }

  // The help topic for a kind, with the failure's details when `failure` is that kind.
  helpTopic(kind: HelpKind, tileId: string, failure = this.lastFailure): IHelpTopic | undefined {
    const matching = failure?.kind === kind ? failure : undefined;
    const choice = matching?.choice ?? this.lastChoice ?? this.attempt?.choice;
    return choice && { kind, choice, details: helpDetails(kind, matching), tileId };
  }

  openHelp(topic: IHelpTopic, listener?: IHelpListener) {
    this.help = { shown: topic, notice: undefined, detailsExpanded: false };
    this.helpListener = listener;
    this.helpFocusRequested = true;
  }

  // Whether the help's panel should move focus to its heading. Answers true once per opening.
  takeHelpFocusRequest() {
    const requested = this.helpFocusRequested;
    this.helpFocusRequested = false;
    return requested;
  }

  showNoticeTopic() {
    const notice = this.help?.notice;
    if (notice?.type !== "differentProblem") return;
    this.help = { shown: notice.topic, notice: undefined, detailsExpanded: false };
  }

  toggleHelpDetails() {
    if (this.help) this.help = { ...this.help, detailsExpanded: !this.help.detailsExpanded };
  }

  closeHelp() {
    this.help = undefined;
    this.helpListener = undefined;
    this.helpFocusRequested = false;
  }

  // A running attempt leaves the notice as it is until its outcome. Otherwise, with no problem, the
  // device isn't working any more, so a working notice goes; a different problem's steps still apply.
  // An unplug or a device that isn't connected keeps the steps, which can say to unplug the board
  // and click Connect, and gets a notice that says what to do next. So does a stalled update that
  // is making progress again.
  private problemChanged(problem: HelpState | undefined) {
    const help = this.help;
    if (!help) return;
    if (problem === undefined) {
      const attempt = this.attempt;
      if (help.notice?.type === "working" && !(attempt && !attempt.ended)) {
        this.help = { ...help, notice: undefined };
      }
      return;
    }
    const { shown } = help;
    let notice: HelpNotice | undefined;
    if (problem === "working" || problem === "updating" || problem === "unplugged" || problem === "notConnected") {
      notice = { type: problem };
    } else {
      // Help on another device names that device, so it is different help even for the same kind.
      const topic = this.helpTopic(problem, shown.tileId);
      if (topic && (topic.choice !== shown.choice || !sameHelp(problem, shown.kind, shown.choice))) {
        notice = { type: "differentProblem", topic };
      }
    }
    this.help = { ...help, notice };
    if (notice) this.helpListener?.onNotice?.(notice);
  }

  get connectTutorialDismissed() {
    return !!this.connectTutorialDismissal;
  }

  // Keeps the first dismissal, so the tiles that log it agree on what dismissed it.
  dismissConnectTutorial(dismissal: ConnectTutorialDismissal) {
    this.connectTutorialDismissal ??= dismissal;
  }

  async connect(choice: DeviceChoice, options: IAttemptOptions = {}): Promise<ConnectResult> {
    return this.startAttempt(choice, "connect", options, async attempt => {
      await this.closeDevices();
      return choice === "spikerbit" ? this.connectSpikerbit(attempt) : this.connectWebSerial(attempt);
    });
  }

  async reconnect(options: IAttemptOptions = {}): Promise<ConnectResult> {
    const choice = this.lastChoice;
    if (!choice) return "canceled";
    return this.startAttempt(choice, "reconnect", options, async attempt => {
      // A stalled Spiker:bit is the board Reconnect reopens.
      await this.closeDevices({ keepStalled: true });
      return choice === "spikerbit" ? this.reconnectSpikerbit(attempt) : this.reconnectWebSerial(attempt);
    });
  }

  async disconnect(): Promise<void> {
    const attempt = this.attempt;
    // An attempt still starting its device up is stopped. The user stopped it, so it isn't a
    // failure. A Spiker:bit it opened that isn't active yet is let go.
    const starting = attempt && !attempt.ended && this.isFollowing(attempt) ? attempt : undefined;
    if (starting) this.endAttempt(starting, "canceled");
    this.stopFollowing();
    // A stall's failure goes with its device.
    this.lastFailure = undefined;
    if (starting?.choice === "spikerbit" && starting.steps.active === undefined) await this.disposeSpikerbit();
    await this.closeDevices();
  }

  // Closes the attempt's devices: a stalled Spiker:bit, which is disposed unless kept for
  // Reconnect, then the active device. Closing the library connection also stops a flash, so two
  // connects never run against one board.
  private async closeDevices({ keepStalled = false } = {}) {
    const stalled = this.stalledSpikerbit;
    if (stalled && keepStalled) {
      this.stalledSpikerbit = undefined;
      try {
        await stalled.disconnect();
      } catch (e) {
        console.error("Spiker:bit disconnect failed", e);
      }
    } else if (stalled) {
      await this.disposeSpikerbit(stalled);
    }
    if (this.isConnected) await this.closeActive();
  }

  private async closeActive() {
    const transport = this.serialDevice.activeTransport;
    // The close asked for here can be reported back as a loss; it isn't one.
    if (transport) transport.onDisconnect = undefined;
    // Tell the board the session is over before its transport closes.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timedOut = new Promise<"timeout">(resolve => {
        timer = setTimeout(() => resolve("timeout"), kEndSessionTimeoutMs);
      });
      const result = await Promise.race([this.serialDevice.endSession(), timedOut]);
      if (result === "timeout") console.error("Device session end timed out; closing the transport anyway");
    } catch (e) {
      console.error("Device session end failed", e);
    } finally {
      clearTimeout(timer);
    }
    try {
      await transport?.close();
    } catch (e) {
      console.error("Device disconnect failed", e);
    }
    // Another connect may have replaced the device while the close was pending.
    if (this.serialDevice.activeTransport === transport) this.serialDevice.clearActiveDevice();
  }

  // Starts following a new attempt and runs it. The promise resolves when the attempt ends, which
  // can be before `run` finishes: a stalled update keeps going.
  private startAttempt(
    choice: DeviceChoice, trigger: AttemptTrigger, options: IAttemptOptions,
    run: (attempt: ConnectionAttempt) => Promise<void>
  ): Promise<ConnectResult> {
    if (this.busyChoice) return Promise.resolve("canceled");
    this.stopFollowing();
    this.serialDevice.clearLastLoss();
    const attempt = new ConnectionAttempt(choice, trigger, options.attemptId);
    return new Promise<ConnectResult>(resolve => {
      this.followed = { attempt, listener: options.listener, resolve, disposers: [] };
      this.attempt = attempt;
      this.lastFailure = undefined;
      this.busyChoice = choice;
      run(attempt).catch(e => {
        console.error("Device connection failed", e);
        this.endAttempt(attempt, "openFailed", { error: e });
      });
    });
  }

  private isFollowing(attempt: ConnectionAttempt) {
    return this.followed?.attempt === attempt;
  }

  private stopFollowing() {
    const followed = this.followed;
    if (!followed) return;
    this.followed = undefined;
    clearTimeout(followed.timer);
    followed.disposers.forEach(dispose => dispose());
  }

  // Ends the attempt, unless it has already ended or a newer one has replaced it. A failure's
  // `elapsedMs` is how long its step had run, unless given.
  private endAttempt(
    attempt: ConnectionAttempt, outcome: AttemptOutcome,
    { error, elapsedMs }: { error?: unknown, elapsedMs?: number } = {}
  ) {
    const followed = this.followed;
    if (followed?.attempt !== attempt || attempt.ended) return;
    clearTimeout(followed.timer);
    followed.timer = undefined;
    const failure: IConnectFailure | undefined = isFailureKind(outcome)
      ? {
        kind: outcome, choice: attempt.choice, step: attempt.step,
        elapsedMs: elapsedMs ?? attempt.stepElapsedMs, error: errorInfo(error)
      }
      : undefined;
    attempt.end(outcome, failure);
    this.lastFailure = failure;
    this.busyChoice = undefined;
    followed.resolve(outcome);
    followed.listener?.onEnded?.(attempt);
  }

  // Starts or restarts the running step's limit.
  private setLimit(attempt: ConnectionAttempt, ms: number, onLimit: () => void) {
    const followed = this.followed;
    if (followed?.attempt !== attempt || attempt.ended) return;
    clearTimeout(followed.timer);
    followed.timer = setTimeout(onLimit, ms);
  }

  private clearLimit(attempt: ConnectionAttempt) {
    const followed = this.followed;
    if (followed?.attempt !== attempt) return;
    clearTimeout(followed.timer);
    followed.timer = undefined;
  }

  // The device is open. The view switches to the connected actions, and Reconnect now repeats this
  // choice, since a stall still leaves the device open.
  private markOpened(attempt: ConnectionAttempt, next: AttemptStep) {
    if (!this.isFollowing(attempt)) return;
    attempt.opened(next);
    this.lastChoice = attempt.choice;
  }

  // The attempt's device became the active device, perhaps after a stall ended the attempt. Waits
  // for its first data, and watches for it going away.
  private deviceActivated(attempt: ConnectionAttempt, transport: IDeviceTransport) {
    const followed = this.followed;
    if (followed?.attempt !== attempt) return;
    attempt.activated();
    this.stalledSpikerbit = undefined;
    followed.disposers.push(
      when(() => this.serialDevice.activeTransport === transport && this.serialDevice.dataReceived,
        () => this.dataArrived(attempt)),
      when(() => this.serialDevice.lastLoss?.transport === transport,
        () => this.deviceLost(attempt, this.serialDevice.lastLoss!.reason))
    );
    const noData = attempt.choice === "spikerbit" ? "notResponding" : "noData";
    if (!attempt.ended) {
      this.setLimit(attempt, kFirstDataTimeoutMs,
        () => this.endAttempt(attempt, noData, { elapsedMs: kFirstDataTimeoutMs }));
    } else if (attempt.outcome === "updateStalled") {
      // The stalled update finished after all. The attempt keeps its outcome, but the update no
      // longer stalls, and the board gets the same wait for its first data, which can stall too.
      this.stallChanged(attempt, undefined);
      clearTimeout(followed.timer);
      followed.timer = setTimeout(() => this.stallChanged(attempt, {
        kind: noData, choice: attempt.choice, step: "waitForData", elapsedMs: kFirstDataTimeoutMs
      }), kFirstDataTimeoutMs);
    }
  }

  // After a stall ended the attempt, its failure changed.
  private stallChanged(attempt: ConnectionAttempt, failure: IConnectFailure | undefined) {
    const followed = this.followed;
    if (followed?.attempt !== attempt) return;
    this.lastFailure = failure;
    followed.listener?.onStallChanged?.(attempt, failure);
  }

  private dataArrived(attempt: ConnectionAttempt) {
    const followed = this.followed;
    if (followed?.attempt !== attempt) return;
    attempt.dataArrived();
    if (!attempt.ended) {
      this.endAttempt(attempt, "connected");
    } else if (attempt.recovered) {
      this.clearLimit(attempt);
      this.lastFailure = undefined;
      followed.listener?.onRecovered?.(attempt);
    }
  }

  // A loss before the attempt has ended ends it. After that, the device it left open was lost, and
  // a stall's failure goes with it.
  private deviceLost(attempt: ConnectionAttempt, reason: DeviceLoss) {
    const followed = this.followed;
    if (followed?.attempt !== attempt) return;
    if (!attempt.ended) {
      this.endAttempt(attempt, reason);
    } else {
      this.clearLimit(attempt);
      this.lastFailure = undefined;
      followed.listener?.onLost?.(attempt, reason);
    }
  }

  private async connectWebSerial(attempt: ConnectionAttempt) {
    const transport = this.deps.createWebSerialTransport();
    const result = await this.openWebSerial(attempt, transport);
    if (result === "opened") return this.activateWebSerial(attempt, transport);
    this.endAttempt(attempt, webSerialOutcome(result), { error: transport.lastOpenError });
  }

  // Opens `port`, or the port the user chooses when none is given.
  private openWebSerial(attempt: ConnectionAttempt, transport: WebSerialTransport, port?: SerialPort) {
    const listener = this.followed?.listener;
    return transport.open(port, {
      timeoutMs: kOpenTimeoutMs,
      onChosen: port ? undefined : () => attempt.chooserClosed(),
      onAbandoned: info => listener?.onAbandonedOpen?.(attempt, info)
    });
  }

  private async activateWebSerial(attempt: ConnectionAttempt, transport: WebSerialTransport) {
    const deviceFamily = transport.deviceFamily;
    // A Disconnect stopped the attempt while the port was opening.
    if (!deviceFamily || !this.isFollowing(attempt)) {
      await transport.close();
      this.endAttempt(attempt, "openFailed");
      return;
    }
    this.lastWebSerialTransport = transport;
    this.markOpened(attempt, "waitForData");
    this.serialDevice.setActiveDevice(deviceFamily, transport);
    this.serialDevice.setRaisesWebSerialConnect(transport.raisesWebSerialConnect);
    this.deviceActivated(attempt, transport);
    transport.startReading();
  }

  // Reopens the last port without the chooser. If that fails, for example because the board was
  // unplugged, falls back to the chooser. A port still stuck opening ends the attempt instead:
  // choosing the same port again would get the same answer.
  private async reconnectWebSerial(attempt: ConnectionAttempt) {
    const lastPort = this.lastWebSerialTransport?.lastPort ?? null;

    if (lastPort) {
      const transport = this.deps.createWebSerialTransport();
      const result = await this.openWebSerial(attempt, transport, lastPort);
      if (result === "opened") return this.activateWebSerial(attempt, transport);
      if (result !== "failed") {
        this.endAttempt(attempt, webSerialOutcome(result), { error: transport.lastOpenError });
        return;
      }
    }

    attempt.setStep("choose");
    return this.connectWebSerial(attempt);
  }

  // A fresh device has a fresh library connection, which shows the chooser.
  private async connectSpikerbit(attempt: ConnectionAttempt) {
    await this.disposeSpikerbit();
    const device = this.deps.createSpikerbitDevice(this.serialDevice);
    this.spikerbitDevice = device;
    const failure = await this.streamSpikerbit(attempt, device);
    if (failure) this.endAttempt(attempt, failure.outcome, { error: failure.error });
  }

  // Reopens the known board without the chooser. If it can't be opened, for example because the
  // board was unplugged, falls back to a fresh device and the chooser.
  private async reconnectSpikerbit(attempt: ConnectionAttempt) {
    const known = this.spikerbitDevice;
    if (known) {
      const failure = await this.streamSpikerbit(attempt, known);
      if (failure?.outcome !== "openFailed") {
        if (failure) this.endAttempt(attempt, failure.outcome, { error: failure.error });
        return;
      }
    }
    attempt.setStep("choose");
    return this.connectSpikerbit(attempt);
  }

  // Runs the board's connect, following its steps, until the board is active. Resolves with how it
  // failed, or undefined when there is nothing more to end. A failure after the open closes the
  // board.
  private async streamSpikerbit(
    attempt: ConnectionAttempt, device: SpikerbitDevice
  ): Promise<IOpenFailure | undefined> {
    const listener = this.followed?.listener;
    // Reports from a run that a Disconnect or a newer attempt replaced are ignored.
    const following = () => this.isFollowing(attempt);
    let opened = false;
    let failed = false;
    const limitUpdate = (ms: number) => this.setLimit(attempt, ms, () => {
      if (!failed) this.updateStalled(attempt, device, ms);
    });
    const observer: ISpikerbitConnectObserver = {
      onOpening: afterChooser => {
        if (!following()) return;
        if (afterChooser) attempt.chooserClosed();
        else attempt.setStep("open");
      },
      onOpened: () => {
        opened = true;
        this.markOpened(attempt, "checkFirmware");
      },
      onFirmwareChecked: (reply, willUpdate) => {
        if (!following()) return;
        attempt.firmwareChecked(describeFirmware(reply), willUpdate);
        if (willUpdate) limitUpdate(kUpdateStartMs);
      },
      onUpdateProgress: percent => {
        if (!following()) return;
        attempt.updateProgress(percent);
        if (!attempt.ended) limitUpdate(kUpdateStallMs);
        else if (this.stalledSpikerbit === device) this.stalledUpdateProgressed(attempt, () => !failed);
      },
      onUpdateFinished: () => {
        if (!following()) return;
        attempt.updateFinished();
        this.clearLimit(attempt);
      },
      // The board may take a while to close, and a stall mustn't be reported meanwhile.
      onFailed: () => {
        failed = true;
        this.clearLimit(attempt);
      },
      onLost: loss => this.openSpikerbitLost(attempt, device, loss),
      onAbandoned: info => listener?.onAbandonedOpen?.(attempt, info)
    };

    try {
      await device.connectAndStream(this.deps.getSpikerbitFlashDataSource(), observer);
    } catch (e) {
      failed = true;
      this.clearLimit(attempt);
      // A Disconnect, a newer attempt or a loss has already let the board go.
      if (!following() || this.spikerbitDevice !== device) return undefined;
      const code = errorCode(e);
      if (code === kNoDeviceSelected) return { outcome: "canceled" };
      console.error("Spiker:bit connection failed", e);
      if (code === kOpenTimeout) {
        // The device is already closing its abandoned open, and that close may hang.
        await this.disposeSpikerbit(device, { close: false });
        return { outcome: "openTimeout", error: e };
      }
      // A stall ended the attempt, so this board is the stalled one.
      const stalled = attempt.ended;
      await this.disposeSpikerbit(device);
      if (code === kDeviceInUse) return { outcome: "inUse", error: e };
      // The library gives up on the USB open itself after 10 s.
      if (!opened && code === kLibraryTimeout) return { outcome: "openTimeout", error: e };
      if (stalled) {
        this.stalledUpdateFailed(attempt, e);
        return undefined;
      }
      return { outcome: opened ? "updateFailed" : "openFailed", error: e };
    }

    if (!following()) return undefined;
    const transport = this.serialDevice.activeTransport;
    if (!transport) return { outcome: this.serialDevice.lastLoss?.reason ?? "lost" };
    this.deviceActivated(attempt, transport);
    return undefined;
  }

  // The flash keeps running, and the board stays open until it finishes or is disposed.
  private updateStalled(attempt: ConnectionAttempt, device: SpikerbitDevice, elapsedMs: number) {
    if (!this.isFollowing(attempt) || this.spikerbitDevice !== device) return;
    this.stalledSpikerbit = device;
    this.endAttempt(attempt, "updateStalled", { elapsedMs });
  }

  // A stalled update made progress, so it no longer stalls, until it goes kUpdateStallMs without
  // progress again. `flashing` is false once the flash has failed.
  private stalledUpdateProgressed(attempt: ConnectionAttempt, flashing: () => boolean) {
    const followed = this.followed;
    if (followed?.attempt !== attempt) return;
    if (this.lastFailure) this.stallChanged(attempt, undefined);
    clearTimeout(followed.timer);
    followed.timer = setTimeout(() => {
      if (!flashing()) return;
      this.stallChanged(attempt, {
        kind: "updateStalled", choice: attempt.choice, step: "update", elapsedMs: kUpdateStallMs
      });
    }, kUpdateStallMs);
  }

  // The flash of a stalled update failed after all, so the pane goes back to the device list with
  // that failure. The attempt has ended, so the listener hears of it as a loss of the board.
  private stalledUpdateFailed(attempt: ConnectionAttempt, error: unknown) {
    this.lastFailure = {
      kind: "updateFailed", choice: attempt.choice, step: "update", elapsedMs: attempt.stepElapsedMs,
      error: errorInfo(error)
    };
    this.followed?.listener?.onLost?.(attempt, "updateFailed");
  }

  // The board went away after its open and before it became active, perhaps during a stalled
  // update. While the attempt runs, that ends it; afterward, the listener hears of the loss. It is
  // recorded as the loss of a device, which the pane shows, and the board is let go.
  private openSpikerbitLost(attempt: ConnectionAttempt, device: SpikerbitDevice, loss: DeviceLoss) {
    const followed = this.followed;
    if (followed?.attempt !== attempt || this.spikerbitDevice !== device) return;
    this.clearLimit(attempt);
    if (!attempt.ended) {
      this.endAttempt(attempt, loss);
    } else {
      this.lastFailure = undefined;
      followed.listener?.onLost?.(attempt, loss);
    }
    this.serialDevice.recordLoss(device.transport, loss);
    void this.disposeSpikerbit(device);
  }

  // Lets the board go: closes its library connection unless told not to, then stops listening for
  // its unplug.
  private async disposeSpikerbit(device = this.spikerbitDevice, { close = true } = {}) {
    if (!device) return;
    if (this.spikerbitDevice === device) this.spikerbitDevice = undefined;
    if (this.stalledSpikerbit === device) this.stalledSpikerbit = undefined;
    if (close) {
      try {
        await device.disconnect();
      } catch (e) {
        console.error("Spiker:bit disconnect failed", e);
      }
    }
    device.dispose();
  }
}

const connections = new WeakMap<SerialDevice, DeviceConnection>();

export function getDeviceConnection(serialDevice: SerialDevice): DeviceConnection {
  let connection = connections.get(serialDevice);
  if (!connection) {
    connection = new DeviceConnection(serialDevice);
    connections.set(serialDevice, connection);
  }
  return connection;
}
