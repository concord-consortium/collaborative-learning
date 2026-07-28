/**
 * Guards over a document's stored scope association fields.
 *
 * A document's scope lives in its association fields (`context_id`, `unit`, `investigation`,
 * `problem`, `offeringId`, `groupId`), stamped at creation from the kind's registered `scopeType`
 * (see document-kinds.ts). Consumers that need a document's scope read it through these guards
 * rather than branching on `type` or looking `kind` up in the registry: a document listed in Sort
 * Work may belong to another unit whose kind is not registered in the current session, but its
 * stored fields are always present.
 *
 * These are narrow named predicates by design. Scope is multi-dimensional — a personal document is
 * class+owner scoped while a class-wide document is class+unit scoped — so a single ordered
 * "scope level" would be ambiguous. See docs/document-scope.md.
 */

/** The scope fields the guards read. Structural, so this stays a leaf module. */
export interface IDocumentScopeFields {
  unit?: string | null;
  investigation?: string | null;
  groupId?: string | null;
}

/**
 * True when the document is scoped to a single group.
 *
 * In Firestore metadata only group-scoped documents carry a `groupId`; other documents deliberately
 * leave it unset so a stale group id can never be read back (see DocumentMetadataModel.groupId).
 */
export function hasGroupScope(doc: IDocumentScopeFields): doc is IDocumentScopeFields & { groupId: string } {
  return !!doc.groupId;
}

/**
 * True when the document is scoped to a class and a unit and nothing narrower — a class-wide
 * collaborative document.
 *
 * No other stored shape matches: class-scoped documents (personal, learning log) have `unit: null`;
 * offering-scoped documents (problem, planning, publications) carry an `investigation`; group
 * documents carry both an `investigation` and a `groupId`; curriculum exemplars carry a `unit` but
 * also an `investigation`.
 */
export function hasClassUnitScope(doc: IDocumentScopeFields): boolean {
  return !!doc.unit && !doc.investigation && !doc.groupId;
}
