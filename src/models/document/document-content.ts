import { Instance, SnapshotIn } from "mobx-state-tree";
import { DocumentContentModelWithAnnotations } from "./document-content-with-annotations";

/**
 * The DocumentContentModel is the combination of 3 parts:
 * - BaseDocumentContentModel
 * - DocumentContentModelWithTileDragging
 * - DocumentContentModelWithAnnotations
 *
 * These three parts were split out so we could reduce the size of a single
 * document content model file. This splitting is constrained by a couple
 * of factors:
 * - the code needs to support actions that can apply "atomically" to the
 *   MST tree. This requires the actions are defined on a model in the tree.
 * - the code in each split out part should be able to use Typescript to
 *   to make sure it is working with the core or base document content model
 *   correctly.
 *
 * In the future it might make sense to switch to a types.compose(...) approach
 * this way multiple document content features can be put in different files
 * without having each feature depend on another feature.
 *
 * Note: the name "DocumentContent" is important because it is used in other
 * parts of the code to find a MST parent with this name.
 */
export const DocumentContentModel = DocumentContentModelWithAnnotations.named("DocumentContent");

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
export type DocumentContentSnapshotType = SnapshotIn<typeof DocumentContentModel>;

export function cloneContentWithUniqueIds(content?: DocumentContentModelType,
                                          asTemplate?: boolean): DocumentContentModelType | undefined {
  return content && DocumentContentModel.create(content.snapshotWithUniqueIds(asTemplate));
}
