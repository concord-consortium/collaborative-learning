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
export function decodeDemoOfferingId(
  offeringId: string, defaultUnit?: string
): ICurriculumPosition | undefined {
  const positionFrom = (unit: string, digits: string): ICurriculumPosition => {
    const encoded = parseInt(digits, 10);
    return {
      unit,
      investigation: String(Math.floor(encoded / 100)),
      problem: String(encoded % 100)
    };
  };

  // The prefix must end in a non-digit, which splits at the right place: "m2s101" -> "m2s" and "101".
  const withUnit = /^(.*\D)(\d{1,4})$/.exec(offeringId ?? "");
  if (withUnit) return positionFrom(withUnit[1], withUnit[2]);

  // A demo session launched with no `unit` parameter builds its offering id from an empty unit code
  // (src/lib/auth.ts) while the app still loads `curriculumConfig.defaultUnit`, so a bare id means
  // that default. Capped at four digits: a portal offering id is five or six, and treating one as an
  // encoding would invent an investigation from its leading digits.
  const bare = /^(\d{1,4})$/.exec(offeringId ?? "");
  if (bare && defaultUnit) return positionFrom(defaultUnit, bare[1]);

  return undefined;
}

/** A unit's parsed `content.json`, or undefined when the unit is not in the checkout. */
export type ReadUnitContent = (unit: string) => any | undefined;

/**
 * Check a decoded position against a `clue-curriculum` checkout.
 *
 * The check reads each unit's `content.json`, which lists its investigations by ordinal and their
 * problems by ordinal. **Not the directory layout**: a problem's sections may live under a shared
 * `sections/` tree, so `msa/investigation-1/` holds only `problem-2` even though `content.json`
 * declares problems 1 and 2. Testing for directories rejects whole units' worth of valid positions.
 *
 * This is what makes decoding safe. A unit code ending in a digit splits in the wrong place — "unit2"
 * plus problem 1.1 gives "unit2101", read as unit "unit", investigation 21 — and no curriculum
 * declares that, so it is refused instead of stamped onto a document.
 */
export function createCurriculumValidator(
  curriculumRoot: string,
  { readUnitContent }: { readUnitContent: ReadUnitContent }
): (position: ICurriculumPosition) => boolean {
  return ({ unit, investigation, problem }) => {
    if (!unit || investigation == null || problem == null) return false;
    const content = readUnitContent(unit);
    if (!content) return false;
    const found = content.investigations
      ?.find((i: any) => String(i.ordinal) === String(investigation));
    return !!found?.problems?.some((p: any) => String(p.ordinal) === String(problem));
  };
}
