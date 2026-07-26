import { IDocumentMetadata } from "../../../shared/shared";
import { GroupDocument } from "./document-types";

/**
 * The metadata axis fields a kind stamps onto its documents (e.g. `concurrent`). Grows as more axes
 * become kind-derived; the stamp sites splat it verbatim, so they don't change as it grows.
 */
export type IDocumentKindMetadataFields = Pick<IDocumentMetadata, "kind" | "concurrent">;

export interface IDocumentKindInfo {
  /** The kind key. Matches the value stored in a document's `kind` field. */
  kind: string;
  /** This kind's stamped fields, without `kind` — getDocumentKindMetadataFields adds it back. */
  metadataFields: Omit<IDocumentKindMetadataFields, "kind">;
}

const gDocumentKindInfoMap: Record<string, IDocumentKindInfo> = {};

export function registerDocumentKind(info: IDocumentKindInfo) {
  gDocumentKindInfoMap[info.kind] = info;
}

export function getDocumentKindInfo(kind?: string|null) {
  return kind ? gDocumentKindInfoMap[kind] : undefined;
}

/** A kind's full stamp set (its metadataFields plus the `kind` key), or `{}` if the kind is unregistered. */
export function getDocumentKindMetadataFields(kind?: string|null): IDocumentKindMetadataFields {
  const info = getDocumentKindInfo(kind);
  if (!info) return {};
  return { kind: info.kind, ...info.metadataFields };
}

// Built-in kinds. The group document is the first concurrent kind.
registerDocumentKind({ kind: GroupDocument, metadataFields: { concurrent: true } });
