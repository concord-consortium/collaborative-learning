import { Instance, SnapshotIn } from "mobx-state-tree";
import { DocumentContentModelWithTileDragging } from "./drag-tiles";

// Easiest approach is just chain them together without abstraction
// I'm not sure but it might be possible to do composition so multiple
// concerns each using properties of BaseDocumentContentModel
// Are then combined in the DocumentContentModel
export const DocumentContentModel = DocumentContentModelWithTileDragging.named("DocumentContentModel");

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
export type DocumentContentSnapshotType = SnapshotIn<typeof DocumentContentModel>;

export function cloneContentWithUniqueIds(content?: DocumentContentModelType,
                                          asTemplate?: boolean): DocumentContentModelType | undefined {
  return content && DocumentContentModel.create(content.snapshotWithUniqueIds(asTemplate));
}
