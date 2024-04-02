import { ITileChangeLogEvent } from "../../../models/tiles/log/log-tile-change-event";

export interface INodeServices {
  process(): void;
  logTileChangeEvent(event: Pick<ITileChangeLogEvent, "operation" | "change">): void;
  selectNode(nodeId: string): void;
  update(type: "node" | "connection" | "socket" | "control", id: string): void;
  isConnected(nodeId: string, inputKey: string): boolean;
  removeInputConnection(nodeId: string, inputKey: string): void;
}
