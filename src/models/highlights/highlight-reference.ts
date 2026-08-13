// Resolvers only need to walk the document's tiles, so they take the base content model.
import type { BaseDocumentContentModelType } from "../document/base-document-content";

/**
 * A resolved, concrete thing a tile can render emphasis on.
 */
export interface IHighlightTarget {
  tileId: string;
  objectId: string;
  objectType?: string;
}

/**
 * A reference to something that should be highlighted. Deliberately NOT named
 * TileReference/TileObjectReference: the "variable" kind carries no tileId and resolves
 * across multiple tiles, and a future "textRange" kind is not an object in CLUE's sense
 * (ClueObject / annotatableObjects all mean a discrete addressable thing with an id).
 */
export type HighlightReference =
  | { kind: "object"; tileId: string; objectId: string; objectType?: string }
  | { kind: "variable"; variableId: string };

export type ReferenceResolver =
  (ref: HighlightReference, content: BaseDocumentContentModelType) => IHighlightTarget[];

const gResolvers = new Map<HighlightReference["kind"], ReferenceResolver>();

export function registerReferenceResolver(
  kind: HighlightReference["kind"], resolver: ReferenceResolver
) {
  gResolvers.set(kind, resolver);
}

/**
 * Resolve a reference to its targets. Fails quiet: an unknown kind yields no targets.
 */
export function resolveHighlightReference(
  ref: HighlightReference, content: BaseDocumentContentModelType
): IHighlightTarget[] {
  return gResolvers.get(ref.kind)?.(ref, content) ?? [];
}

/**
 * Internal key for the resolved-target set. Dataflow node ids are nanoid(16), whose alphabet
 * excludes "/", so the separator is unambiguous for the ids handled today. A future kind
 * whose object ids may contain "/" needs a structural key instead.
 */
export function highlightTargetKey(tileId: string, objectId: string) {
  return `${tileId}/${objectId}`;
}

export function sameHighlightReference(a: HighlightReference, b: HighlightReference) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "variable" && b.kind === "variable") return a.variableId === b.variableId;
  if (a.kind === "object" && b.kind === "object") {
    return a.tileId === b.tileId && a.objectId === b.objectId;
  }
  return false;
}

registerReferenceResolver("object", ref => {
  if (ref.kind !== "object") return [];
  return [{ tileId: ref.tileId, objectId: ref.objectId, objectType: ref.objectType }];
});

registerReferenceResolver("variable", (ref, content) => {
  if (ref.kind !== "variable") return [];
  const targets: IHighlightTarget[] = [];
  content.tileMap.forEach(tile => {
    // Tiles opt in by implementing getObjectsForVariable; the rest are skipped. The cast is
    // needed because tile.content is the union of every registered tile content model.
    const tileContent = tile.content as any;
    const objects = tileContent?.getObjectsForVariable?.(ref.variableId);
    objects?.forEach((object: { objectId: string; objectType?: string }) => {
      targets.push({ tileId: tile.id, objectId: object.objectId, objectType: object.objectType });
    });
  });
  return targets;
});
