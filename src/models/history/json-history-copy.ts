import { IJsonPatch } from "mobx-state-tree";
import { applyJsonPatches, diffJson, JsonPatchError } from "./json-patch";
import { getEntryPatchesForTree, HistoryEntryType, HistoryOperation } from "./history";
import { IVirtualConversion } from "./history-bridges";

export interface IJsonCopyMoveResult {
  position: number;
  failure?: { historyIndex: number; direction: "undo" | "redo"; message: string };
  // the move stopped at a virtual conversion that can't be crossed backward
  unavailable?: boolean;
}

interface ICopyConversion extends IVirtualConversion {
  // computed the first time the conversion is crossed backward
  forward?: IJsonPatch[];
  inverse?: IJsonPatch[];
  // the model wasn't in the copy when the conversion was crossed backward
  modelMissing?: boolean;
}

/**
 * A plain JSON copy of a document that history playback keeps beside the MST trees. Every
 * history entry, conversion entries included, is applied to the copy, so the copy can say
 * where a move has to stop. It never touches an MST tree.
 */
export class JsonHistoryCopy {
  private json: object;
  private _position: number;
  private conversions: ICopyConversion[] = [];

  constructor(private treeId: string, documentJson: object, position: number) {
    this.json = documentJson;
    this._position = position;
  }

  get position() {
    return this._position;
  }

  /**
   * Sets the conversions history never recorded. A conversion with the same path and position
   * as one already set keeps the patches computed for it.
   */
  setVirtualConversions(conversions: readonly IVirtualConversion[]) {
    const previous = this.conversions;
    this.conversions = conversions.map(conversion => {
      const match = previous.find(p => p.path === conversion.path && p.position === conversion.position);
      return match
        ? { ...conversion, forward: match.forward, inverse: match.inverse, modelMissing: match.modelMissing }
        : { ...conversion };
    });
  }

  /**
   * The oldest position the copy can reach: the largest position of a virtual conversion it
   * can't cross backward, or 0.
   */
  get oldestReachablePosition() {
    return this.conversions.reduce((oldest, conversion) =>
      isUncrossable(conversion) ? Math.max(oldest, conversion.position) : oldest, 0);
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
      // Going backward, the conversions at the position being left are undone first.
      if (!forward && !this.crossConversionsBackward(i + 1)) {
        return { position: this._position, unavailable: true };
      }
      const entry = history[i];
      if (!entry) {
        this._position = forward ? i + 1 : i;
        if (forward) this.crossConversionsForward(i + 1);
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
        // The copy stays where it was, after the conversions there.
        if (!forward) this.crossConversionsForward(i + 1);
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
      if (forward) this.crossConversionsForward(i + 1);
    }
    return { position: this._position };
  }

  private conversionsAt(position: number) {
    return this.conversions.filter(conversion => conversion.position === position);
  }

  /**
   * Returns the copy at `position` to the old format by applying the inverse of each conversion
   * there, computing it on the first crossing. Returns false, changing nothing, when one of them
   * can't be crossed.
   */
  private crossConversionsBackward(position: number) {
    const conversions = this.conversionsAt(position);
    conversions.forEach(conversion => {
      if (!conversion.inverse && this.getJson(conversion.path) === undefined) conversion.modelMissing = true;
    });
    if (conversions.some(isUncrossable)) return false;

    [...conversions].reverse().forEach(conversion => {
      if (!conversion.inverse) {
        const current = this.getJson(conversion.path);
        conversion.inverse = diffJson(current, conversion.oldJson, conversion.path);
        conversion.forward = diffJson(conversion.oldJson, current, conversion.path);
      }
      applyJsonPatches(this.json, conversion.inverse);
    });
    return true;
  }

  /**
   * Converts the copy at `position` again with each conversion's forward patches. A conversion
   * that was never crossed backward has none, and is skipped.
   */
  private crossConversionsForward(position: number) {
    this.conversionsAt(position).forEach(conversion => {
      if (conversion.forward) applyJsonPatches(this.json, conversion.forward);
    });
  }
}

function isUncrossable(conversion: ICopyConversion) {
  return conversion.oldJson === undefined || !!conversion.modelMissing;
}
