import { DocumentType, ProblemDocument } from "../../models/document/document-types";
import { DocumentModelSnapshotType } from "../../models/document/document";
import { DocumentContentSnapshotType } from "../../models/document/document-content";
import { TextContentModelType } from "../../models/tiles/text/text-content";

export const defaultDocumentModelParts: DocumentModelSnapshotType = {
  type: ProblemDocument as DocumentType,
  title: "test",
  uid: "1",
  key: "test",
  createdAt: 1,
  visibility: "public",
};

const rowId = "row1";
const tileId = "tile1";
export const defaultDocumentContent: DocumentContentSnapshotType = {
  rowMap: {
    [rowId]: {
      id: rowId,
      tiles: [{ tileId }]
    }
  },
  rowOrder: [
    rowId
  ],
  tileMap: {
    [tileId]: {
      id: tileId,
      content: {
        type: "Text",
        text: "Welcome to the standalone document editor"
      } as TextContentModelType
    }
  }
};

export const defaultDocumentModel: DocumentModelSnapshotType = {
  ...defaultDocumentModelParts,
  content: defaultDocumentContent
};
