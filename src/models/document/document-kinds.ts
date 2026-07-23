import { IDocumentMetadata } from "../../../shared/shared";
import { GroupDocument } from "./document-types";

/** The stored metadata axis fields a kind stamps onto its documents. This grows as more axes become
 *  kind-derived; the stamp sites splat it verbatim, so they don't change when it grows. */
export type IDocumentKindMetadataFields = Pick<IDocumentMetadata, "kind" | "concurrent">;

export interface IDocumentKindInfo {
  /** The kind key. Matches the value stored in a document's `kind` field. */
  kind: string;
  /** The metadata axis fields stamped onto this kind's documents at creation (and backfilled on open).
   *  The `kind` field itself is added automatically by getDocumentKindMetadataFields, so it is not
   *  repeated here. */
  metadataFields: Omit<IDocumentKindMetadataFields, "kind">;
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

// Built-in kinds. The group document is the first concurrent kind; the DQB / word-wall register later
// (Stage 2). `kind` deliberately equals the `type` value "group".
registerDocumentKind({ kind: GroupDocument, metadataFields: { concurrent: true } });
