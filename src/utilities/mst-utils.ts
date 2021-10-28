import { IAnyStateTreeNode, getParent, getType, hasParent } from "mobx-state-tree";
import { DocumentContentModelType } from "../models/document/document-content";

/**
 * Returns an ancestor of a node whose type name is `typeName`, if any.
 * This is like `getParentOfType(target, type)`, but allows us not to refer directly to the
 * parent type, which can cause circular reference errors in MST.
 */
export function getParentWithTypeName(target: IAnyStateTreeNode, typeName: string): IAnyStateTreeNode | undefined {
  let current = target;
  while (hasParent(current)) {
      const parent = getParent(current);
      const type = getType(parent);
      if (type.name === typeName) return parent;
      current = parent;
  }
  return undefined;
}

export function getDocumentContentFromNode(target: IAnyStateTreeNode): DocumentContentModelType | undefined {
  return getParentWithTypeName(target, "DocumentContent") as DocumentContentModelType;
}

export function getContentIdFromNode(target: IAnyStateTreeNode) {
  return getDocumentContentFromNode(target)?.contentId;
}

export function getTileContentById(target: IAnyStateTreeNode, tileId: string) {
  return getDocumentContentFromNode(target)?.getTileContent(tileId);
}
