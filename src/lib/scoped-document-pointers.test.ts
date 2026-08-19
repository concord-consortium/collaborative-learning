import { getCanonicalPointerPath } from "./scoped-document-pointers";

describe("getCanonicalPointerPath", () => {
  it("names the offering container, the group owner, and the label", () => {
    // Real group metadata carries both offeringId and unit. Each container names only itself, so the
    // offering's own id is the level and no units segment appears.
    expect(getCanonicalPointerPath({
      classHash: "class-1", offeringId: "off-1", unit: "msu",
      owner: "group_off-1_3", label: "default"
    })).toBe("canonical/v1/classes/class-1/offerings/off-1/owners/group_off-1_3/slots/default");
  });

  it("names the classUnit container, the class owner, and the kind as the label", () => {
    expect(getCanonicalPointerPath({
      classHash: "class-1", unit: "msu",
      owner: "class_class-1", label: "drivingQuestionBoard"
    })).toBe("canonical/v1/classes/class-1/units/msu/owners/class_class-1/slots/drivingQuestionBoard");
  });

  it("distinguishes two owners in the same container", () => {
    // What keeps one group from filling another's slot: the containers match, the owners do not.
    const slot = { classHash: "class-1", offeringId: "off-1", label: "default" };
    expect(getCanonicalPointerPath({ ...slot, owner: "group_off-1_3" }))
      .not.toBe(getCanonicalPointerPath({ ...slot, owner: "group_off-1_7" }));
  });

  it("omits the container level for a document kept by the class alone", () => {
    // Nothing creates this shape yet — firestore.rules grants no create for it — but the path is the
    // one a class-level slot would use: the class prefix already identifies the container.
    expect(getCanonicalPointerPath({ classHash: "class-1", owner: "u-1", label: "default" }))
      .toBe("canonical/v1/classes/class-1/owners/u-1/slots/default");
  });
});
