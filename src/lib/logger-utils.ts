import { DocumentModelType } from "../models/document/document";
import { SectionModelType } from "../models/curriculum/section";

type ModelTypeUnion = DocumentModelType | SectionModelType | null;

export const getTileTitleForLogging = (tileId: string, docOrSection?: ModelTypeUnion) => {
  return docOrSection?.content?.getTile(tileId)?.computedTitle ?? "<no title>";
};
