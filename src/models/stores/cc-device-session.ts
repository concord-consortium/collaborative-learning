import { action, makeObservable, observable } from "mobx";
import { NodeChannelInfo } from "../../plugins/dataflow/model/utilities/channel";
import { parseCcDeviceLine, splitLines, withChecksum } from "./cc-device-protocol";

export interface CcDeviceSessionOptions {
  pingIntervalMs?: number;
  openRetryMs?: number;
  randomSessionId?: () => number;
}

export const kMaxSeq = 999;

// How many commands in a row can go unanswered before the device counts as not responding.
export const kNotRespondingAfter = 3;

// How long identify waits for the device's reply.
export const kIdentifyTimeoutMs = 2000;

export type IdentifyResult = "answered" | "noAnswer";

function defaultRandomSessionId() {
  return 1 + Math.floor(Math.random() * 65535);
}

/**
 * The host side of one CC Device Protocol session: opens it, keeps it alive with pings,
 * recovers when the device forgets it, and routes readings to channels.
 */
export class CcDeviceSession {
  lastHeartbeatAt: number | undefined;
  // Set when kNotRespondingAfter commands in a row have gone unanswered, or another host has taken
  // the device. Cleared by the next reply.
  notResponding = false;

  private write: (line: string) => void | Promise<void>;
  private pingIntervalMs: number;
  private openRetryMs: number;
  private randomSessionId: () => number;

  private sessionId = 0;
  private seq = 0;
  private opened = false;
  private pending = new Map<number, "open" | "ping">();
  // Resolvers for identify commands still waiting, by #n. Kept apart from `pending` so stopping the
  // session doesn't drop them and their replies don't count as the session's.
  private identifies = new Map<number, (result: IdentifyResult) => void>();
  private buffer = "";
  // Commands sent since the last reply. Not counted while the page is hidden: the browser slows
  // the library's serial reads there, so replies fall behind the readings.
  private unanswered = 0;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private openTimer: ReturnType<typeof setInterval> | undefined;

  constructor(write: (line: string) => void | Promise<void>, options: CcDeviceSessionOptions = {}) {
    this.write = write;
    this.pingIntervalMs = options.pingIntervalMs ?? 1000;
    this.openRetryMs = options.openRetryMs ?? 2000;
    this.randomSessionId = options.randomSessionId ?? defaultRandomSessionId;
    makeObservable<CcDeviceSession>(this, {
      lastHeartbeatAt: observable,
      notResponding: observable,
      setLastHeartbeatAt: action,
      setNotResponding: action
    });
  }

  setLastHeartbeatAt(time: number) {
    this.lastHeartbeatAt = time;
  }

  setNotResponding(value: boolean) {
    this.notResponding = value;
  }

  start() {
    this.stop();
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.openSession();
  }

  stop() {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.clearTimers();
    this.pending.clear();
    this.opened = false;
  }

  async close() {
    // An open still waiting for its ok may have reached the device. A close for a session the
    // device doesn't have changes nothing there.
    if (this.opened || this.openTimer) {
      const id = this.sessionId;
      this.stop();
      try {
        await this.write(withChecksum(`close session:${id}`));
      } catch (e) {
        console.warn("CC Device session close failed", e);
      }
    }
    this.stop();
  }

  receive(chunk: string, channels: NodeChannelInfo[]) {
    const { lines, remaining } = splitLines(this.buffer + chunk);
    this.buffer = remaining;
    lines.forEach(line => this.handleLine(line, channels));
  }

  sendOutput(name: string, value: number) {
    this.send(`${name}:${value}`);
  }

  // Asks the device to draw attention to itself. Any reply to it, ok or err, means it answered.
  identify(timeoutMs = kIdentifyTimeoutMs): Promise<IdentifyResult> {
    const seq = this.nextSeq();
    return new Promise(resolve => {
      const timer = setTimeout(() => finish("noAnswer"), timeoutMs);
      const finish = (result: IdentifyResult) => {
        clearTimeout(timer);
        this.identifies.delete(seq);
        resolve(result);
      };
      this.identifies.set(seq, finish);
      this.send(`identify #${seq}`);
    });
  }

