import { IStores } from "../../../../models/stores/stores";

/**
 * Removes any arrow annotations whose source or target endpoint references the given
 * chip. Called whenever a chip is removed — via the unhighlight toolbar button, or by
 * editing the text out from under it. Supports both highlight chips and variable chips;
 * the caller passes the appropriate `chipType` constant.
 *
 * @param stores - Application stores, used to look up the document containing the tile.
 * @param tileId - The id of the text tile whose chip is being removed.
 * @param chipId - For highlights, the chip's `highlightId`; for variables, the chip's
 *                 `reference`.
 * @param chipType - `kHighlightFormat` or `kVariableFormat`.
 */
export function removeAnnotationsForChip(
  stores: IStores | null | undefined,
  tileId: string | undefined,
  chipId: string,
  chipType: string
) {
  if (!stores?.documents || !tileId) return;
  const document = stores.documents.findDocumentOfTile(tileId);
  if (!document?.content) return;
  const annotationsToRemove = new Set<string>();
  document.content.annotations.forEach(annotation => {
    if (annotation.sourceObject?.objectId === chipId
        && annotation.sourceObject?.objectType === chipType) {
      annotationsToRemove.add(annotation.id);
    }
    if (annotation.targetObject?.objectId === chipId
        && annotation.targetObject?.objectType === chipType) {
      annotationsToRemove.add(annotation.id);
    }
  });
  annotationsToRemove.forEach(annotationId => {
    document.content?.deleteAnnotation(annotationId);
  });
}
