import { getGroupCanonicalPointerPath } from "./scoped-document-pointers";

describe("getGroupCanonicalPointerPath", () => {
  it("builds the nested canonical path from bare scope ids", () => {
    expect(getGroupCanonicalPointerPath("class-h", "off-2", "3", "group"))
      .toBe("classes/class-h/offerings/off-2/groups/3/canonical/group");
  });

  it("produces an even number of path segments (a valid Firestore doc path)", () => {
    const path = getGroupCanonicalPointerPath("c", "o", "g", "group");
    expect(path.split("/").length % 2).toBe(0);
  });
});
