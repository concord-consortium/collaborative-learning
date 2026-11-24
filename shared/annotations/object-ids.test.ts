import { decipherCellId, decipherDotId, getCellId, getDotId } from "./object-ids";

describe("cell ids", () => {
  it("round-trips a case and attribute id", () => {
    const id = getCellId("case1", "attr1");
    expect(id).toBe("cell:{case1}:{attr1}");
    expect(decipherCellId(id)).toEqual({ caseId: "case1", attributeId: "attr1" });
  });

  it("deciphers nothing from an id of another kind", () => {
    expect(decipherCellId("dot:{case1}:{attr1}:{attr2}")).toEqual({});
  });
});

describe("dot ids", () => {
  it("round-trips a case and two attribute ids", () => {
    const id = getDotId("case1", "attrX", "attrY");
    expect(id).toBe("dot:{case1}:{attrX}:{attrY}");
    expect(decipherDotId(id)).toEqual({ caseId: "case1", xAttributeId: "attrX", yAttributeId: "attrY" });
  });

  it("deciphers nothing from an id of another kind", () => {
    expect(decipherDotId("cell:{case1}:{attr1}")).toEqual({});
  });
});
