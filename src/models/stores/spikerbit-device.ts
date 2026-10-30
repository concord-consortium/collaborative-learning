import { kMaxSeq } from "./cc-device-session";
import { withChecksum } from "./cc-device-protocol";
import { SerialDevice } from "./serial";
import { detectFirmwareReply, FirmwareReply, shouldFlash } from "./serial-protocol";
import { DeviceLoss, IAbandonedOpenInfo, IDeviceTransport, tryAbandonedPart } from "./device-transport";

// The version of the firmware bundled at src/plugins/dataflow/firmware/spikerbit-clue.hex.
// Keep equal to the `firmware:` number in the HELLO line of spikerbit-clue.ts.
export const kSpikerbitFirmwareVersion = 4;

// The `device` field of the hello a Spiker:bit sends, and also its deviceFamily key in
// kDeviceCapabilities.
const kSpikerbitDeviceName = "spikerbit";

// How long queryFirmware waits in all, both attempts included, for a firmware reply before
// deciding to flash.
const kFirmwareQueryTimeoutMs = 1500;

// The most one "serialdata" event can carry. @microbit/microbit-connection reads the board's
// output with DAPLink's vendor serial read, whose 64-byte reply spends 2 bytes on its header
// (`read` in its usb/daplink.js). While a backlog drains, every read comes back full, so the
// first shorter one means DAPLink's buffer has been emptied. This is only a hint; kDrainQuietMs
// and the overall timeout are the backstops.
const kDaplinkReadBytes = 62;

// With no data for this long, the backlog counts as drained even without a short read.
const kDrainQuietMs = 100;

// How long after the drain queryFirmware waits for a reply before it writes "!!" and "?" again.
const kRetryAfterDrainMs = 200;

// How often queryFirmware checks for a reply and for the drain.
const kQueryPollMs = 10;

// Above CcDeviceSession's 1..kMaxSeq, so a late reply to a connect-time "!!" can't match a session
// command.
const kFirstResetSeq = kMaxSeq + 1;

// The `code` of the error connectAndStream throws when the USB open takes too long.
const kOpenTimeoutCode = "open-timeout";

// Minimal subset of @microbit/microbit-connection's MicrobitUSBConnection that
// this module depends on. Kept as an interface so tests can supply a fake and so
// the device logic stays decoupled from the library (only spikerbit-connection.ts
// imports it).
export interface IMicrobitUsbConnection {
  addEventListener(type: "serialdata", listener: (data: { data: string }) => void): void;
  addEventListener(type: "status", listener: (data: { status: string }) => void): void;
  // The library reports `progress` stages: "FindingDevice" before it shows its chooser, and
  // "Connecting" once a device is chosen, or at once for a device it already knows.
  connect(options?: { progress?: (stage: string) => void }): Promise<void>;
  flash(
    dataSource: unknown,
    options: { partial?: boolean; progress?: (stage: string, pct?: number) => void }
  ): Promise<void>;
  serialWrite(data: string): Promise<void>;
  disconnect(): Promise<void>;
  // The library's USBDevice. Typed unknown: it's only compared with the device in an unplug event.
  getDevice(): unknown;
}

// What connectAndStream reports as the connection proceeds, so a caller can show its steps.
export interface ISpikerbitConnectObserver {
  // The USB open started. `afterChooser` is whether the browser's chooser was shown first.
  onOpening?(afterChooser: boolean): void;
  onOpened?(): void;
  // `reply` is what the board answered with, or null when it didn't answer; `willUpdate` is
  // whether the firmware is about to be flashed.
  onFirmwareChecked?(reply: FirmwareReply | null, willUpdate: boolean): void;
  // 0-100. Every call counts as progress.
  onUpdateProgress?(percent: number): void;
  onUpdateFinished?(): void;
  // The board went away after the open and before it became the active device.
  onLost?(loss: DeviceLoss): void;
  // The connect failed. Called before the link is closed, which can take a while.
  onFailed?(): void;
  // Called after an abandoned USB open is closed and forgotten, and again if it settles late.
  onAbandoned?(info: IAbandonedOpenInfo): void;
}

// The part of navigator.usb that reports a device being unplugged.
export interface IUsbDisconnectSource {
  addEventListener(type: "disconnect", listener: (e: { device: unknown }) => void): void;
  removeEventListener(type: "disconnect", listener: (e: { device: unknown }) => void): void;
}

