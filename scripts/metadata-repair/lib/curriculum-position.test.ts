import { createCurriculumValidator, decodeDemoOfferingId } from "./curriculum-position";

describe("decodeDemoOfferingId", () => {
  // Demo offering ids are built by createFakeOfferingIdFromProblem (src/lib/auth.ts) as
  // `${unitCode}${investigation * 100 + problem}`. Nothing in the realtime database records the
  // curriculum position, so for a demo document this id is the only source.

  it("decodes the unit, investigation and problem the runtime encoded", () => {
    expect(decodeDemoOfferingId("m2s101")).toEqual({ unit: "m2s", investigation: "1", problem: "1" });
    expect(decodeDemoOfferingId("cas202")).toEqual({ unit: "cas", investigation: "2", problem: "2" });
    expect(decodeDemoOfferingId("brain203")).toEqual({ unit: "brain", investigation: "2", problem: "3" });
  });

  it("decodes a unit code containing digits or dashes", () => {
    expect(decodeDemoOfferingId("example-config-subtabs101"))
      .toEqual({ unit: "example-config-subtabs", investigation: "1", problem: "1" });
    expect(decodeDemoOfferingId("m2s304")).toEqual({ unit: "m2s", investigation: "3", problem: "4" });
  });

  it("decodes investigation 0, whose id carries no hundreds digit", () => {
    // Introduction to CLUE is investigation 0, so 0 * 100 + 1 gives an id ending in a single digit.
    expect(decodeDemoOfferingId("sas1")).toEqual({ unit: "sas", investigation: "0", problem: "1" });
    expect(decodeDemoOfferingId("brain12")).toEqual({ unit: "brain", investigation: "0", problem: "12" });
  });

  it("decodes an investigation above nine", () => {
    expect(decodeDemoOfferingId("sas1001")).toEqual({ unit: "sas", investigation: "10", problem: "1" });
  });

  it("refuses an id with no unit prefix rather than defaulting to one", () => {
    // scripts/ai/update-metadata.ts defaults these to "sas". That is a guess about which unit the
    // document belongs to, and this script writes metadata rather than reading it.
    expect(decodeDemoOfferingId("101")).toBeUndefined();
    expect(decodeDemoOfferingId("1")).toBeUndefined();
  });

  it("refuses an id with no trailing number", () => {
    expect(decodeDemoOfferingId("justaname")).toBeUndefined();
    expect(decodeDemoOfferingId("")).toBeUndefined();
  });

  it("refuses a portal offering id, which is a bare number carrying no unit", () => {
    expect(decodeDemoOfferingId("173197")).toBeUndefined();
  });
});

describe("createCurriculumValidator", () => {
  // A unit's content.json is the authority on which problems exist. The directory layout is not: a
  // problem's sections can live under a shared `sections/` tree, so msa declares investigation 1
  // problem 1 while `msa/investigation-1/` holds only `problem-2`.
  const units: Record<string, any> = {
    msa: { investigations: [{ ordinal: 1, problems: [{ ordinal: 1 }, { ordinal: 2 }] }] },
    brain: {
      investigations: [
        { ordinal: 0, problems: [{ ordinal: 1 }] },
        { ordinal: 2, problems: [{ ordinal: 3 }] }
      ]
    }
  };
  const validator = createCurriculumValidator("/curriculum", { readUnitContent: (u) => units[u] });

  it("accepts a problem the unit's content.json declares", () => {
    expect(validator({ unit: "msa", investigation: "1", problem: "1" })).toBe(true);
    expect(validator({ unit: "brain", investigation: "2", problem: "3" })).toBe(true);
  });

  it("accepts investigation 0, which is a real investigation rather than a missing one", () => {
    expect(validator({ unit: "brain", investigation: "0", problem: "1" })).toBe(true);
  });

  it("rejects a problem the unit does not declare", () => {
    // This is the guard on a decode that split the id in the wrong place. A unit code ending in a
    // digit -- "unit2" plus problem 1.1 -- decodes as unit "unit", investigation 21, which no
    // curriculum declares, so it is caught here rather than written onto a document.
    expect(validator({ unit: "unit", investigation: "21", problem: "1" })).toBe(false);
    expect(validator({ unit: "msa", investigation: "1", problem: "9" })).toBe(false);
    expect(validator({ unit: "msa", investigation: "7", problem: "1" })).toBe(false);
  });

  it("rejects a unit with no content.json at all", () => {
    expect(validator({ unit: "nosuchunit", investigation: "1", problem: "1" })).toBe(false);
  });

  it("rejects problem 0, which no ordinal names", () => {
    // `problem=2` with no minor decodes as investigation 2, problem 0. The real problem is unknown,
    // so the document is reported rather than given a guessed position.
    expect(validator({ unit: "msa", investigation: "1", problem: "0" })).toBe(false);
  });

  it("rejects an incomplete position", () => {
    expect(validator({ unit: "msa", investigation: "1" })).toBe(false);
    expect(validator({ unit: undefined, investigation: "1", problem: "1" })).toBe(false);
  });
});

describe("decodeDemoOfferingId with a default unit", () => {
  // A demo session launched with no `unit` parameter builds its offering id from an empty unit code
  // (src/lib/auth.ts), while the app still loads curriculumConfig.defaultUnit. So a bare id means
  // the default unit, and 54 such ids appear across production's demo spaces.

  it("uses the default unit for a bare id", () => {
    expect(decodeDemoOfferingId("101", "sas")).toEqual({ unit: "sas", investigation: "1", problem: "1" });
    expect(decodeDemoOfferingId("1", "sas")).toEqual({ unit: "sas", investigation: "0", problem: "1" });
    expect(decodeDemoOfferingId("303", "sas")).toEqual({ unit: "sas", investigation: "3", problem: "3" });
  });

  it("still refuses a bare id when no default unit is supplied", () => {
    expect(decodeDemoOfferingId("101")).toBeUndefined();
  });

  it("refuses a portal offering id even with a default unit", () => {
    // Portal ids are 5 or 6 digits; treating one as an encoding would invent an investigation.
    expect(decodeDemoOfferingId("173197", "sas")).toBeUndefined();
    expect(decodeDemoOfferingId("85359", "sas")).toBeUndefined();
  });

  it("prefers a unit code the id carries over the default", () => {
    expect(decodeDemoOfferingId("brain203", "sas"))
      .toEqual({ unit: "brain", investigation: "2", problem: "3" });
  });
});
