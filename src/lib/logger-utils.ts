import { DocumentModelType } from "../models/document/document";
import { SectionModelType } from "../models/curriculum/section";
import { DocumentsModelType } from "../models/stores/documents";
import { ProblemModelType } from "../models/curriculum/problem";

type ModelTypeUnion = DocumentModelType | SectionModelType | null;

/** Subset of IStores needed to resolve a tile to one of the user's documents. */
export interface IDocumentLookupContext extends Record<string, any> {
  documents: DocumentsModelType;
  networkDocuments: DocumentsModelType;
}

/** Subset of IStores needed to resolve a tile to a curriculum section. */
export interface ICurriculumLookupContext extends Record<string, any> {
  problem: ProblemModelType;
  teacherGuide?: ProblemModelType;
}

/** Context for callers that may need either kind of lookup. */
export type IDocumentContext = IDocumentLookupContext & ICurriculumLookupContext;

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

/**
 * Resolve the document a log event refers to, along with the tile details derived from it.
 * A tile-only lookup is used when no documentId was supplied; when one was, a miss stays a
 * miss so callers keep reporting the document they were actually asked about.
 */
export function resolveTileLogContext(params: IDocumentEventParams, context?: IDocumentLookupContext) {
  const { documentId, tileId } = params;
  let document: DocumentModelType | undefined | null = params.document;
  if (!document && documentId) {
    document = context?.documents?.getDocument(documentId) || context?.networkDocuments?.getDocument(documentId);
  }
  if (!document && !documentId && tileId) {
    document = context?.documents?.findDocumentOfTile(tileId) ||
                context?.networkDocuments?.findDocumentOfTile(tileId);
  }

  const sectionId = tileId && document?.content?.getSectionIdForTile(tileId);
  const tileTitle = tileId && getTileTitleForLogging(tileId, document);
  const tileType = tileId && document?.content?.getTileType(tileId);

  return { document, sectionId, tileTitle, tileType };
}
