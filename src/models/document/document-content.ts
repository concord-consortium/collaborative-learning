import { Instance, SnapshotIn } from "mobx-state-tree";
import { BaseDocumentContentModel } from "./base-document-content";

export const DocumentContentModel = BaseDocumentContentModel.named("DocumentContentModel");

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
export type DocumentContentSnapshotType = SnapshotIn<typeof DocumentContentModel>;

export function cloneContentWithUniqueIds(content?: DocumentContentModelType,
                                          asTemplate?: boolean): DocumentContentModelType | undefined {
  return content && DocumentContentModel.create(content.snapshotWithUniqueIds(asTemplate));
}
