import { GroupDocument } from "../../models/document/document-types";

export interface ICanEditSortWorkDocumentParams {
  /** Document owner uid (prefer the reactive metadata value; fall back to the full document). */
  docUid?: string;
  /** Document type (prefer metadata; fall back to the full document). */
  docType?: string;
  /** Document groupId (prefer metadata; fall back to the full document). May be null for non-group docs. */
  docGroupId?: string | null;
  /** The current user's id. */
  userId?: string;
  /** The current user's group id (undefined if the user isn't in a group). */
  userGroupId?: string;
}

/**
 * Whether the Edit button should appear for a document in the Sort Work view: true when the current user
 * can edit the document — either it's their own document, or it's their own group's document (a group doc
 * created by any member of their group). Callers should pass fields sourced from the reactive document
 * metadata (falling back to the lazily-fetched full document) so the result updates as soon as a
 * groupmate's document syncs.
 */
export function canEditSortWorkDocument({
  docUid, docType, docGroupId, userId, userGroupId
}: ICanEditSortWorkDocumentParams): boolean {
  const isOwnDocument = !!docUid && docUid === userId;
  const isOwnGroupDoc = docType === GroupDocument && !!userGroupId && docGroupId === userGroupId;
  return isOwnDocument || isOwnGroupDoc;
}
