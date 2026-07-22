import { GroupDocument } from "./document-types";

export interface IDocumentKindInfo {
  /** The kind key. Matches the value stored in a document's `kind` field. */
  kind: string;
  /** True when documents of this kind are multi-writer: concurrent history manager, class/group
   *  presence, and editable by non-owners. Stamped onto the Firestore metadata at creation. */
  concurrent?: boolean;
}

const gDocumentKindInfoMap: Record<string, IDocumentKindInfo> = {};

export function registerDocumentKind(info: IDocumentKindInfo) {
  gDocumentKindInfoMap[info.kind] = info;
}

export function getDocumentKindInfo(kind?: string|null) {
  return kind ? gDocumentKindInfoMap[kind] : undefined;
}

// Built-in kinds. The group document is the first concurrent kind; the DQB / word-wall register later
// (Stage 2). `kind` deliberately equals the `type` value "group".
registerDocumentKind({ kind: GroupDocument, concurrent: true });
