import { GroupDocument, ProblemDocument } from "../../models/document/document-types";
import { canEditSortWorkDocument } from "./sort-work-edit-permission";

describe("canEditSortWorkDocument", () => {
  const me = "student-1";
  const myGroup = "3";

  it("allows editing the user's own document", () => {
    expect(canEditSortWorkDocument({
      docUid: me, docType: ProblemDocument, docGroupId: null, userId: me, userGroupId: myGroup
    })).toBe(true);
  });

  it("allows editing the user's own group document, even when created by another group member", () => {
    expect(canEditSortWorkDocument({
      docUid: "student-2", docType: GroupDocument, docGroupId: myGroup, userId: me, userGroupId: myGroup
    })).toBe(true);
  });

  it("does not allow editing another group's document", () => {
    expect(canEditSortWorkDocument({
      docUid: "student-9", docType: GroupDocument, docGroupId: "7", userId: me, userGroupId: myGroup
    })).toBe(false);
  });

  it("does not allow editing another student's (non-group) document", () => {
    expect(canEditSortWorkDocument({
      docUid: "student-2", docType: ProblemDocument, docGroupId: null, userId: me, userGroupId: myGroup
    })).toBe(false);
  });

  it("does not allow editing a group document when the user isn't in a group", () => {
    expect(canEditSortWorkDocument({
      docUid: "student-2", docType: GroupDocument, docGroupId: myGroup, userId: me, userGroupId: undefined
    })).toBe(false);
  });

  it("does not treat undefined docUid/userId as a match (both missing)", () => {
    expect(canEditSortWorkDocument({
      docUid: undefined, docType: ProblemDocument, docGroupId: null, userId: undefined, userGroupId: myGroup
    })).toBe(false);
  });

  // The reactive-metadata fix: the group id passed in comes from the metadata (which stays in sync),
  // so an own-group doc is editable as soon as it syncs. This asserts the group-match path a caller
  // relies on when the full document's groupId would still be undefined.
  it("recognizes an own-group doc purely from the group id (metadata-sourced)", () => {
    expect(canEditSortWorkDocument({
      docUid: "student-2", docType: GroupDocument, docGroupId: myGroup, userId: me, userGroupId: myGroup
    })).toBe(true);
  });
});
