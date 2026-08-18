/**
 * Guards over a document's stored axis fields (`uid`, `unit`, `investigation`, `problem`,
 * `offeringId`), stamped at creation from the kind's registered `ownerType` and `containerType`
 * (see document-kinds.ts).
 *
 * Each guard answers about one axis, reading only that axis's fields; a consumer needing a position on
 * more than one asks each. See docs/document-axes/reading-axes-in-code.md for the field-by-shape table
 * and what is not covered yet, and docs/document-axes/axes.md for what the axes mean.
 *
 * A guard reads stored fields only, never the kind registry: Sort Work lists documents from other
 * units, whose kinds are not registered in the current session.
 */

/**
 * The prefix of the synthetic uid that owns a group's documents, `group_<offeringId>_<groupId>`. Shared
 * by getGroupOwnerId, which mints the uid, and hasGroupOwner, which reads it back.
 */
export const kGroupOwnerPrefix = "group_";

/**
 * The prefix of the synthetic uid that owns a class's documents, `class_<classHash>`. Shared by
 * getClassOwnerId, which mints the uid, and hasClassOwner, which reads it back.
 */
export const kClassOwnerPrefix = "class_";

/**
 * The synthetic uid that owns a group's documents. Every member of the group resolves to the same
 * value, which is what makes the document the group's rather than its creator's.
 *
 * It is qualified by the offering because a group id is unique only within one: group 3 of this
 * assignment and group 3 of the next are different sets of students. Callers that need to recognize a
 * particular group's documents should build the id with this and compare, rather than parsing a stored
 * uid apart.
 */
export function getGroupOwnerId(offeringId: string, groupId: string): string {
  return `${kGroupOwnerPrefix}${offeringId}_${groupId}`;
}

/**
 * The synthetic uid that owns a class's documents. Every member of the class resolves to the same
 * value, which is what makes the document the class's rather than its creator's.
 *
 * The class hash needs no further qualification the way a group id does: it already identifies one class
 * across the whole portal. Callers that need to recognize a particular class's documents should build the
 * id with this and compare, rather than parsing a stored uid apart.
 */
export function getClassOwnerId(classHash: string): string {
  return `${kClassOwnerPrefix}${classHash}`;
}

/** The fields the guards read. Structural, so this stays a leaf module. */
export interface IDocumentAxisFields {
  uid?: string | null;
  unit?: string | null;
  investigation?: string | null;
  problem?: string | null;
  offeringId?: string | null;
}

/**
 * Owner axis: the document belongs to a single group, whoever created it.
 *
 * Like a class owner, a group owner has no field of its own — it is a synthetic uid, so this reads the
 * uid's grammar. It tests the prefix rather than taking the uid apart; a caller that needs the group's
 * number reads the `groupId` stored beside the uid (see getDocumentOwnerFields), and one that needs the
 * group itself builds the whole owner id and compares (`Groups.getGroupByOwnerId`).
 */
export function hasGroupOwner(doc: IDocumentAxisFields): boolean {
  return !!doc.uid?.startsWith(kGroupOwnerPrefix);
}

/**
 * Owner axis: the document belongs to the class as a whole, with no personal author.
 *
 * A class owner has no field of its own — it is a synthetic uid, so this reads the uid's grammar.
 * Callers ask the question and leave that to the guard, which is what lets the representation change
 * without touching them.
 */
export function hasClassOwner(doc: IDocumentAxisFields): boolean {
  return !!doc.uid?.startsWith(kClassOwnerPrefix);
}

/**
 * Container axis: the document is kept in the class's copy of one unit, rather than in a single
 * offering of one problem. It says nothing about who owns it — a class-wide slot and an exemplar are
 * both kept here.
 *
 * `offeringId` is the only positive marker of the offering container, so a caller that cannot see it
 * must not use this guard: an exemplar carries the same unit/investigation/problem as a problem
 * document and is told apart from it by nothing else.
 */
export function isInClassUnitContainer(doc: IDocumentAxisFields): boolean {
  return !!doc.unit && !doc.offeringId;
}

/**
 * A short label for a document's curriculum position: "sas-1.2" when it is about a problem, "sas" when
 * it is about a unit and nothing narrower, undefined when it has no unit at all.
 *
 * Callers use it as a stand-in when a document's real title cannot be resolved, so the coordinates
 * name the document instead. It reads the stored fields alone, so it describes a document from any
 * unit, including one whose config is not loaded.
 *
 * An investigation with no problem ("sas-1.x") is not a shape any registered container type produces; it
 * is handled so a partial position still reads as one rather than losing the investigation.
 */
export function getCurriculumLabel(doc: IDocumentAxisFields): string | undefined {
  if (!doc.unit) return undefined;
  if (!doc.investigation) return doc.unit;
  return `${doc.unit}-${doc.investigation}.${doc.problem ?? "x"}`;
}
