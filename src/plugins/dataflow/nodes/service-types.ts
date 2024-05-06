import { VariableType } from "@concord-consortium/diagram-view";
import { ITileChangeLogEvent } from "../../../models/tiles/log/log-tile-change-event";
import { IStores } from "../../../models/stores/stores";
import { NodeChannelInfo } from "../model/utilities/channel";

export interface INodeServices {
  currentTick: string;
  recentTicks: string[];
  recordedTicks: string[];
  process(): void;
  logTileChangeEvent(event: Pick<ITileChangeLogEvent, "operation" | "change">): void;
  selectNode(nodeId: string): void;
  update(type: "node" | "connection" | "socket" | "control", id: string): void;
  isConnected(nodeId: string, inputKey: string): boolean;
  removeInputConnection(nodeId: string, inputKey: string): void;
  getOutputVariables(): VariableType[];
  getChannels(): NodeChannelInfo[];
  stores: IStores;
  /**
   * This will be true if dataflow is executing a sampling tick. It should be used by
   * node `data` methods to read data from sensors or variables, write data to
   * hardware or variables, generating data based on time.
   */
  inTick: boolean;
  readOnly?: boolean;
  playback?: boolean;
}