// IDeviceTransport over a micro:bit WebUSB serial connection. Like WebSerialTransport,
// it owns the connection's inbound events: it forwards serial chunks to onData and fires
// onDisconnect on a lost/deauthorized connection, so SerialDevice can receive centrally.
// The library disconnects itself after any failed WebUSB call, and its Disconnected status is
// reported as "lost". It listens for navigator.usb's disconnect only in initialize(), which CLUE
// doesn't call because initialize() also pauses the connection in a hidden tab, so this transport
// listens for unplugs itself.
export class MicrobitUsbTransport implements IDeviceTransport {
  onData?: (chunk: string) => void;
  onDisconnect?: (loss: DeviceLoss) => void;

  constructor(
    private connection: IMicrobitUsbConnection,
    private usb: IUsbDisconnectSource | undefined = (navigator as { usb?: IUsbDisconnectSource }).usb
  ) {
    connection.addEventListener("serialdata", ({ data }) => this.onData?.(data));
    connection.addEventListener("status", ({ status }) => {
      if (status === "Disconnected" || status === "NoAuthorizedDevice") this.onDisconnect?.("lost");
    });
    usb?.addEventListener("disconnect", this.handleUnplug);
  }

  dispose() {
    this.usb?.removeEventListener("disconnect", this.handleUnplug);
  }

  private handleUnplug = (e: { device: unknown }) => {
    const device = this.connection.getDevice();
    if (device === undefined || e.device !== device) return;
    this.onDisconnect?.("unplugged");
    // The library doesn't see the unplug, so its status would stay Connected. The Disconnected
    // status this raises reports "lost", which doesn't undo the unplug already recorded.
    this.connection.disconnect().catch((err) => console.warn("Spiker:bit disconnect failed", err));
  };

  // Resolves when the write finishes, so a caller can wait for its last line to reach the board.
  // A failure is logged, not thrown. It's async because serialWrite throws before returning a
  // promise when the board is gone.
  async write(line: string) {
    try {
      await this.connection.serialWrite(`${line}\n`);
    } catch (e) {
      console.warn("Spiker:bit serialWrite failed", e);
    }
  }

  close() {
    return this.connection.disconnect();
  }
}

export interface SpikerbitDeviceOptions {
  firmwareQueryTimeoutMs?: number;
  // How long the USB open may take before connectAndStream gives up with an "open-timeout" error.
  // No limit when unset.
  openTimeoutMs?: number;
  // Where unplugs are reported. Defaults to navigator.usb.
  usb?: IUsbDisconnectSource;
}

export class SpikerbitDevice {
  private serialDevice: SerialDevice;
  private connection: IMicrobitUsbConnection;
  readonly transport: MicrobitUsbTransport;
  private buffer = "";
  private detectedReply: FirmwareReply | null = null;
  private firmwareQueryTimeoutMs: number;
  private openTimeoutMs: number | undefined;
  private resetSeq = kFirstResetSeq;
  // Counts connectAndStream calls and disconnects, so a connect can tell that it was disconnected
  // while it was running.
  private connectRun = 0;
  // When the latest connect-time chunk arrived, and when the backlog was first seen to have
  // drained (a read shorter than kDaplinkReadBytes) since the latest "!!" and "?".
  private lastDataAt = 0;
  private shortReadAt: number | undefined;

  constructor(serialDevice: SerialDevice, connection: IMicrobitUsbConnection, options?: SpikerbitDeviceOptions) {
    this.serialDevice = serialDevice;
    this.connection = connection;
    this.transport = new MicrobitUsbTransport(connection, options?.usb);
    this.firmwareQueryTimeoutMs = options?.firmwareQueryTimeoutMs ?? kFirmwareQueryTimeoutMs;
    this.openTimeoutMs = options?.openTimeoutMs;
  }

