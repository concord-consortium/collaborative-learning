import { getCanonicalPointerPath } from "./scoped-document-pointers";

describe("getCanonicalPointerPath", () => {
  it("group scope (class + offering + group) — offering wins, unit omitted even when present", () => {
    // Real group metadata carries both offeringId and unit; the offering pins the unit, so no units segment.
    expect(getCanonicalPointerPath(
      { classHash: "class-1", offeringId: "off-1", groupId: "3", unit: "msu" }, "default"
    )).toBe("canonical/v1/classes/class-1/offerings/off-1/groups/3/slots/default");
  });

  it("class+unit scope (no offering) — uses the units segment; label === kind", () => {
    expect(getCanonicalPointerPath(
      { classHash: "class-1", unit: "msu" }, "driving-question-board"
    )).toBe("canonical/v1/classes/class-1/units/msu/slots/driving-question-board");
  });
});
