import { isAlive } from "mobx-state-tree";
import { LogEventName } from "../../../lib/logger-types";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { DataflowContentModelType } from "../model/dataflow-content";
import { ConnectResult, DeviceChoice, DeviceConnection, kDeviceChoiceLabels } from "../model/device-connection";

export type ResetTrigger = "connect" | "reconnect" | "button";

interface ITileOptions {
  content: DataflowContentModelType;
  tileId: string;
}

interface IConnectionOptions extends ITileOptions {
  connection: DeviceConnection;
}

function labelFor(choice: DeviceChoice | undefined) {
  return choice ? kDeviceChoiceLabels[choice] : undefined;
}

// Logs the menu choice's id, not its label, so rewording a label doesn't change the logged value.
function logDeviceEvent(tileId: string, operation: string, device: DeviceChoice | undefined) {
  logTileChangeEvent(LogEventName.DATAFLOW_TOOL_CHANGE, {
    tileId, operation, change: { targetType: "device", device }
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

/** A user looking at the pane sees the error there, so only a closed pane leaves it unseen. */
function recordConnectFailure(content: DataflowContentModelType, label: string | undefined) {
  content.setConnectError(`Couldn't connect to ${label ?? "the device"}.`);
  content.setUnseenConnectError(!content.connectPaneOpen);
}

export async function connectDeviceForTile(o: IConnectionOptions & { choice: DeviceChoice }): Promise<ConnectResult> {
  const { connection, content, tileId, choice } = o;
  content.clearConnectError();
  const result = await connection.connect(choice);
  // The tile may have been deleted while the connection was being made.
  if (!isAlive(content)) return result;
  if (result === "failed") recordConnectFailure(content, labelFor(choice));
  if (result === "connected") {
    logDeviceEvent(tileId, "connectDevice", choice);
    resetProgramForTile({ content, tileId, trigger: "connect" });
  }
  return result;
}

export async function reconnectDeviceForTile(o: IConnectionOptions): Promise<ConnectResult> {
  const { connection, content, tileId } = o;
  const choice = connection.lastChoice;
  content.clearConnectError();
  const result = await connection.reconnect();
  if (!isAlive(content)) return result;
  if (result === "failed") recordConnectFailure(content, labelFor(choice));
  if (result === "connected") {
    logDeviceEvent(tileId, "reconnectDevice", choice);
    resetProgramForTile({ content, tileId, trigger: "reconnect" });
  }
  return result;
}

/** Disconnects the app-wide device. The program is not reset. */
export async function disconnectDeviceForTile(o: IConnectionOptions): Promise<void> {
  const { connection, content, tileId } = o;
  if (!connection.isConnected) return;
  content.clearConnectError();
  const choice = connection.lastChoice;
  await connection.disconnect();
  logDeviceEvent(tileId, "disconnectDevice", choice);
}
