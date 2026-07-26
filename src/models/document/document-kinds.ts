import { IDocumentMetadata } from "../../../shared/shared";
import {
  GroupDocument, LearningLogDocument, LearningLogPublication,
  PersonalDocument, PersonalPublication, PlanningDocument,
  ProblemDocument, ProblemPublication, SupportPublication
} from "./document-types";

/** The stored metadata axis fields a kind stamps onto its documents. This grows as more axes become
 *  kind-derived; the stamp sites splat it verbatim, so they don't change when it grows. */
export type IDocumentKindMetadataFields = Pick<IDocumentMetadata, "kind" | "concurrent">;

/** How a kind's `owner` axis (authoring identity / provenance, stored as the document's `uid`) is derived
 *  at creation: "user" → the creating user; "group" → the synthetic group owner (`group_<off>_<grp>`);
 *  "class" → the synthetic class owner (`class_<classHash>`), shared by the whole class. Defaults to "user". */
export type DocumentOwnerType = "user" | "group" | "class";

/**
 * How a kind's `scope` axes (class, unit, investigation, problem, offering, group) are derived at creation.
 */
export type DocumentScopeType = "class" | "classUnit" | "offering" | "group";

export interface IDocumentKindInfo {
  /** The kind key. Matches the value stored in a document's `kind` field. */
  kind: string;
  /** The metadata axis fields stamped onto this kind's documents at creation (and backfilled on open).
   *  The `kind` field itself is added automatically by getDocumentKindMetadataFields, so it is not
   *  repeated here. */
  metadataFields: Omit<IDocumentKindMetadataFields, "kind">;
  /** How this kind's owner uid is derived (see DocumentOwnerType). */
  ownerType: DocumentOwnerType;
  /** How this kind's scope axes are derived (see DocumentScopeType). */
  scopeType: DocumentScopeType;
}

/** The candidate owner uids for a document being created. The synthetic ones depend on runtime state
 *  (the user's group, the current unit), so the caller supplies them; getDocumentOwner selects among
 *  them by the kind's registered owner type. */
export interface IDocumentOwnerContext {
  /** The creating user's own uid — the default owner. */
  userId: string;
  /** The synthetic group owner uid (`group_<off>_<grp>`), for group-scoped kinds. */
  groupOwnerId?: string;
  /** The synthetic class owner uid (`class_<classHash>`), for class-wide kinds. */
  classOwnerId?: string;
}

const gDocumentKindInfoMap: Record<string, IDocumentKindInfo> = {};

export function registerDocumentKind(kind: string, info: Omit<IDocumentKindInfo, "kind">) {
  gDocumentKindInfoMap[kind] = { kind, ...info };
}

export function getDocumentKindInfo(kind?: string|null) {
  return kind ? gDocumentKindInfoMap[kind] : undefined;
}

/** The stored metadata axis fields for the given kind — its own `kind` key plus any others (e.g. `concurrent`);
 *  empty for an unregistered kind. The stamp sites (createFirestoreMetadataDocument and the on-open backfill)
 *  currently apply these only to type:"group" documents, so both stay in sync as the field set grows. */
export function getDocumentKindMetadataFields(kind?: string|null): IDocumentKindMetadataFields {
  const info = getDocumentKindInfo(kind);
  if (!info) return {};
  return { kind: info.kind, ...info.metadataFields };
}

/** The owner type registered for a kind (how its owner uid is derived); "user" for an unregistered kind. */
export function getDocumentOwnerType(kind?: string|null): DocumentOwnerType {
  return getDocumentKindInfo(kind)?.ownerType ?? "user";
}

/** The owner uid to stamp on a new document of the given kind, chosen by the kind's registered owner type
 *  from the runtime-supplied context. Falls back to the creating user when the synthetic owner a type
 *  needs was not supplied. */
export function getDocumentOwner(kind: string|null|undefined, ctx: IDocumentOwnerContext): string {
  switch (getDocumentOwnerType(kind)) {
    case "group": return ctx.groupOwnerId ?? ctx.userId;
    case "class": return ctx.classOwnerId ?? ctx.userId;
    case "user":  return ctx.userId;
    default:      return ctx.userId;
  }
}

/** The scope fields a document draws from its runtime context, supplied by the caller because they depend on
 *  the user's class, current group, offering, unit, and problem. Doubles as the return shape of
 *  getDocumentScopeFields (the subset a given kind actually stamps). */
export interface IDocumentScopeContext {
  unit: string | null;
  investigation?: string;
  problem?: string;
  context_id: string;
  groupId?: string;
  offeringId?: string;
}

/** The scope fields to stamp on a document of the given kind, selected by its registered `scopeType`.
 *  `context_id` (the class) is always included; each scopeType then picks the subset its documents carry:
 *   - "group":     the full offering context — `groupId`, `offeringId`, `unit`, `investigation`, `problem`;
 *   - "offering":  `offeringId`, `unit`, `investigation`, `problem` (no group);
 *   - "classUnit": `unit` only;
 *   - "class" (and unregistered kinds): a null `unit` only.
 *  The caller supplies every runtime value via ctx; unused ones are simply not returned. */
export function getDocumentScopeFields(
  kind: string|null|undefined, ctx: IDocumentScopeContext
): IDocumentScopeContext {
  const scopeType = getDocumentKindInfo(kind)?.scopeType; // ensure kind is registered, for dev-time validation
  switch (scopeType) {
    case "group": return {
      unit: ctx.unit,
      investigation: ctx.investigation,
      problem: ctx.problem,
      context_id: ctx.context_id,
      offeringId: ctx.offeringId,
      groupId: ctx.groupId
    };
    case "classUnit": return {
      unit: ctx.unit,
      context_id: ctx.context_id
    };
    case "class": return {
      unit: null,
      context_id: ctx.context_id
    };
    case "offering": return {
      unit: ctx.unit,
      investigation: ctx.investigation,
      problem: ctx.problem,
      context_id: ctx.context_id,
      offeringId: ctx.offeringId
    };
    default: return {
      unit: null,
      context_id: ctx.context_id
    };
  }
}

// Built-in kinds. The group document is the first concurrent kind; the DQB / word-wall register later
// (Stage 2). `kind` deliberately equals the `type` value "group"; its owner is the synthetic group user.
registerDocumentKind( GroupDocument, {
  metadataFields: { concurrent: true },
  ownerType: "group",
  scopeType: "group"
});

const personalLikeKindInfo = {
  metadataFields: { },
  ownerType: "user",
  scopeType: "class"
} as const;
registerDocumentKind(PersonalDocument, personalLikeKindInfo);
registerDocumentKind(LearningLogDocument, personalLikeKindInfo);
registerDocumentKind(PersonalPublication, personalLikeKindInfo);
registerDocumentKind(LearningLogPublication, personalLikeKindInfo);

const problemLikeKindInfo = {
  metadataFields: { },
  ownerType: "user",
  scopeType: "offering"
} as const;
registerDocumentKind(PlanningDocument, problemLikeKindInfo);
registerDocumentKind(ProblemDocument, problemLikeKindInfo);
registerDocumentKind(ProblemPublication, problemLikeKindInfo);
registerDocumentKind(SupportPublication, problemLikeKindInfo);
