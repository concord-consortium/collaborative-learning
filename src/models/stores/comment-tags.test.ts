import { mock } from "ts-jest-mocker";
import { DB } from "../../lib/db";
import { CommentTags, commentTagId, customCommentTagsPath } from "./comment-tags";

describe("CommentTags store", () => {
  let store: CommentTags;

  beforeEach(() => {
    const db = mock(DB);
    Object.setPrototypeOf(db, DB);
    store = new CommentTags({ db });
  });

  it("exposes synced custom tags as a record", () => {
    store.replaceAll([["custom-1", "Custom One"], ["custom-2", "Custom Two"]]);
    expect(store.customTagRecord).toEqual({ "custom-1": "Custom One", "custom-2": "Custom Two" });
  });

  it("merges unit-config tags with synced custom tags", () => {
    store.replaceAll([["custom-1", "Custom One"]]);
    expect(store.mergedWith({ foo: "Foo" })).toEqual({ foo: "Foo", "custom-1": "Custom One" });
  });

  it("mergedWith handles undefined config tags", () => {
    store.replaceAll([["c", "C"]]);
    expect(store.mergedWith(undefined)).toEqual({ c: "C" });
  });

  it("replaceAll replaces (not merges) the custom tag set", () => {
    store.replaceAll([["a", "A"]]);
    store.replaceAll([["b", "B"]]);
    expect(store.customTagRecord).toEqual({ b: "B" });
  });

  it("derives a stable, firestore-safe id from a tag label", () => {
    expect(commentTagId("Guess and Check")).toBe("guess-and-check");
    expect(commentTagId("  Part-to-Whole ")).toBe("part-to-whole");
  });

  it("scopes the firestore path by class and unit", () => {
    expect(customCommentTagsPath("classABC", "msa")).toBe("commentTags/classABC/units/msa/tags");
  });
});