  // Rejects with an error whose `code` is "open-timeout" when the USB open takes longer than
  // openTimeoutMs, and "closed" when disconnect is called before the board becomes active.
  public async connectAndStream(flashDataSource: unknown, observer?: ISpikerbitConnectObserver) {
    const run = ++this.connectRun;
    this.transport.onData = this.handleFirmwareData;

    try {
      await this.connectAndCheckFirmware(run, flashDataSource, observer);
    } catch (e) {
      observer?.onFailed?.();
      // Close the link so a failed attempt doesn't leave the board open and still feeding the
      // firmware handler. An abandoned open is already being closed in the background, and a run
      // that was disconnected may share the board with a newer run, which must keep it.
      if (run === this.connectRun && (e as { code?: string } | null)?.code !== kOpenTimeoutCode) {
        await this.disconnect().catch((err) => console.warn("Spiker:bit disconnect failed", err));
      }
      throw e;
    }

    this.throwIfDisconnected(run);
    this.serialDevice.setActiveDevice(kSpikerbitDeviceName, this.transport);
  }

  // A board disconnected during its connect, perhaps for another connect, mustn't then be written
  // to or replace whatever is active.
  private throwIfDisconnected(run: number) {
    if (run !== this.connectRun) {
      throw Object.assign(new Error("The connection was closed while it was starting"), { code: "closed" });
    }
  }

  // Closes the WebUSB link. The library connection's status event then clears the store's
  // active device if this transport holds it.
  public disconnect() {
    this.connectRun++;
    this.transport.onData = undefined;
    this.buffer = "";
    return this.connection.disconnect();
  }

  // Stops listening for this board being unplugged. Call when the device is no longer kept.
  public dispose() {
    this.transport.dispose();
  }

  // Races connection.connect() against openTimeoutMs, counted from the library's "Connecting"
  // stage so the time in its chooser doesn't count. When the limit wins, the open is given up on
  // (see abandonOpen) and this rejects at once.
  private async openWithLimit(observer?: ISpikerbitConnectObserver) {
    let choosing = false;
    let opening = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let resolveTimedOut: (outcome: { status: "timeout" }) => void = () => undefined;
    const timedOut = new Promise<{ status: "timeout" }>((resolve) => { resolveTimedOut = resolve; });
    const progress = (stage: string) => {
      if (stage === "FindingDevice") choosing = true;
      if (stage !== "Connecting" || opening) return;
      opening = true;
      observer?.onOpening?.(choosing);
      if (this.openTimeoutMs != null) {
        timeoutId = setTimeout(() => resolveTimedOut({ status: "timeout" }), this.openTimeoutMs);
      }
    };
    const settled = this.connection.connect({ progress }).then(
      () => ({ status: "opened" as const }),
      (error: unknown) => ({ status: "failed" as const, error })
    );
    const outcome = await Promise.race([settled, timedOut]).finally(() => clearTimeout(timeoutId));
    if (outcome.status === "failed") throw outcome.error;
    if (outcome.status === "opened") return;

    this.abandonOpen(settled, observer);
    throw Object.assign(new Error("Opening the USB connection timed out"), { code: kOpenTimeoutCode });
  }

  // Tries to close the link and forget the device whose open was given up on, and closes the link
  // if that open succeeds later. Nothing here is awaited: a link stuck opening may not close
  // either, and the time limit mustn't wait for it. Close and forget start together, so one that
  // hangs doesn't keep the other from being tried, and each part reports through
  // observer.onAbandoned as it finishes.
  private abandonOpen(
    settled: Promise<{ status: "opened" } | { status: "failed" }>, observer?: ISpikerbitConnectObserver
  ) {
    const report = (info: IAbandonedOpenInfo) => {
      try {
        observer?.onAbandoned?.(info);
      } catch (e) {
        console.error("Abandoned open report failed", e);
      }
    };
    const forgettable = this.connection.getDevice() as { forget?: () => Promise<void> } | undefined;
    tryAbandonedPart("close", () => this.connection.disconnect(), report);
    tryAbandonedPart("forget", typeof forgettable?.forget === "function" ? () => forgettable.forget!() : undefined,
      report);
    void settled.then(async (late) => {
      if (late.status === "opened") {
        await this.connection.disconnect().catch(() => { /* the open is abandoned either way */ });
      }
      report({ late: late.status });
    });
  }

