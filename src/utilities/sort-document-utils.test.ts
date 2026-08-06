import { observable } from "mobx";
import { mock } from "ts-jest-mocker";
import { IDocumentMetadataModel } from "../models/document/document-metadata-model";
import { Bookmark, Bookmarks } from "../models/stores/bookmarks";
import { DB } from "../lib/db";
import {
  createDocMapByBookmarks,
  createTileTypeToDocumentsMap,
  getTagsWithDocs,
  GroupSectionSortKey,
  sortGroupSections,
  sortProblemSectionLabels
} from "./sort-document-utils";
import { clearTermOverrides, setTermOverrides } from "./translation/translate";

const createMockDocument = (overrides: Partial<IDocumentMetadataModel> = {}): IDocumentMetadataModel => ({
  uid: "user1",
  type: "problem",
  key: "doc1",
  createdAt: Date.now(),
  ...overrides
} as IDocumentMetadataModel);

// Helper to add bookmarks to the Bookmarks instance
function addDocBookmarks(bookmarks: Bookmarks, bookmarkMap: Record<string, Array<Bookmark>>) {
  Object.entries(bookmarkMap).forEach(([docKey, array]) => {
    bookmarks.bookmarkMap.set(docKey, observable.array(array));
  });
}

describe("sort-document-utils", () => {
  describe("createDocMapByBookmarks", () => {
    let bookmarks: Bookmarks;

    beforeEach(() => {
      const db = mock(DB);
      Object.setPrototypeOf(db, DB);
      bookmarks = new Bookmarks({ db });
    });

    it("should use default terms when not specified", () => {
      const doc1 = createMockDocument({ key: "doc1" });
      const doc2 = createMockDocument({ key: "doc2" });
      addDocBookmarks(bookmarks, {
        doc1: [new Bookmark("user1", "bookmark1", true)]
      });

      const result = createDocMapByBookmarks([doc1, doc2], bookmarks);

      expect(result.has("Bookmarked")).toBe(true);
      expect(result.has("Not Bookmarked")).toBe(true);
      expect(result.get("Bookmarked")).toHaveLength(1);
      expect(result.get("Not Bookmarked")).toHaveLength(1);
    });

    it("should use custom terms when specified", () => {
      const doc1 = createMockDocument({ key: "doc1" });
      const doc2 = createMockDocument({ key: "doc2" });
      addDocBookmarks(bookmarks, {
        doc1: [new Bookmark("user1", "bookmark1", true)]
      });

      const result = createDocMapByBookmarks([doc1, doc2], bookmarks, "Faved", "Not Faved");

      expect(result.has("Faved")).toBe(true);
      expect(result.has("Not Faved")).toBe(true);
      expect(result.has("Bookmarked")).toBe(false);
      expect(result.has("Not Bookmarked")).toBe(false);
      expect(result.get("Faved")).toHaveLength(1);
      expect(result.get("Not Faved")).toHaveLength(1);
    });
  });

  describe("createTileTypeToDocumentsMap", () => {
    it("should use default 'No Tools' term when not specified", () => {
      const docWithTools = createMockDocument({ key: "doc1", tools: ["Text"] } as any);
      const docWithoutTools = createMockDocument({ key: "doc2", tools: [] } as any);

      const result = createTileTypeToDocumentsMap([docWithTools, docWithoutTools]);

      expect(result.has("Text")).toBe(true);
      expect(result.has("No Tools")).toBe(true);
    });

    it("should use custom 'No Tools' term when specified", () => {
      const docWithTools = createMockDocument({ key: "doc1", tools: ["Text"] } as any);
      const docWithoutTools = createMockDocument({ key: "doc2", tools: [] } as any);

      const result = createTileTypeToDocumentsMap([docWithTools, docWithoutTools], "No Tiles");

      expect(result.has("Text")).toBe(true);
      expect(result.has("No Tiles")).toBe(true);
      expect(result.has("No Tools")).toBe(false);
    });

    it("should put documents with only Placeholder/Unknown tools in the no-tools section", () => {
      const docWithPlaceholder = createMockDocument({ key: "doc1", tools: ["Placeholder"] } as any);
      const docWithUnknown = createMockDocument({ key: "doc2", tools: ["Unknown"] } as any);

      const result = createTileTypeToDocumentsMap([docWithPlaceholder, docWithUnknown]);

      expect(result.has("No Tools")).toBe(true);
      expect(result.get("No Tools")?.documents).toHaveLength(2);
      expect(result.has("Placeholder")).toBe(false);
      expect(result.has("Unknown")).toBe(false);
    });
  });

  describe("getTagsWithDocs", () => {
    it("groups documents by configured tags and puts untagged documents in 'Not Tagged'", () => {
      const commentTags = { foo: "Foo", bar: "Bar" };
      const tagged = createMockDocument({ key: "d1", strategies: ["foo"] } as any);
      const untagged = createMockDocument({ key: "d2" });
      const result = getTagsWithDocs([tagged, untagged], commentTags);
      expect(result.foo.docKeysFoundWithTag).toContain("d1");
      expect(result[""].tagValue).toBe("Not Tagged");
      expect(result[""].docKeysFoundWithTag).toContain("d2");
    });

    it("creates a group for a strategy not in the tag map (orphan guard), labeled by its id", () => {
      const commentTags = { foo: "Foo" };
      // "custom-tag" is on the document but not in the configured tag map (e.g. a custom tag from
      // a different unit when sorting by tag across the whole unit). It must still form a group so
      // the document is not orphaned from the tag sort.
      const doc = createMockDocument({ key: "d1", strategies: ["custom-tag"] } as any);
      const result = getTagsWithDocs([doc], commentTags);
      expect(result["custom-tag"]).toBeDefined();
      expect(result["custom-tag"].tagValue).toBe("custom-tag");
      expect(result["custom-tag"].docKeysFoundWithTag).toContain("d1");
    });
  });

  describe("sortProblemSectionLabels", () => {
    beforeEach(() => {
      clearTermOverrides();
    });

    afterEach(() => {
      clearTermOverrides();
    });

    it("should sort problem labels in correct numerical order", () => {
      const labels = ["Problem 3", "Problem 1", "Problem 2"];
      const sorted = sortProblemSectionLabels([...labels]);

      expect(sorted).toEqual(["Problem 1", "Problem 2", "Problem 3"]);
    });

    it("should sort problem labels with investigation.problem format", () => {
      const labels = ["Problem 2.1", "Problem 1.2", "Problem 1.1", "Problem 2.2"];
      const sorted = sortProblemSectionLabels([...labels]);

      expect(sorted).toEqual(["Problem 1.1", "Problem 1.2", "Problem 2.1", "Problem 2.2"]);
    });

    it("should sort mixed format labels correctly", () => {
      const labels = ["Problem 2.1", "Problem 3", "Problem 1.1", "Problem 2"];
      const sorted = sortProblemSectionLabels([...labels]);

      // Problems without investigation (treated as investigation 0) come first
      expect(sorted).toEqual(["Problem 2", "Problem 3", "Problem 1.1", "Problem 2.1"]);
    });

    it("should place 'No Problem' at the end", () => {
      const labels = ["Problem 2", "No Problem", "Problem 1"];
      const sorted = sortProblemSectionLabels([...labels]);

      expect(sorted).toEqual(["Problem 1", "Problem 2", "No Problem"]);
    });

    it("should handle 'No Problem' as the only element", () => {
      const labels = ["No Problem"];
      const sorted = sortProblemSectionLabels([...labels]);

      expect(sorted).toEqual(["No Problem"]);
    });

    it("should work with custom Problem term", () => {
      setTermOverrides({ "contentLevel.problem": "Question" });

      const labels = ["Question 2", "No Question", "Question 1"];
      const sorted = sortProblemSectionLabels([...labels]);

      expect(sorted).toEqual(["Question 1", "Question 2", "No Question"]);
    });

    it("should work with custom Problem term and investigation format", () => {
      setTermOverrides({ "contentLevel.problem": "Question" });

      const labels = ["Question 1.2", "No Question", "Question 1.1", "Question 2.1"];
      const sorted = sortProblemSectionLabels([...labels]);

      expect(sorted).toEqual(["Question 1.1", "Question 1.2", "Question 2.1", "No Question"]);
    });

    it("should handle empty array", () => {
      const sorted = sortProblemSectionLabels([]);
      expect(sorted).toEqual([]);
    });

    it("should handle single problem label", () => {
      const labels = ["Problem 1.1"];
      const sorted = sortProblemSectionLabels([...labels]);

      expect(sorted).toEqual(["Problem 1.1"]);
    });
  });

  describe("sortGroupSections", () => {
    const keys = (entries: Array<[string, GroupSectionSortKey]>) => new Map(entries);

    it("puts the whole-class section first, groups in numeric order, and no-group last", () => {
      const labels = ["No Group", "Group 10", "Whole Class", "Group 2"];
      const sorted = sortGroupSections(labels, keys([
        ["No Group", { section: "none" }],
        ["Group 10", { section: "group", groupId: "10" }],
        ["Whole Class", { section: "class" }],
        ["Group 2", { section: "group", groupId: "2" }],
      ]));
      expect(sorted).toEqual(["Whole Class", "Group 2", "Group 10", "No Group"]);
    });

    it("orders non-numeric group ids after numeric ones, alphabetically", () => {
      const labels = ["Group b", "Group 3", "Group a"];
      const sorted = sortGroupSections(labels, keys([
        ["Group b", { section: "group", groupId: "b" }],
        ["Group 3", { section: "group", groupId: "3" }],
        ["Group a", { section: "group", groupId: "a" }],
      ]));
      expect(sorted).toEqual(["Group 3", "Group a", "Group b"]);
    });

    it("does not read the label text — a renamed group term still sorts numerically", () => {
      // The comparator must not infer order from the display string; `studentGroup` is overridable
      // per unit, so "Team 2" and "Group 2" must sort identically.
      const labels = ["Team 10", "Team 2"];
      const sorted = sortGroupSections(labels, keys([
        ["Team 10", { section: "group", groupId: "10" }],
        ["Team 2", { section: "group", groupId: "2" }],
      ]));
      expect(sorted).toEqual(["Team 2", "Team 10"]);
    });

    it("orders a digit-prefixed group id after the numeric ones, not alongside its leading digit", () => {
      // Under `autoAssignStudentsToIndividualGroups` a group id is a user id, which in demo mode can be
      // a nanoid — and a nanoid starts with a digit about one time in six. Reading only the leading
      // digits would file "3xK9mQ" as group 3, tying it with the real group 3 and leaving the two in
      // whatever order they arrived in.
      const labels = ["Group 3xK9mQ", "Group 4", "Group 3"];
      const sorted = sortGroupSections(labels, keys([
        ["Group 3xK9mQ", { section: "group", groupId: "3xK9mQ" }],
        ["Group 4", { section: "group", groupId: "4" }],
        ["Group 3", { section: "group", groupId: "3" }],
      ]));
      expect(sorted).toEqual(["Group 3", "Group 4", "Group 3xK9mQ"]);
    });

    it("treats a label with no sort key as no-group", () => {
      const sorted = sortGroupSections(["Mystery", "Whole Class"], keys([["Whole Class", { section: "class" }]]));
      expect(sorted).toEqual(["Whole Class", "Mystery"]);
    });
  });
});
