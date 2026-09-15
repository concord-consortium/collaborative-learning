import { tutorUserId } from "./tutor-user-id";

describe("tutorUserId", () => {
  // Under a portal launch the identity is built from the two things the rules pin to the caller's
  // token: context_id against class_hash, and uid against platform_user_id. The path's {portal}
  // segment is deliberately NOT used — nothing in the rules ties it to the caller, so a learner
  // can write under another portal's root with their own uid and land on a real student's key.
  it("identifies a portal learner by class and platform id", () => {
    expect(tutorUserId({ root: "authed", rootId: "learn_concord_org", uid: "101",
                         contextId: "class-abc" }))
      .toBe("clue:class/class-abc/users/101");
  });

  it("does not vary with the portal segment, which the rules do not pin", () => {
    const a = tutorUserId({ root: "authed", rootId: "portalA", uid: "101", contextId: "c" });
    const b = tutorUserId({ root: "authed", rootId: "portalB", uid: "101", contextId: "c" });
    expect(a).toBe(b);
  });

  // class_hash is globally unique, so two students who share a platform id in different classes
  // — including on different portals — stay distinct.
  it("distinguishes the same platform id in different classes", () => {
    const a = tutorUserId({ root: "authed", rootId: "p", uid: "101", contextId: "classA" });
    const b = tutorUserId({ root: "authed", rootId: "p", uid: "101", contextId: "classB" });
    expect(a).not.toBe(b);
  });

  it("refuses a portal launch with no class to anchor the identity", () => {
    expect(tutorUserId({ root: "authed", rootId: "p", uid: "101", contextId: "" })).toBe("");
  });

  // Unauthenticated sandboxes have no student identity to protect, so they keep the partition
  // CLUE roots their documents under — which is what distinguishes two demo users.
  it("keeps unauthenticated launches in their own namespace, partitioned as CLUE partitions them", () => {
    expect(tutorUserId({ root: "demo", rootId: "classA", uid: "1", contextId: "" }))
      .toBe("clue:demo/classA/users/1");
  });

  it("distinguishes the same id in different demo classes", () => {
    expect(tutorUserId({ root: "demo", rootId: "classA", uid: "1", contextId: "" }))
      .not.toBe(tutorUserId({ root: "demo", rootId: "classB", uid: "1", contextId: "" }));
  });

  it("keeps appModes apart even when their root ids coincide", () => {
    expect(tutorUserId({ root: "qa", rootId: "same", uid: "1", contextId: "" }))
      .not.toBe(tutorUserId({ root: "demo", rootId: "same", uid: "1", contextId: "" }));
  });

  it("encodes parts that are not safe in an identifier", () => {
    expect(tutorUserId({ root: "demo", rootId: "my class/2", uid: "1", contextId: "" }))
      .toBe("clue:demo/my%20class%2F2/users/1");
  });

  it("returns empty when there is no platform id to identify", () => {
    expect(tutorUserId({ root: "authed", rootId: "p", uid: "", contextId: "c" })).toBe("");
    expect(tutorUserId({ root: "demo", rootId: "d", uid: "", contextId: "" })).toBe("");
  });

  it("returns empty when the trigger path gave no partition", () => {
    expect(tutorUserId({ root: "", rootId: "", uid: "1", contextId: "" })).toBe("");
  });
});
