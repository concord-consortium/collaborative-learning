import { HistoryEntryType } from "./history";

/**
 * A conversion that a document's history never recorded, because the model was converted
 * before conversion entries existed. Playback's JSON copy crosses it like a conversion entry.
 */
export interface IVirtualConversion {
  // a model path, such as `/content/tileMap/<tileId>`
  path: string;
  // the conversion sits between entry position-1 and entry position
  position: number;
  // the model's old JSON just before the conversion; undefined when it can't be rebuilt
  oldJson: unknown;
}

/**
 * Lets a plugin find the conversions that a document's history never recorded. Playback can't
 * go back past a conversion whose old JSON the bridge can't rebuild.
 */
export interface IHistoryBridge {
  findVirtualConversions(history: readonly HistoryEntryType[], treeId: string): IVirtualConversion[];
}

const bridges: IHistoryBridge[] = [];

export function registerHistoryBridge(bridge: IHistoryBridge) {
  bridges.push(bridge);
}

export function getHistoryBridges(): readonly IHistoryBridge[] {
  return bridges;
}
