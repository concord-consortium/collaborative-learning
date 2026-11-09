import { cloneDeep } from "lodash";
import { applyJsonPatches, unescapeSegment } from "./json-patch";
import { convertOldModelJsonAtPath, isNonCurrentModelJsonAtPath } from "./schema-conversion";
import { getEntryPatchesForTree, HistoryEntryType, HistoryOperation } from "./history";

export interface IJsonCopyMoveResult {
  position: number;
  failure?: { historyIndex: number; direction: "undo" | "redo"; message: string };
}

/**
 * A plain JSON copy of a document that history playback keeps beside the MST trees. Every entry
 * a move crosses, load entries included, is applied to the copy, so it can say where the move has
 * to stop and which models are old there. It never touches an MST tree.
 */
export class JsonHistoryCopy {
  private json: object;
  private _position: number;
  // Each model's conversion at the copy's position, kept until the copy moves.
  private convertedModels = new Map<string, { converted?: unknown; failed?: boolean; error?: unknown }>();

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
      const segment = unescapeSegment(rawSegment);
      if (value == null || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, segment)) {
        return undefined;
      }
      value = value[segment];
    }
    return value;
  }

  /**
   * The model at `modelPath` converted to the current format when it is old at the copy's
   * position, or undefined when it isn't: it isn't in the copy, its version is current, its type
   * has none, or its converter declines it. A clone is converted: a converter may be shallow, so
   * its result can share nested objects with its input, and the copy's objects must never reach
   * MST. Each model is converted at most once per position, and one whose conversion throws throws
   * again each time.
   */
  getConvertedModel(modelPath: string): unknown {
    let result = this.convertedModels.get(modelPath);
    if (!result) {
      const json = this.getJson(modelPath);
      try {
        result = {
          converted: isNonCurrentModelJsonAtPath(modelPath, json)
            ? convertOldModelJsonAtPath(modelPath, cloneDeep(json))
            : undefined
        };
      } catch (error) {
        result = { failed: true, error };
      }
      this.convertedModels.set(modelPath, result);
    }
    if (result.failed) throw result.error;
    return result.converted;
  }

  /**
   * True when the model at `modelPath` needs conversion at the copy's position (see
   * modelJsonNeedsConversion). A model whose conversion throws needs conversion; getConvertedModel
   * throws for it where the caller can report the failure.
   */
  needsConversion(modelPath: string): boolean {
    try {
      return this.getConvertedModel(modelPath) !== undefined;
    } catch {
      return true;
    }
  }

  /**
   * Applies entries one at a time, in the same direction and record order as
   * `goToHistoryEntryPosition`. An entry that fails is left unapplied (applyJsonPatches applies
   * all of an entry's patches or none), and the move stops there.
   */
  moveTo(history: readonly HistoryEntryType[], target: number): IJsonCopyMoveResult {
    this.convertedModels.clear();
    const forward = target > this._position;
    const opType = forward ? HistoryOperation.Redo : HistoryOperation.Undo;
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
