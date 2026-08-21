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
  const existing = new Set([
    "/curriculum/curriculum/brain/investigation-2/problem-3",
    "/curriculum/curriculum/sas/investigation-0/problem-1"
  ]);
  const validator = createCurriculumValidator("/curriculum", { exists: (p) => existing.has(p) });

  it("accepts a position whose problem directory exists", () => {
    expect(validator({ unit: "brain", investigation: "2", problem: "3" })).toBe(true);
    expect(validator({ unit: "sas", investigation: "0", problem: "1" })).toBe(true);
  });

  it("rejects a position no curriculum directory backs", () => {
    // This is the guard on a decode that split the id in the wrong place. A unit code ending in a
    // digit -- "unit2" plus problem 1.1 -- decodes as unit "unit", investigation 21, which exists
    // nowhere and so is caught here rather than written onto a document.
    expect(validator({ unit: "unit", investigation: "21", problem: "1" })).toBe(false);
    expect(validator({ unit: "brain", investigation: "9", problem: "9" })).toBe(false);
    expect(validator({ unit: "nosuchunit", investigation: "1", problem: "1" })).toBe(false);
  });

  it("rejects an incomplete position rather than checking a malformed path", () => {
    expect(validator({ unit: "brain", investigation: "2" })).toBe(false);
    expect(validator({ unit: undefined, investigation: "2", problem: "3" })).toBe(false);
  });
});
