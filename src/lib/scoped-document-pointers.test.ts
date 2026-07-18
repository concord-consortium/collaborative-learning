import { getGroupCanonicalPointerPath } from "./scoped-document-pointers";

describe("getGroupCanonicalPointerPath", () => {
  it("builds the nested canonical path from bare scope ids and a slot label", () => {
    expect(getGroupCanonicalPointerPath("class-h", "off-2", "3", "default"))
      .toBe("classes/class-h/offerings/off-2/groups/3/canonical/default");
  });

  it("produces a valid Firestore document path (even segment count)", () => {
    // Firestore doc paths must have an even number of segments; an odd count is a collection path
    // and would fail at runtime when we call firestore.doc(pointerPath).
    const path = getGroupCanonicalPointerPath("c", "o", "g", "default");
    expect(path.split("/").length % 2).toBe(0);
  });
});
