import { DocumentModelType } from "../models/document/document";
import { SectionModelType } from "../models/curriculum/section";
import { getParentWithTypeName } from "../utilities/mst-utils";

type ModelTypeUnion = DocumentModelType | SectionModelType | null;

export const getTileTitleForLogging = (tileId: string, docOrSection?: ModelTypeUnion) => {
  return docOrSection?.content?.getTile(tileId)?.computedTitle ?? "<no title>";
};

/** If the tile is in a container tile, return the container's ID.
 * Otherwise undefined is returned.
 */
export const getTileContainerForLogging = (tileId: string, docOrSection?: ModelTypeUnion) => {
  const row = docOrSection?.content?.getRowForTile(tileId);
  if (row) {
    const container = getParentWithTypeName(row, "TileModel");
    return container?.id;
  }
  return undefined;
};
