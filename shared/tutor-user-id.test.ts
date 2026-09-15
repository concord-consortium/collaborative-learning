import { tutorUserId } from "./tutor-user-id";

describe("tutorUserId", () => {
  // Derived on the server from the trigger path and a rules-pinned uid. NOT taken from the
  // message: a field the rules only type-check is a field a student can forge, and this one is a
  // tutor backend's memory key.
  it("identifies a portal launch by portal and platform id", () => {
    expect(tutorUserId({ root: "authed", rootId: "learn_concord_org", uid: "101" }))
      .toBe("clue:authed/learn_concord_org/users/101");
  });

  // The bug this exists for: platform user ids are per-portal sequences.
  it("distinguishes the same platform id on different portals", () => {
    const a = tutorUserId({ root: "authed", rootId: "learn_concord_org", uid: "101" });
    const b = tutorUserId({ root: "authed", rootId: "portal_example_org", uid: "101" });
    expect(a).not.toBe(b);
  });

  // The same bug one level down: /demo/{name}/ is the partition there.
  it("distinguishes the same id in different demo classes", () => {
    const a = tutorUserId({ root: "demo", rootId: "classA", uid: "1" });
    const b = tutorUserId({ root: "demo", rootId: "classB", uid: "1" });
    expect(a).not.toBe(b);
  });

  it("keeps appModes apart even when their root ids coincide", () => {
    expect(tutorUserId({ root: "qa", rootId: "same", uid: "1" }))
      .not.toBe(tutorUserId({ root: "demo", rootId: "same", uid: "1" }));
  });

  // A demo name is author-supplied and need not be safe in an identifier.
  it("encodes parts that are not safe in an identifier", () => {
    expect(tutorUserId({ root: "demo", rootId: "my class/2", uid: "1" }))
      .toBe("clue:demo/my%20class%2F2/users/1");
  });

  // Without a uid there is no identity to key memory on, and a blank one would be shared by
  // every such user. Empty is the signal to refuse the turn.
  it("returns empty when there is no platform id to identify", () => {
    expect(tutorUserId({ root: "authed", rootId: "p", uid: "" })).toBe("");
  });

  it("returns empty when the trigger path gave no partition", () => {
    expect(tutorUserId({ root: "", rootId: "", uid: "1" })).toBe("");
  });
});
