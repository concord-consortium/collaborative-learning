/**
 * The axis profiles: every combination of axis values CLUE creates documents at.
 *
 * A profile is a named bundle of positions on the axes — who owns a document, where it is kept, what it
 * is about, whether several people may write it (see docs/document-axes/axes.md). It is the thing people
 * already mean by "a class-wide document" or "a problem document": a shorthand for a set of coordinates
 * that no single stored field holds.
 *
 * Profiles are why a unit may add kinds but may not add axis combinations, which is what lets `kind` stay
 * open-ended while the set of combinations stays closed. A unit config may declare a new kind, but every
 * kind is registered against one of the profiles below, so a configuration can add a document to an
 * existing combination and cannot invent a new one. This file is therefore the complete list of axis
 * combinations the application supports — the one place to look to check that they are all intended and
 * all handled.
 *
 * | profile        | owner | container | curriculum | concurrent | kinds today                                    |
 * |----------------|-------|-----------|------------|------------|------------------------------------------------|
 * | `problemLike`  | user  | offering  | problem    | no         | problem, planning, problemPublication, support  |
 * | `personalLike` | user  | class     | none       | no         | personal, learningLog, and their publications   |
 * | `group`        | group | offering  | problem    | yes        | group                                           |
 * | `classWide`    | class | classUnit | unit       | yes        | whatever units declare (driving question board) |
 *
 * The curriculum column is not declared here: `containerType` fixes it, because every container above the
 * class is identified by a curriculum coordinate (see getDocumentLocationFields).
 */

/**
 * How a profile's `owner` axis (authoring identity / provenance, stored as the document's `uid`) is derived
 * at creation: "user" → the creating user; "group" → the synthetic group owner (`group_<off>_<grp>`);
 * "class" → the synthetic class owner (`class_<classHash>`), shared by the whole class.
 */
export type DocumentOwnerType = "user" | "group" | "class";

/**
 * Which container a profile's documents are kept in, and with it their curriculum reach: "class" → the
 * class, about no unit; "classUnit" → the class's copy of one unit, about that unit; "offering" → one
 * assignment of a problem to a class, about that problem.
 *
 * One knob sets the container and curriculum axes values because that is the most convenient.
 */
export type DocumentContainerType = "class" | "classUnit" | "offering";

export interface IDocumentAxisProfile {
  /**
   * The profile's name, stamped on every document created from it.
   *
   * Stored so a document records which profile it was made from, which is what a later migration selects
   * on. Selecting instead by the axis values themselves would mean querying the very fields a migration
   * is there to change, and would have to be rewritten whenever they moved.
   */
  name: string;
  /** How this profile's owner uid is derived. */
  ownerType: DocumentOwnerType;
  /** Which container this profile's documents live in, and their curriculum reach. */
  containerType: DocumentContainerType;
  /** Multi-writer, merged through the concurrent history manager. Absent means single-writer. */
  concurrent?: boolean;
}

/** A user's own work on one assigned problem, and the read-only publications made from it. */
export const kProblemLikeProfile: IDocumentAxisProfile = {
  name: "problemLike",
  ownerType: "user",
  containerType: "offering"
};

/** A user's own work that follows them between assignments, about no particular content. */
export const kPersonalLikeProfile: IDocumentAxisProfile = {
  name: "personalLike",
  ownerType: "user",
  containerType: "class"
};

/**
 * One group's shared document for one assignment. Kept in the offering like the problem documents beside
 * it; what makes it the group's is its owner.
 */
export const kGroupProfile: IDocumentAxisProfile = {
  name: "group",
  ownerType: "group",
  containerType: "offering",
  concurrent: true
};

/**
 * One document shared by a whole class for a whole unit. Differs from `group` on owner, container, and
 * curriculum alone — which is the demonstration that the axes, not the type, decide how a document behaves.
 */
export const kClassWideProfile: IDocumentAxisProfile = {
  name: "classWide",
  ownerType: "class",
  containerType: "classUnit",
  concurrent: true
};

/** Every profile, for enumeration — tests, tooling, and anything auditing the set as a whole. */
export const kDocumentAxisProfiles: readonly IDocumentAxisProfile[] = [
  kProblemLikeProfile, kPersonalLikeProfile, kGroupProfile, kClassWideProfile
];
