import { observable } from "mobx";
import { mock } from "ts-jest-mocker";
import { IDocumentMetadataModel } from "../models/document/document-metadata-model";
import { Bookmark, Bookmarks } from "../models/stores/bookmarks";
import { DB } from "../lib/db";
import {
  createDocMapByBookmarks,
  createDocMapByGroups,
  createTileTypeToDocumentsMap,
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

  describe("createDocMapByGroups", () => {
    it("should use default group term when not specified", () => {
      const doc1 = createMockDocument({ uid: "user1", key: "doc1" });
      const doc2 = createMockDocument({ uid: "user2", key: "doc2" });
      const groupForUser = (userId: string) => {
        if (userId === "user1") return { id: "1" };
        return null;
      };

      const result = createDocMapByGroups([doc1, doc2], groupForUser);

      expect(result.has("Group 1")).toBe(true);
      expect(result.has("No Group")).toBe(true);
    });

    it("should use custom group term when specified", () => {
      const doc1 = createMockDocument({ uid: "user1", key: "doc1" });
      const doc2 = createMockDocument({ uid: "user2", key: "doc2" });
      const groupForUser = (userId: string) => {
        if (userId === "user1") return { id: "1" };
        return null;
      };

      const result = createDocMapByGroups([doc1, doc2], groupForUser, "Team");

      expect(result.has("Team 1")).toBe(true);
      expect(result.has("No Team")).toBe(true);
      expect(result.has("Group 1")).toBe(false);
      expect(result.has("No Group")).toBe(false);
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
});
