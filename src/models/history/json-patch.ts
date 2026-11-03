import { compare } from "fast-json-patch";
import { cloneDeep } from "lodash";
import { IJsonPatch } from "mobx-state-tree";

/**
 * Plain-JSON patch application and diffing, for the JSON copies of documents that history
 * playback keeps alongside the MST tree.
 *
 * `applyJsonPatches` matches how MST applies recorded patches, which is looser than RFC 6902:
 * - An empty path throws.
 * - Path segments are JSON-pointer unescaped (`~1` is `/`, `~0` is `~`).
 * - The parent must resolve to an object or an array, or the call throws.
 * - On an object parent, `add` and `replace` set the member, even if it is missing (MST does
 *   this for `types.maybe` props). A value of `undefined` deletes the member. `remove` deletes
 *   the member, and removing a missing member is a no-op.
 * - On an array parent, `add` inserts at an index from 0 to the length, or at `-`. `replace`
 *   and `remove` need an index less than the length. Anything else throws.
 */
export class JsonPatchError extends Error {
  readonly numApplied: number;
  readonly cause: unknown;

  constructor(message: string, numApplied: number, cause?: unknown) {
    super(message);
    this.name = "JsonPatchError";
    this.numApplied = numApplied;
    this.cause = cause;
  }
}

function unescapeSegment(segment: string) {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function applyJsonPatch(doc: object, patch: IJsonPatch) {
  if (!patch.path) throw new Error("patch has an empty path");

  const segments = patch.path.split("/").slice(1).map(unescapeSegment);
  const key = segments.pop() as string;
  let parent: any = doc;
  for (const segment of segments) {
    parent = parent != null && typeof parent === "object" ? parent[segment] : undefined;
  }
  if (parent == null || typeof parent !== "object") {
    throw new Error(`parent of ${patch.path} does not resolve to an object or array`);
  }

  // History patch values are frozen, so inserted values are cloned.
  const value = cloneDeep(patch.value);

  if (Array.isArray(parent)) {
    const isEnd = patch.op === "add" && key === "-";
    const index = isEnd ? parent.length : Number(key);
    if (!isEnd && !/^\d+$/.test(key)) throw new Error(`invalid array index in ${patch.path}`);
    if (patch.op === "add") {
      if (index > parent.length) throw new Error(`array index out of range in ${patch.path}`);
      parent.splice(index, 0, value);
    } else {
      if (index >= parent.length) throw new Error(`array index out of range in ${patch.path}`);
      if (patch.op === "replace") parent[index] = value;
      else parent.splice(index, 1);
    }
  } else if (patch.op === "remove" || value === undefined) {
    delete parent[key];
  } else {
    parent[key] = value;
  }
}

/**
 * Applies `patches` to `doc` in place. Throws a `JsonPatchError` at the first patch that
 * fails; the patches before it stay applied, and `numApplied` counts them.
 */
export function applyJsonPatches(doc: object, patches: readonly IJsonPatch[]) {
  patches.forEach((patch, i) => {
    try {
      applyJsonPatch(doc, patch);
    } catch (e) {
      throw new JsonPatchError(`Failed to apply patch ${i}: ${(e as Error).message}`, i, e);
    }
  });
}

/** Returns a deep copy of `value` containing only JSON-representable data. */
export function toJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Returns patches that turn `before` into `after`, with `basePath` prepended to each path.
 */
export function diffJson(before: unknown, after: unknown, basePath: string): IJsonPatch[] {
  const operations = compare(toJsonValue(before) as object, toJsonValue(after) as object);
  return operations.map(operation => ({ ...operation, path: `${basePath}${operation.path}` }) as IJsonPatch);
}
