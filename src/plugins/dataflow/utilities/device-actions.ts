import { when } from "mobx";
import { isAlive } from "mobx-state-tree";
import { LogEventName } from "../../../lib/logger-types";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { DataflowContentModelType } from "../model/dataflow-content";
import { uniqueId } from "../../../utilities/js-utils";
import { IConnectFailure, kStallKinds } from "../model/connect-failures";
import { ConnectionAttempt } from "../model/connection-attempt";
import {
  ConnectResult, DeviceChoice, DeviceConnection, IAttemptListener, IAttemptOptions
} from "../model/device-connection";

export type ResetTrigger = "connect" | "reconnect" | "button";

interface ITileOptions {
  content: DataflowContentModelType;
  tileId: string;
}

interface IConnectionOptions extends ITileOptions {
  connection: DeviceConnection;
}

// The first connectProgress checkpoint, in ms after the click. Each later one comes twice as late.
export const kCheckpointStartMs = 5000;

export function newAttemptId() {
  return uniqueId();
}

// Logs the device choice's id, not its label, so rewording a label doesn't change the logged value.
function logDeviceEvent(
  tileId: string, operation: string, device: DeviceChoice | undefined, details: object = {}
) {
  logTileChangeEvent(LogEventName.DATAFLOW_TOOL_CHANGE, {
    tileId, operation, change: { targetType: "device", device, ...details }
  });
}

/**
 * Clears the running state of this tile's program. Recorded data, blocks, block connections and
 * settings are left alone.
 */
export function resetProgramForTile({ content, tileId, trigger }: ITileOptions & { trigger: ResetTrigger }) {
  content.program.resetRunningState();
  logTileChangeEvent(LogEventName.DATAFLOW_TOOL_CHANGE, {
    tileId, operation: "resetProgram", change: { targetType: "program", trigger }
  });
}

function attemptDetails(attempt: ConnectionAttempt) {
  return { attemptId: attempt.id, trigger: attempt.trigger, steps: attempt.steps };
}

/**
 * Logs `connectProgress` 5, 10, 20, 40... s after the click while the attempt runs. Returns a
 * function that stops the checkpoints.
 */
function startCheckpoints(tileId: string, attempt: ConnectionAttempt) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduleAt = (checkpointMs: number) => {
    // Measured against the clock, so a late timer doesn't push the later checkpoints off.
    timer = setTimeout(() => {
      timer = undefined;
      if (attempt.ended) return;
      logDeviceEvent(tileId, "connectProgress", attempt.choice, {
        ...attemptDetails(attempt), elapsedMs: attempt.elapsedMs, step: attempt.step,
        updatePercent: attempt.step === "update" ? attempt.updatePercent : undefined
      });
      scheduleAt(checkpointMs * 2);
    }, Math.max(0, checkpointMs - attempt.elapsedMs));
  };
  scheduleAt(kCheckpointStartMs);
  return () => clearTimeout(timer);
}

// A failure is shown in the palette. A user looking at the palette sees it there, so only a closed
// palette leaves it unseen.
function recordFailure(content: DataflowContentModelType, failure: IConnectFailure) {
  content.setConnectFailure(failure);
  content.setUnseenConnectError(!content.connectPaletteOpen);
}

/**
 * Runs one attempt for the tile: logs it from the click to its result, resets the program when the
 * device becomes active and records the failure the tile's palette shows. A tile deleted meanwhile is
 * left alone, but the attempt is still logged under its id.
 */