  private async connectAndCheckFirmware(run: number, flashDataSource: unknown, observer?: ISpikerbitConnectObserver) {
    await this.openWithLimit(observer);
    this.throwIfDisconnected(run);
    // Until the board is active, a loss is reported to the observer. A disconnect asked for here
    // isn't a loss. setActiveDevice replaces this.
    this.transport.onDisconnect = loss => {
      if (run === this.connectRun) observer?.onLost?.(loss);
    };
    observer?.onOpened?.();

    this.resetSeq = kFirstResetSeq;
    const running = await this.queryFirmware();
    const willUpdate = shouldFlash(running, kSpikerbitDeviceName, kSpikerbitFirmwareVersion);
    observer?.onFirmwareChecked?.(running, willUpdate);
    this.throwIfDisconnected(run);
    if (willUpdate) {
      // USB connection stays Connected through a flash (DAPLink interface chip is untouched) and
      // serial auto-reinitializes, so no explicit reconnect here.
      // A progress call without a percent marks the end of the flashing, which isn't progress.
      const progress = (_stage: string, pct?: number) => {
        if (pct !== undefined) observer?.onUpdateProgress?.(Math.round(pct * 100));
      };
      await this.connection.flash(flashDataSource, { partial: true, progress });
      this.throwIfDisconnected(run);
      observer?.onUpdateFinished?.();
      // Re-query to confirm the flash took, but proceed regardless: the board was just written
      // with the known-good bundled hex, so a null/stale reply here is far more likely a serial
      // re-init timing artifact than bad firmware, and aborting would discard a good flash while
      // showing the user nothing. We warn rather than fail so a genuinely halted board (e.g. a
      // partial flash whose reset was swallowed) still leaves a trace.
      const confirmed = await this.queryFirmware();
      if (shouldFlash(confirmed, kSpikerbitDeviceName, kSpikerbitFirmwareVersion)) {
        console.warn(
          `Spiker:bit firmware not confirmed after flash (got ${JSON.stringify(confirmed)}, ` +
          `expected firmware ${kSpikerbitFirmwareVersion}); connecting anyway.`
        );
      }
    }
  }

  // Connect-time only: scan inbound data for the firmware reply, surfaced via detectedReply
  // for queryFirmware. EMG parsing does not happen here; it runs through SerialDevice.receive
  // once the transport becomes the active device.
  private handleFirmwareData = (data: string) => {
    this.lastDataAt = Date.now();
    if (data.length < kDaplinkReadBytes && this.shortReadAt === undefined) {
      this.shortReadAt = this.lastDataAt;
    }
    this.buffer += data;
    const detected = detectFirmwareReply(this.buffer);
    if (detected.reply) {
      this.detectedReply = detected.reply;
      this.buffer = detected.remaining;
    }
  };

  // Identifies the firmware, right after connecting and again after a flash: writes "!! #n" and a
  // bare "?", reads lines until a hello or a v1–v3 banner, and writes both once more
  // kRetryAfterDrainMs after the backlog drains, in case DAPLink's full buffer dropped the
  // replies. Returns null when nothing is identified within firmwareQueryTimeoutMs. Why "!!" comes
  // first: cc-device-protocol.md, "Connecting".
  private async queryFirmware(): Promise<FirmwareReply | null> {
    this.detectedReply = null;
    const started = Date.now();
    await this.writeResetAndQuery();
    let retried = false;
    return new Promise<FirmwareReply | null>((resolve) => {
      const poll = () => {
        if (this.detectedReply) return resolve(this.detectedReply);
        const now = Date.now();
        if (now - started >= this.firmwareQueryTimeoutMs) return resolve(null);
        if (!retried) {
          const drainedAt = this.shortReadAt
            ?? (now - this.lastDataAt >= kDrainQuietMs ? this.lastDataAt + kDrainQuietMs : undefined);
          if (drainedAt !== undefined && now - drainedAt >= kRetryAfterDrainMs) {
            retried = true;
            this.writeResetAndQuery().catch((e) => console.warn("Spiker:bit serialWrite failed", e));
          }
        }
        setTimeout(poll, kQueryPollMs);
      };
      poll();
    });
  }

  // Both lines go in one write, so the "?" reaches the board right behind the "!!". The "!!"
  // carries a checksum, like every command Dataflow sends except the "?". Async so that a
  // serialWrite that throws before returning a promise rejects instead.
  private async writeResetAndQuery() {
    this.lastDataAt = Date.now();
    this.shortReadAt = undefined;
    await this.connection.serialWrite(`${withChecksum(`!! #${this.resetSeq++}`)}\n?\n`);
  }
}
