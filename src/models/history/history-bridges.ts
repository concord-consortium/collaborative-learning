import { HistoryEntryType } from "./history";

/**
 * A conversion that a document's history doesn't record: one made before load entries were
 * recorded, or in a concurrent document, which doesn't record them yet. Playback's JSON copy
 * crosses it like a load entry.
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
  /**
   * Whether the entries from `previousLength` on, appended to a history whose first
   * `previousLength` entries gave `conversions`, can change the conversions. When it returns
   * false the earlier result is kept, so a growing history isn't scanned again on every entry.
   * A bridge without it is asked for the whole history again.
   */
  appendChangesConversions?(history: readonly HistoryEntryType[], previousLength: number, treeId: string,
    conversions: readonly IVirtualConversion[]): boolean;
}

const bridges: IHistoryBridge[] = [];

export function registerHistoryBridge(bridge: IHistoryBridge) {
  bridges.push(bridge);
}

export function getHistoryBridges(): readonly IHistoryBridge[] {
  return bridges;
}
