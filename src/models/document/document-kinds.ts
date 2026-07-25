import { IDocumentMetadata } from "../../../shared/shared";
import { GroupDocument } from "./document-types";

/** The stored metadata axis fields a kind stamps onto its documents. This grows as more axes become
 *  kind-derived; the stamp sites splat it verbatim, so they don't change when it grows. */
export type IDocumentKindMetadataFields = Pick<IDocumentMetadata, "kind" | "concurrent">;

/** How a kind's `owner` axis (authoring identity / provenance, stored as the document's `uid`) is derived
 *  at creation: "user" → the creating user; "group" → the synthetic group owner (`group_<off>_<grp>`);
 *  "class" → the synthetic class owner (`class_<classHash>`), shared by the whole class. Defaults to "user". */
export type DocumentOwnerScope = "user" | "group" | "class";

export interface IDocumentKindInfo {
  /** The kind key. Matches the value stored in a document's `kind` field. */
  kind: string;
  /** The metadata axis fields stamped onto this kind's documents at creation (and backfilled on open).
   *  The `kind` field itself is added automatically by getDocumentKindMetadataFields, so it is not
   *  repeated here. */
  metadataFields: Omit<IDocumentKindMetadataFields, "kind">;
  /** How this kind's owner uid is derived (see DocumentOwnerScope). Defaults to "user". */
  ownerScope?: DocumentOwnerScope;
}

/** The candidate owner uids for a document being created. The synthetic ones depend on runtime state
 *  (the user's group, the current unit), so the caller supplies them; getDocumentOwner selects among
 *  them by the kind's registered owner scope. */
export interface IDocumentOwnerContext {
  /** The creating user's own uid — the default owner. */
  userId: string;
  /** The synthetic group owner uid (`group_<off>_<grp>`), for group-scoped kinds. */
  groupOwnerId?: string;
  /** The synthetic class owner uid (`class_<classHash>`), for class-wide kinds. */
  classOwnerId?: string;
}

const gDocumentKindInfoMap: Record<string, IDocumentKindInfo> = {};

export function registerDocumentKind(info: IDocumentKindInfo) {
  gDocumentKindInfoMap[info.kind] = info;
}

export function getDocumentKindInfo(kind?: string|null) {
  return kind ? gDocumentKindInfoMap[kind] : undefined;
}

/** The stored metadata axis fields to stamp for a document of the given kind, including its own `kind`
 *  key. Empty for an unregistered kind. Splat directly into the Firestore metadata at creation and on
 *  the on-open backfill write, so both sites stay in sync as the field set grows. */
export function getDocumentKindMetadataFields(kind?: string|null): IDocumentKindMetadataFields {
  const info = getDocumentKindInfo(kind);
  if (!info) return {};
  return { kind: info.kind, ...info.metadataFields };
}

/** The owner scope registered for a kind (how its owner uid is derived); "user" for an unregistered kind. */
export function getDocumentOwnerScope(kind?: string|null): DocumentOwnerScope {
  return getDocumentKindInfo(kind)?.ownerScope ?? "user";
}

/** The owner uid to stamp on a new document of the given kind, chosen by the kind's registered owner scope
 *  from the runtime-supplied context. Falls back to the creating user when the synthetic owner a scope
 *  needs was not supplied. */
export function getDocumentOwner(kind: string|null|undefined, ctx: IDocumentOwnerContext): string {
  switch (getDocumentOwnerScope(kind)) {
    case "group": return ctx.groupOwnerId ?? ctx.userId;
    case "class": return ctx.classOwnerId ?? ctx.userId;
    default:      return ctx.userId;
  }
}

// Built-in kinds. The group document is the first concurrent kind; the DQB / word-wall register later
// (Stage 2). `kind` deliberately equals the `type` value "group"; its owner is the synthetic group user.
registerDocumentKind({ kind: GroupDocument, metadataFields: { concurrent: true }, ownerScope: "group" });