  private handleLine(line: string, channels: NodeChannelInfo[]) {
    const parsed = parseCcDeviceLine(line);
    if (!parsed) return;
    switch (parsed.kind) {
      case "reading":
        channels.filter(c => c.channelId === parsed.name).forEach(c => {
          c.value = parsed.value;
          c.lastMessageReceivedAt = Date.now();
        });
        break;
      case "ok":
        this.handleOk(parsed.seq);
        break;
      case "err":
        this.handleErr(parsed.seq, parsed.reason);
        break;
    }
  }

  // Resolves the identify a reply answers. Returns whether there was one.
  private answerIdentify(seq: number | undefined) {
    const finish = seq === undefined ? undefined : this.identifies.get(seq);
    finish?.("answered");
    return !!finish;
  }

  private handleOk(seq: number | undefined) {
    if (this.answerIdentify(seq)) return;
    const kind = seq === undefined ? undefined : this.pending.get(seq);
    if (seq === undefined || !kind) return;
    this.pending.delete(seq);
    this.answered();
    if (kind === "open") {
      if (this.opened) return;
      this.opened = true;
      this.clearTimers();
      this.pingTimer = setInterval(() => this.ping(), this.pingIntervalMs);
    } else {
      this.setLastHeartbeatAt(Date.now());
    }
  }

  private handleErr(seq: number | undefined, reason: string) {
    if (this.answerIdentify(seq)) return;
    if (reason === "nosession" || reason === "othersession") {
      // Only an answer to a ping still pending changes the session. Reopening clears the pending
      // pings, so the errors for other pings in flight, or late ones for an earlier session,
      // change nothing.
      if (seq === undefined || this.pending.get(seq) !== "ping") return;
      this.pending.delete(seq);
    }
    if (reason === "nosession") this.answered();
    if (reason === "nosession") {
      this.clearTimers();
      this.pending.clear();
      this.opened = false;
      this.openSession();
    } else if (reason === "othersession") {
      console.warn("CC Device: another host owns the session; giving up");
      this.stop();
      this.setNotResponding(true);
    } else {
      console.warn(`CC Device error${seq !== undefined ? ` #${seq}` : ""}: ${reason}`);
    }
  }

  private openSession() {
    this.sessionId = this.randomSessionId();
    // The timer goes first, so an ok that arrives while the open is being written cancels it.
    this.openTimer = setInterval(() => this.sendOpen(), this.openRetryMs);
    this.sendOpen();
  }

  private sendOpen() {
    this.sendCommand(`open session:${this.sessionId}`, "open");
  }

  private ping() {
    this.sendCommand(`ping session:${this.sessionId}`, "ping");
  }

  private answered() {
    this.unanswered = 0;
    this.setNotResponding(false);
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === "visible") this.unanswered = 0;
  };

  private sendCommand(command: string, kind: "open" | "ping") {
    if (document.visibilityState !== "hidden") {
      if (this.unanswered >= kNotRespondingAfter) this.setNotResponding(true);
      this.unanswered++;
    }
    const seq = this.nextSeq();
    this.pending.set(seq, kind);
    this.send(`${command} #${seq}`);
  }

  private nextSeq() {
    this.seq = this.seq >= kMaxSeq ? 1 : this.seq + 1;
    return this.seq;
  }

  private clearTimers() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.openTimer) clearInterval(this.openTimer);
    this.pingTimer = undefined;
    this.openTimer = undefined;
  }

  private send(body: string) {
    try {
      const result = this.write(withChecksum(body));
      if (result) result.catch(e => console.warn("CC Device write failed", e));
    } catch (e) {
      console.warn("CC Device write failed", e);
    }
  }
}
