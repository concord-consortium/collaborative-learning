import { IAnyStateTreeNode, getParent, getType, hasParent, types } from "mobx-state-tree";
import { DocumentContentModelType } from "../models/document/document-content";

/**
 * This creates the definition for a type field in MST.
 * The field is optional so it doesn't have to be specified when creating
 * an instance.
 *
 * @param typeName the type
 * @returns
 */
export function typeField(typeName: string) {
  return types.optional(types.literal(typeName), typeName);
}

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