async function runAttempt(
  o: IConnectionOptions & { trigger: "connect" | "reconnect"; device: DeviceChoice | undefined },
  start: (options: IAttemptOptions) => Promise<ConnectResult>
): Promise<ConnectResult> {
  const { connection, content, tileId, trigger, device } = o;
  const attemptId = newAttemptId();
  let stopCheckpoints: (() => void) | undefined;
  let stopResetWatch: (() => void) | undefined;
  const alive = () => isAlive(content);

  const listener: IAttemptListener = {
    onEnded: attempt => {
      stopCheckpoints?.();
      // A stalled device can still become active, so its reset stays armed.
      if (!attempt.outcome || !(kStallKinds as readonly string[]).includes(attempt.outcome)) stopResetWatch?.();
      const { outcome, failure, firmware } = attempt;
      logDeviceEvent(tileId, "connectResult", attempt.choice, {
        ...attemptDetails(attempt), outcome, elapsedMs: attempt.elapsedMs,
        failedStep: failure?.step, error: failure?.error, firmware
      });
      if (failure && alive()) recordFailure(content, failure);
    },
    onRecovered: attempt => {
      stopResetWatch?.();
      logDeviceEvent(tileId, "connectRecovered", attempt.choice, {
        attemptId: attempt.id, elapsedMs: attempt.elapsedMs, steps: attempt.steps
      });
      if (alive()) content.clearConnectFailure();
    },
    onStallChanged: (_attempt, failure) => {
      if (!alive()) return;
      if (failure) recordFailure(content, failure);
      else content.clearConnectFailure();
    },
    onAbandonedOpen: (attempt, info) => {
      logDeviceEvent(tileId, "abandonedOpen", attempt.choice, { attemptId: attempt.id, ...info });
    },
    onLost: (attempt, reason) => {
      stopResetWatch?.();
      logDeviceEvent(tileId, "deviceLost", attempt.choice, { attemptId: attempt.id, reason });
      if (!alive()) return;
      // A stalled update whose flash fails later leaves the connection with that failure to show.
      // Any other loss shows as the loss, so a stall's failure goes.
      const { lastFailure } = connection;
      if (reason === "updateFailed" && lastFailure) recordFailure(content, lastFailure);
      else content.clearConnectFailure();
    }
  };

  content.clearConnectFailure();
  logDeviceEvent(tileId, trigger === "connect" ? "connectDevice" : "reconnectDevice", device, { attemptId });
  const result = start({ attemptId, listener });

  // The attempt exists as soon as connect or reconnect is called, unless nothing was started.
  const started = connection.attempt;
  if (started?.id === attemptId) {
    stopCheckpoints = startCheckpoints(tileId, started);
    // A stalled attempt's watch outlives the attempt, so it also ends once a newer attempt replaces
    // it, after which this attempt's board can't become active.
    const replaced = () => connection.attempt !== started;
    stopResetWatch = when(() => started.steps.active !== undefined || replaced(), () => {
      if (!replaced() && alive()) resetProgramForTile({ content, tileId, trigger });
    });
  }

  const finalOutcome = await result;
  stopCheckpoints?.();
  return finalOutcome;
}

export function connectDeviceForTile(o: IConnectionOptions & { choice: DeviceChoice }): Promise<ConnectResult> {
  const { connection, choice } = o;
  // A refused click starts nothing, so it logs nothing and leaves the tile's failure showing.
  if (connection.busyChoice) return Promise.resolve("canceled");
  return runAttempt({ ...o, trigger: "connect", device: choice },
    options => connection.connect(choice, options));
}

export function reconnectDeviceForTile(o: IConnectionOptions): Promise<ConnectResult> {
  const { connection } = o;
  if (connection.busyChoice || !connection.lastChoice) return Promise.resolve("canceled");
  return runAttempt({ ...o, trigger: "reconnect", device: connection.lastChoice },
    options => connection.reconnect(options));
}

/**
 * Disconnects the app-wide device, which includes a board a stalled Spiker:bit update holds open
 * without it being the active device. The program is not reset; the tile's connect failure is
 * cleared.
 */
export async function disconnectDeviceForTile(o: IConnectionOptions): Promise<void> {
  const { connection, content, tileId } = o;
  if (!connection.isConnected && connection.paletteView !== "actions") return;
  content.clearConnectFailure();
  const choice = connection.lastChoice;
  await connection.disconnect();
  logDeviceEvent(tileId, "disconnectDevice", choice);
}
