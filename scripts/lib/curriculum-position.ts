// Recovering a demo document's curriculum position, and checking it against the curriculum itself.
//
// Nothing in the realtime database records unit, investigation, or problem: the offering node holds
// only its own id, and a document's metadata node holds `type`, `createdAt`, and `offeringId`. The
// client always knew its unit from the URL, so the realtime database never needed to store it.
//
// For a demo document that leaves exactly one source, the offering id, which the runtime builds
// deterministically in `createFakeOfferingIdFromProblem` (src/lib/auth.ts):
//
//     `${unitCode}${investigation * 100 + problem}`
//
// Decoding it means splitting a string into a name and a number, which can be split in the wrong
// place. `createCurriculumValidator` is the guard: a position no curriculum directory backs is
// refused rather than written.

export interface ICurriculumPosition {
  unit?: string | null;
  investigation?: string | null;
  problem?: string | null;
}

/**
 * Recover the curriculum position a demo offering id encodes, or undefined when it encodes none.
 *
 * A bare number is refused. `scripts/ai/update-metadata.ts` defaults those to "sas", which is a guess
 * about which unit a document belongs to — tolerable when reading, not when writing metadata.
 */
export function decodeDemoOfferingId(offeringId: string): ICurriculumPosition | undefined {
  // The prefix must end in a non-digit, which both splits at the right place ("m2s101" -> "m2s" and
  // "101") and refuses an all-numeric id: a bare number is a portal offering id, not an encoding.
  const match = /^(.*\D)(\d{1,4})$/.exec(offeringId ?? "");
  if (!match) return undefined;

  const [, unit, digits] = match;
  const encoded = parseInt(digits, 10);
  return {
    unit,
    investigation: String(Math.floor(encoded / 100)),
    problem: String(encoded % 100)
  };
}

/** Whether a directory exists; injected so the check is testable without a curriculum checkout. */
export type PathExists = (path: string) => boolean;

/**
 * Check a decoded position against a `clue-curriculum` checkout, whose problems live at
 * `<root>/curriculum/<unit>/investigation-<n>/problem-<n>`.
 *
 * This is what makes decoding safe. A unit code ending in a digit splits in the wrong place — "unit2"
 * plus problem 1.1 gives "unit2101", which decodes as unit "unit", investigation 21 — and that
 * position exists in no curriculum, so it is refused instead of stamped onto a document.
 */
export function createCurriculumValidator(
  curriculumRoot: string,
  { exists }: { exists: PathExists }
): (position: ICurriculumPosition) => boolean {
  return ({ unit, investigation, problem }) => {
    if (!unit || investigation == null || problem == null) return false;
    return exists(`${curriculumRoot}/curriculum/${unit}/investigation-${investigation}/problem-${problem}`);
  };
}
