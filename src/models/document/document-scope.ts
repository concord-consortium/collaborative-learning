/**
 * Guards over a document's stored scope association fields (`context_id`, `unit`, `investigation`,
 * `problem`, `offeringId`, `groupId`), stamped at creation from the kind's registered `scopeType`
 * (see document-kinds.ts).
 *
 * Each guard answers about one axis, reading only that axis's fields; a consumer needing a position on
 * more than one asks each. See docs/document-axes/reading-axes-in-code.md for the field-by-shape table
 * and what is not covered yet, and docs/document-axes/axes.md for what the axes mean.
 *
 * A guard reads stored fields only, never the kind registry: Sort Work lists documents from other
 * units, whose kinds are not registered in the current session.
 */

/** The scope fields the guards read. Structural, so this stays a leaf module. */
export interface IDocumentScopeFields {
  unit?: string | null;
  investigation?: string | null;
  problem?: string | null;
  offeringId?: string | null;
  groupId?: string | null;
}

/**
 * Owner scope: the document belongs to a single group, whoever created it.
 *
 * Only group-scoped documents carry a `groupId`; others leave it unset so a stale group id can never
 * be read back, since a user's group may change (see DocumentMetadataModel.groupId).
 */
export function hasGroupOwnerScope(doc: IDocumentScopeFields): doc is IDocumentScopeFields & { groupId: string } {
  return !!doc.groupId;
}

/**
 * Curriculum scope: the document belongs to a unit and nothing narrower.
 *
 * Both negative terms narrow this same dimension — an `investigation` directly, an `offeringId`
 * because an offering assigns one problem. It says nothing about who owns the document.
 */
export function hasUnitCurriculumScope(doc: IDocumentScopeFields): boolean {
  return !!doc.unit && !doc.investigation && !doc.offeringId;
}

/**
 * A short label for a document's curriculum scope: "sas-1.2" when it is scoped to a problem, "sas"
 * when it is scoped to a unit and nothing narrower, undefined when it has no unit at all.
 *
 * Callers use it as a stand-in when a document's real title cannot be resolved, so the coordinates
 * name the document instead. It reads the stored fields alone, so it describes a document from any
 * unit, including one whose config is not loaded.
 *
 * An investigation with no problem ("sas-1.x") is not a shape any registered scope type produces; it
 * is handled so a partial scope still reads as a scope rather than losing the investigation.
 */
export function getCurriculumScopeLabel(doc: IDocumentScopeFields): string | undefined {
  if (!doc.unit) return undefined;
  if (!doc.investigation) return doc.unit;
  return `${doc.unit}-${doc.investigation}.${doc.problem ?? "x"}`;
}
