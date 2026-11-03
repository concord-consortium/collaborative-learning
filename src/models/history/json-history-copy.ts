import { applyJsonPatches, JsonPatchError } from "./json-patch";
import { getEntryPatchesForTree, HistoryEntryType, HistoryOperation } from "./history";

export interface IJsonCopyMoveResult {
  position: number;
  failure?: { historyIndex: number; direction: "undo" | "redo"; message: string };
}

/**
 * A plain JSON copy of a document that history playback keeps beside the MST trees. Every
 * history entry, conversion entries included, is applied to the copy, so the copy can say
 * where a move has to stop. It never touches an MST tree.
 */
export class JsonHistoryCopy {
  private json: object;
  private _position: number;

  constructor(private treeId: string, documentJson: object, position: number) {
    this.json = documentJson;
    this._position = position;
  }

  get position() {
    return this._position;
  }

  /**
   * Resolves a JSON-pointer path in the copy. An empty path is the whole document. Returns
   * undefined when any segment doesn't resolve. The result is the live internal object, not
   * a clone, so callers must treat it as read-only.
   */
  getJson(path: string): unknown {
    if (path === "") return this.json;
    let value: any = this.json;
    for (const rawSegment of path.split("/").slice(1)) {
      const segment = rawSegment.replace(/~1/g, "/").replace(/~0/g, "~");
      if (value == null || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, segment)) {
        return undefined;
      }
      value = value[segment];
    }
    return value;
  }

  /**
   * Applies entries one at a time, in the same direction and record order as
   * `goToHistoryEntryPosition`. An entry that fails is undone and left unapplied, and the
   * move stops there.
   */
  moveTo(history: readonly HistoryEntryType[], target: number): IJsonCopyMoveResult {
    const forward = target > this._position;
    const opType = forward ? HistoryOperation.Redo : HistoryOperation.Undo;
    const oppositeOp = forward ? HistoryOperation.Undo : HistoryOperation.Redo;
    const direction = forward ? 1 : -1;
    const start = forward ? this._position : this._position - 1;
    const end = forward ? target : target - 1;

    for (let i = start; i !== end; i += direction) {
      const entry = history[i];
      if (!entry) {
        this._position = forward ? i + 1 : i;
        continue;
      }
      const patches = getEntryPatchesForTree(entry, this.treeId, opType);
      try {
        applyJsonPatches(this.json, patches);
      } catch (error) {
        const numApplied = error instanceof JsonPatchError ? error.numApplied : 0;
        if (numApplied > 0) {
          // A rollback failure means the copy is corrupt, so it propagates.
          const opposite = getEntryPatchesForTree(entry, this.treeId, oppositeOp);
          applyJsonPatches(this.json, opposite.slice(-numApplied));
        }
        this._position = forward ? i : i + 1;
        return {
          position: this._position,
          failure: {
            historyIndex: i,
            direction: forward ? "redo" : "undo",
            message: error instanceof Error ? error.message : String(error)
          }
        };
      }
      this._position = forward ? i + 1 : i;
    }
    return { position: this._position };
  }
}
