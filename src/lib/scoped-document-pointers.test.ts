import { getGroupCanonicalPointerPath } from "./scoped-document-pointers";

describe("getGroupCanonicalPointerPath", () => {
  it("builds the nested canonical path from bare scope ids and a slot label", () => {
    expect(getGroupCanonicalPointerPath("class-h", "off-2", "3", "default"))
      .toBe("classes/class-h/offerings/off-2/groups/3/canonical/default");
  });

  it("produces an even number of path segments (a valid Firestore doc path)", () => {
    const path = getGroupCanonicalPointerPath("c", "o", "g", "default");
    expect(path.split("/").length % 2).toBe(0);
  });
});
