import { VariableType } from "@concord-consortium/diagram-view";
import { ITileChangeLogEvent } from "../../../models/tiles/log/log-tile-change-event";
import { IStores } from "../../../models/stores/stores";
import { NodeChannelInfo } from "../model/utilities/channel";

export interface INodeServices {
  process(): void;
  logTileChangeEvent(event: Pick<ITileChangeLogEvent, "operation" | "change">): void;
  selectNode(nodeId: string): void;
  update(type: "node" | "connection" | "socket" | "control", id: string): void;
  isConnected(nodeId: string, inputKey: string): boolean;
  removeInputConnection(nodeId: string, inputKey: string): void;
  getOutputVariables(): VariableType[];
  getChannels(): NodeChannelInfo[];
  stores: IStores;
  runnable?: boolean;
  readOnly?: boolean;
  playback?: boolean;
}
