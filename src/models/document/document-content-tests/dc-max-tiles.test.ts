import { resetMockUniqueId, setupDocumentContent } from "./dc-test-utils";
import { DocumentContentSnapshotType } from "../document-content";
import multipleTilesExamples from "./multiple-tiles-example.json";

describe("DocumentContentModel -- maxTiles --", () => {
  const srcContent: DocumentContentSnapshotType = multipleTilesExamples.content;

  beforeEach(() => resetMockUniqueId());

  describe("getMaxTilesOfType", () => {
    it("reads maxTiles from settings, case-insensitively, and is undefined when unset", () => {
      const { documentContent } = setupDocumentContent(srcContent, {
        drawing: { maxTiles: 2 }
      });
      expect(documentContent.getMaxTilesOfType("Drawing")).toBe(2);
      expect(documentContent.getMaxTilesOfType("drawing")).toBe(2);
      expect(documentContent.getMaxTilesOfType("Text")).toBeUndefined();
    });

    it("returns undefined when there is no appConfig", () => {
      const { documentContent } = setupDocumentContent(srcContent);
      expect(documentContent.getMaxTilesOfType("Drawing")).toBeUndefined();
    });
  });
});
