import { upperFirst } from "lodash";
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
 * Which container a kind's documents are kept in, and with it their curriculum reach: "class" → the class,
 * about no unit; "classUnit" → the class's copy of one unit, about that unit; "offering" → one assignment of
 * a problem to a class, about that problem.
 *
 * One knob sets the container and curriculum axes values because that is the most convenient.
 */
export type DocumentContainerType = "class" | "classUnit" | "offering";

export interface IDocumentKindInfo {
  /** The kind key. Matches the value stored in a document's `kind` field. */
  kind: string;
  /** This kind's stamped fields, without `kind` — getDocumentKindMetadataFields adds it back. */
  metadataFields: Omit<IDocumentKindMetadataFields, "kind">;
  /** How this kind's owner uid is derived. */
  ownerType: DocumentOwnerType;
  /** Which container this kind's documents live in, and their curriculum reach. */
  containerType: DocumentContainerType;
  /**
   * Static document display title. Leave undefined for dynamic titles.
   */
  title?: string;
  /**
   * The unit code whose config declared this kind. Set for kinds declared by a unit config; undefined
   * for the built-in kinds, which are unit-independent.
   *
   * Kind names are not unique across configurations — two units may declare the same kind with different
   * wording — and only the current unit's config is loaded. getKindDefinitionFor compares this against a
   * document's own `unit` so one unit's definition is never applied to another unit's document.
   */
  unit?: string;
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

const kDocumentKindPattern = /^[a-z][a-zA-Z0-9]*$/;
/**
 * A document `kind` is used as a Firestore path segment (the canonical-pointer slot) as well as the registry
 * key, so a kind is restricted to a camelCase identifier: a lowercase letter followed by letters/digits, with
 * no separators or special characters. This matches the built-in document type strings (e.g.
 * "learningLogPublication") and keeps the value safe as a Firestore document id.
 */
export function isValidDocumentKind(value: string): boolean {
  return kDocumentKindPattern.test(value);
}

const gDocumentKindInfoMap: Record<string, IDocumentKindInfo> = {};

export function registerDocumentKind(kind: string, info: Omit<IDocumentKindInfo, "kind">) {
  if (!isValidDocumentKind(kind)) {
    throw new Error(`Document kind "${kind}" is not a valid identifier ` +
      `(must be camelCase letters/digits, with no separators or special characters)`);
  }
  if (gDocumentKindInfoMap[kind]) {
    throw new Error(`Document kind "${kind}" is already registered`);
  }
  gDocumentKindInfoMap[kind] = { kind, ...info };
}

/**
 * Look a kind up by name alone, without asking which configuration defined it. Creation is the only
 * caller: a document being created takes its kind from the config in hand, so the definition found is
 * necessarily the one it is made from. Anything reading an existing document must use
 * getKindDefinitionFor instead.
 */
export function getDocumentKindInfo(kind?: string|null) {
  return kind ? gDocumentKindInfoMap[kind] : undefined;
}

/**
 * The fields that identify which definition a document was made from: its kind, and the association
 * naming the configuration that declared that kind. Structural, so this stays a leaf module.
 */
export interface IKindScopedDocumentFields {
  kind?: string | null;
  unit?: string | null;
}

/**
 * This document's kind definition, or undefined when no definition applicable to it is loaded.
 *
 * The single entry point for reading a kind definition off an existing document. It takes the document
 * rather than the kind because a kind name does not identify a definition on its own: a kind declared by a
 * unit config exists only while that unit is loaded, and two units may declare the same kind meaning
 * different things (see IDocumentKindInfo.unit). Matching the document's `unit` against the definition's is
 * what tells a definition that governs this document from one that merely shares its name.
 *
 * Undefined therefore means "no definition to read here", not "no such kind" — the document may well have
 * been created from a perfectly good definition belonging to a unit that is not loaded. Sort Work lists
 * documents from every unit a class has worked through, so this is ordinary rather than exceptional, and a
 * caller must answer from the document's stored fields instead. Anything a definition contributes that
 * cannot be recovered that way has to be stamped onto the document at creation.
 */
export function getKindDefinitionFor(doc: IKindScopedDocumentFields): IDocumentKindInfo | undefined {
  const info = getDocumentKindInfo(doc.kind);
  if (!info) return undefined;
  // A built-in kind declares no unit: it is registered by the application, so it governs its documents
  // wherever they came from.
  if (info.unit != null && info.unit !== doc.unit) return undefined;
  return info;
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
 * The owner uid to stamp on a new document of the given kind.
 *
 * Throws for a kind that is not registered, rather than defaulting to the creating user the way
 * getDocumentOwnerType does. Defaulting here would hand a group's or a class's document to whoever
 * happened to create it, and because a canonical slot is addressed by its owner, would file it in that
 * user's slot instead of the shared one — both silently.
 *
 * A unit-declared kind is registered only while the unit declaring it is loaded, so this also states the
 * rule that a document may be created only for a kind the current unit defines. Reading documents from
 * other units is unaffected: nothing on the read side resolves an owner (see document-axes.ts).
 */
export function getDocumentOwner(kind: string|null|undefined, ctx: IDocumentOwnerContext): string {
  const info = getDocumentKindInfo(kind);
  if (!info) {
    throw new Error(`Cannot resolve the owner of unregistered document kind "${kind}"`);
  }
  switch (info.ownerType) {
    case "group": return required(ctx.groupOwnerId, kind, "group");
    case "class": return required(ctx.classOwnerId, kind, "class");
    case "user":  return ctx.userId;
    default:      return ctx.userId;
  }
}

function required(ownerId: string | undefined, kind: string|null|undefined, ownerType: string): string {
  if (!ownerId) {
    throw new Error(`Cannot create a ${ownerType}-owned document of kind "${kind}": ` +
      `no ${ownerType} owner id is available`);
  }
  return ownerId;
}

/**
 * The stored owner-axis fields besides `uid`. A group owner's `groupId` is stored alongside the owner uid
 * that already encodes it (`group_<offeringId>_<groupId>`), so Firestore rules and group-member lookups can
 * read the group without parsing the uid.
 */
export interface IDocumentOwnerFields {
  groupId?: string;
}

/**
 * The owner fields to stamp on a new document of the given kind, beyond the owner uid getDocumentOwner
 * returns. Only a group owner has one.
 */
export function getDocumentOwnerFields(
  kind: string|null|undefined, ctx: { groupId?: string }
): IDocumentOwnerFields {
  if (getDocumentOwnerType(kind) !== "group" || !ctx.groupId) return {};
  return { groupId: ctx.groupId };
}

/**
 * The container and curriculum values a document draws from its runtime context, supplied by the caller
 * because they depend on the user's class, offering, unit, and problem. Doubles as the return shape of
 * getDocumentLocationFields (the subset a given kind actually stamps).
 */
export interface IDocumentLocationContext {
  unit: string | null;
  investigation?: string | null;
  problem?: string | null;
  context_id: string;
  offeringId?: string;
}

/**
 * The container and curriculum fields to stamp on a document of the given kind, selected by its registered
 * `containerType` — which fixes both, so one lookup answers for both axes.
 */
export function getDocumentLocationFields(
  kind: string|null|undefined, ctx: IDocumentLocationContext
): IDocumentLocationContext {
  switch (getDocumentKindInfo(kind)?.containerType) {
    case "classUnit": return {
      unit: ctx.unit,
      context_id: ctx.context_id,
      // Stated explicitly rather than omitted. A curriculum field written as null means "not about an
      // investigation or problem" (firestore.rules `hasPresentField`), the same convention class-contained
      // documents use for `unit: null`. It is what lets Sort Work query for documents about a unit but not
      // a problem — Firestore cannot match a field that is missing.
      investigation: null,
      problem: null
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
interface IDocumentTitleFields extends IKindScopedDocumentFields {
  type?: string;
  groupId?: string | null;
}

/**
 * The display title for a document based on its kind
 */
export function getDocumentTitle(document: IDocumentTitleFields): string | undefined {
  // A document whose definition is not loaded resolves no title here and falls through to a caller's
  // fallback, which names it from its stored fields instead.
  const info = getKindDefinitionFor(document);
  if (info?.title != null) return info.title;
  // Keyed on `type` plus `groupId`, not `kind`: a group document may have no stored `kind` yet (we backfill
  // the kind on open but need the title for the lists of documents before they are opened), so it cannot rely
  // on the lookup above. Requiring `groupId` (not just `type === GroupDocument`) matters because a class-wide
  // document also stores `type: "group"` but carries no `groupId` — if its `kind` is unregistered in this
  // session (e.g. it belongs to a unit that has not loaded), the lookup above misses and execution reaches
  // here; without the `groupId` check it would render as "Group undefined Document" instead of falling
  // through to `undefined`, which callers already handle.
  //
  // TRANSITIONAL: this reads `type` only because a group document may carry no `kind`. Once
  // scripts/backfill-group-document-axes.ts has stamped `kind` on every group document in every
  // environment, this becomes `document.kind === GroupDocument` and the `groupId` check goes away with it —
  // a class-wide document has its own kind, so it can no longer reach this branch at all.
  if (document.type === GroupDocument && document.groupId) return `Group ${document.groupId} Document`;
  return undefined;
}

/**
 * A readable label derived from the kind string alone: "drivingQuestionBoard" → "Driving Question
 * Board". Registry-free by design, so it can name a document whose kind was declared by a unit config
 * that is not loaded — the case getDocumentTitle cannot answer.
 *
 * It recovers the kind's identity, not the author's wording: a slot titled "Our Big Questions" in its
 * own unit reads as "Driving Question Board" from elsewhere.
 */
export function getDocumentKindLabel(kind?: string | null): string | undefined {
  if (!kind) return undefined;
  return upperFirst(kind.replace(/([A-Z])/g, " $1"));
}

/**
 * Register a kind declared by a unit's `classWideDocuments` configuration. Every class-wide collaborative
 * document has the same shape — concurrent, owned by the synthetic class owner, kept in the class's copy of
 * the unit and about that unit and nothing narrower — so only the kind key, the authored title, and the
 * declaring unit come from the configuration. The title is registered rather than stored per document so it
 * resolves live by kind (see getDocumentTitle). Throws like registerDocumentKind when the kind is malformed
 * or already registered.
 */
export function registerClassWideDocumentKind(kind: string, title: string, unit: string) {
  registerDocumentKind(kind, {
    metadataFields: { concurrent: true },
    ownerType: "class",
    containerType: "classUnit",
    title,
    unit
  });
}

function registerBuiltInDocumentKinds() {
  // A group document is kept in the offering, like the problem documents beside it; what makes it a group's
  // is its owner, which is also where its stored `groupId` comes from (see getDocumentOwnerFields).
  registerDocumentKind(GroupDocument, {
    metadataFields: { concurrent: true },
    ownerType: "group",
    containerType: "offering"
  });

  const personalLikeKindInfo = {
    metadataFields: { },
    ownerType: "user",
    containerType: "class"
  } as const;
  registerDocumentKind(PersonalDocument, personalLikeKindInfo);
  registerDocumentKind(LearningLogDocument, personalLikeKindInfo);
  registerDocumentKind(PersonalPublication, personalLikeKindInfo);
  registerDocumentKind(LearningLogPublication, personalLikeKindInfo);

  const problemLikeKindInfo = {
    metadataFields: { },
    ownerType: "user",
    containerType: "offering"
  } as const;
  registerDocumentKind(PlanningDocument, problemLikeKindInfo);
  registerDocumentKind(ProblemDocument, problemLikeKindInfo);
  registerDocumentKind(ProblemPublication, problemLikeKindInfo);
  registerDocumentKind(SupportPublication, problemLikeKindInfo);
}
registerBuiltInDocumentKinds();

// Test-only: reset the registry to just the built-in kinds. The registry is module-global mutable state and
// registerDocumentKind throws on duplicates, so a test that registers a kind must reset before another test
// registers the same kind. (Jest gives each test file its own module registry, so this is only needed within a
// file that registers the same kind in more than one test.)
export function resetDocumentKindRegistryForTests() {
  for (const kind of Object.keys(gDocumentKindInfoMap)) {
    delete gDocumentKindInfoMap[kind];
  }
  registerBuiltInDocumentKinds();
}
