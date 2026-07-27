import { IDocumentMetadata } from "../../../shared/shared";
import {
  GroupDocument, LearningLogDocument, LearningLogPublication,
  PersonalDocument, PersonalPublication, PlanningDocument,
  ProblemDocument, ProblemPublication, SupportPublication
} from "./document-types";

/**
 * The metadata axis fields a kind stamps onto its documents (e.g. `concurrent`). Grows as more axes
 * become kind-derived; the stamp sites splat it verbatim, so they don't change as it grows.
 */
export type IDocumentKindMetadataFields = Pick<IDocumentMetadata, "kind" | "concurrent">;

/**
 * How a kind's `owner` axis (authoring identity / provenance, stored as the document's `uid`) is derived
 * at creation: "user" → the creating user; "group" → the synthetic group owner (`group_<off>_<grp>`);
 * "class" → the synthetic class owner (`class_<classHash>`), shared by the whole class. Defaults to "user".
 */
export type DocumentOwnerType = "user" | "group" | "class";

/**
 * How a kind's `scope` axes (class, unit, investigation, problem, offering, group) are derived at creation.
 */
export type DocumentScopeType = "class" | "classUnit" | "offering" | "group";

export interface IDocumentKindInfo {
  /** The kind key. Matches the value stored in a document's `kind` field. */
  kind: string;
  /** This kind's stamped fields, without `kind` — getDocumentKindMetadataFields adds it back. */
  metadataFields: Omit<IDocumentKindMetadataFields, "kind">;
  /** How this kind's owner uid is derived (see DocumentOwnerType). */
  ownerType: DocumentOwnerType;
  /** How this kind's scope axes are derived (see DocumentScopeType). */
  scopeType: DocumentScopeType;
  /**
   * Static display title (presentation config). Leave undefined for dynamic titles like
   * group documents or in the future problem documents.
   */
  title?: string;
}

/**
 * The candidate owner uids for a document being created. The synthetic ones depend on runtime state
 * (the user's group, the current unit), so the caller supplies them; getDocumentOwner selects among
 * them by the kind's registered owner type.
 */
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

/** A kind's full stamp set (its metadataFields plus the `kind` key), or `{}` if the kind is unregistered. */
export function getDocumentKindMetadataFields(kind?: string|null): IDocumentKindMetadataFields {
  const info = getDocumentKindInfo(kind);
  if (!info) return {};
  return { kind: info.kind, ...info.metadataFields };
}

export function getDocumentOwnerType(kind?: string|null): DocumentOwnerType {
  return getDocumentKindInfo(kind)?.ownerType ?? "user";
}

/**
 * The owner uid to stamp on a new document of the given kind
 */
export function getDocumentOwner(kind: string|null|undefined, ctx: IDocumentOwnerContext): string {
  switch (getDocumentOwnerType(kind)) {
    case "group": return ctx.groupOwnerId ?? ctx.userId;
    case "class": return ctx.classOwnerId ?? ctx.userId;
    case "user":  return ctx.userId;
    default:      return ctx.userId;
  }
}

/**
 * The scope fields a document draws from its runtime context, supplied by the caller because they depend on
 * the user's class, current group, offering, unit, and problem. Doubles as the return shape of
 * getDocumentScopeFields (the subset a given kind actually stamps).
 */
export interface IDocumentScopeContext {
  unit: string | null;
  investigation?: string;
  problem?: string;
  context_id: string;
  groupId?: string;
  offeringId?: string;
}

/**
 * The scope fields to stamp on a document of the given kind, selected by its registered `scopeType`.
 */
export function getDocumentScopeFields(
  kind: string|null|undefined, ctx: IDocumentScopeContext
): IDocumentScopeContext {
  const scopeType = getDocumentKindInfo(kind)?.scopeType;
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

/**
 * The minimal document fields getDocumentTitle reads. Structural so the registry stays a leaf module that
 * doesn't import the document models.
 */
interface IDocumentTitleFields {
  kind?: string | null;
  type?: string;
  groupId?: string | null;
}

/**
 * The display title for a document based on its kind
 */
export function getDocumentTitle(document: IDocumentTitleFields): string | undefined {
  const registeredTitle = getDocumentKindInfo(document.kind)?.title;
  if (registeredTitle != null) return registeredTitle;
  // Keyed on `type`, not `kind`: pre-existing group documents predate the `kind` axis and may have no stored
  // `kind` yet. We backfill the kind on open but we need the title for the lists of documents before they
  // are opened. Class-wide docs are new and always carry a `kind`, so their title is resolved above by kind.
  if (document.type === GroupDocument) return `Group ${document.groupId} Document`;
  return undefined;
}

//
// Built-in document kinds.
//

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
