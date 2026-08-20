import { DocumentModelType } from "../models/document/document";
import { SectionModelType } from "../models/curriculum/section";
import { DocumentsModelType } from "../models/stores/documents";
import { ProblemModelType } from "../models/curriculum/problem";

type ModelTypeUnion = DocumentModelType | SectionModelType | null;

export interface IContext extends Record<string, any> {
  documents: DocumentsModelType;
  networkDocuments: DocumentsModelType;
  problem: ProblemModelType;
  teacherGuide?: ProblemModelType;
}

export const getTileTitleForLogging = (tileId: string, docOrSection?: ModelTypeUnion) => {
  return docOrSection?.content?.getTile(tileId)?.computedTitle ?? "<no title>";
};

/** If the tile is in a container tile, return the container's ID.
 * Otherwise undefined is returned.
 */
export const getTileContainerForLogging = (tileId: string, docOrSection?: ModelTypeUnion) => {
  const tile = docOrSection?.content?.getTileContainingTileId(tileId);
  return tile?.id;
};

export interface IDocumentEventParams {
  document?: DocumentModelType;
  documentId?: string;
  tileId?: string;
}

export function processDocumentEventParams(params: IDocumentEventParams, context?: IContext) {
  const { documentId, tileId } = params;
  let document: DocumentModelType | undefined | null = params.document;
  if (!document && documentId) {
    document = context?.documents.getDocument(documentId) || context?.networkDocuments.getDocument(documentId);
  }
  if (!document && tileId) {
    document = context?.documents.findDocumentOfTile(tileId) || context?.networkDocuments.findDocumentOfTile(tileId);
  }

  const sectionId = tileId && document?.content?.getSectionIdForTile(tileId);
  const tileTitle = tileId && getTileTitleForLogging(tileId, document);
  const tileType = tileId && document?.content?.getTileType(tileId);

  return { document, sectionId, tileTitle, tileType };
}
