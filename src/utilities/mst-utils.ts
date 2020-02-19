import { IAnyStateTreeNode, getParent, getType } from "mobx-state-tree";
import { DocumentContentModelType } from "../models/document/document-content";

/**
 * Returns an ancestor of a node whose type name is `typeName`, if any.
 * This is like `getParentOfType(target, type)`, but allows us not to refer directly to the
 * parent type, which can cause circular reference errors in MST.
 */
export function getParentWithTypeName(target: IAnyStateTreeNode, typeName: string): IAnyStateTreeNode | undefined {
  let parent: IAnyStateTreeNode | null = getParent(target);
  while (parent) {
      const type = getType(parent);
      if (type.name === typeName) return parent;
      parent = getParent(parent);
  }
  return undefined;
}

export function getContentIdFromNode(target: IAnyStateTreeNode) {
  const documentContent = getParentWithTypeName(target, "DocumentContent") as DocumentContentModelType;
  return documentContent?.contentId;
}

export function getTileContentById(target: IAnyStateTreeNode, tileId: string) {
  const documentContent = getParentWithTypeName(target, "DocumentContent") as DocumentContentModelType;
  return documentContent?.getTileContent(tileId);
}
