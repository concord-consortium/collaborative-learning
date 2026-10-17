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

function logDeviceEvent(tileId: string, operation: string, device: string | undefined) {
  logTileChangeEvent(LogEventName.DATAFLOW_TOOL_CHANGE, {
    tileId, operation, change: { targetType: "device", device }
  });
}

/**
 * Clears the running state of this tile's program. Recorded data, blocks, connections and
 * settings are left alone.
 */
export function resetProgramForTile({ content, tileId, trigger }: ITileOptions & { trigger: ResetTrigger }) {
  content.program.resetRunningState();
  logTileChangeEvent(LogEventName.DATAFLOW_TOOL_CHANGE, {
    tileId, operation: "resetProgram", change: { targetType: "program", trigger }
  });
}

export async function connectDeviceForTile(o: IConnectionOptions & { choice: DeviceChoice }): Promise<ConnectResult> {
  const { connection, content, tileId, choice } = o;
  const result = await connection.connect(choice);
  if (result === "connected") {
    logDeviceEvent(tileId, "connectDevice", labelFor(choice));
    resetProgramForTile({ content, tileId, trigger: "connect" });
  }
  return result;
}

export async function reconnectDeviceForTile(o: IConnectionOptions): Promise<ConnectResult> {
  const { connection, content, tileId } = o;
  const label = labelFor(connection.lastChoice);
  const result = await connection.reconnect();
  if (result === "connected") {
    logDeviceEvent(tileId, "reconnectDevice", label);
    resetProgramForTile({ content, tileId, trigger: "reconnect" });
  }
  return result;
}

/** Disconnects the app-wide device. The program is not reset. */
export async function disconnectDeviceForTile(o: IConnectionOptions): Promise<void> {
  const { connection, tileId } = o;
  if (!connection.isConnected) return;
  const label = labelFor(connection.lastChoice);
  await connection.disconnect();
  logDeviceEvent(tileId, "disconnectDevice", label);
}
