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

  describe("evictTilesOverLimit", () => {
    // The example document contains drawingTool1 (oldest) then drawingTool2,
    // and textTool1 then textTool2, in document order.

    it("evicts the oldest pre-existing tile first, keeping the new tile", () => {
      const { documentContent } = setupDocumentContent(srcContent, {
        drawing: { maxTiles: 1 }
      });
      // Treat drawingTool2 as the freshly added tile; it must survive.
      documentContent.evictTilesOverLimit(["drawingTool2"]);
      expect(documentContent.getTilesOfType("Drawing")).toEqual(["drawingTool2"]);
    });

    it("keeps only the newest of the batch when the batch exceeds the limit", () => {
      const { documentContent } = setupDocumentContent(srcContent, {
        drawing: { maxTiles: 1 }
      });
      // Both drawings are "new"; drawingTool2 is later in document order (newest).
      documentContent.evictTilesOverLimit(["drawingTool1", "drawingTool2"]);
      expect(documentContent.getTilesOfType("Drawing")).toEqual(["drawingTool2"]);
    });

    it("does nothing when no maxTiles is set for the type", () => {
      const { documentContent } = setupDocumentContent(srcContent, {
        drawing: { maxTiles: 1 }
      });
      const before = documentContent.getTilesOfType("Text");
      documentContent.evictTilesOverLimit(["textTool2"]);
      expect(documentContent.getTilesOfType("Text")).toEqual(before);
    });

    it("does nothing when already within the limit", () => {
      const { documentContent } = setupDocumentContent(srcContent, {
        drawing: { maxTiles: 5 }
      });
      const before = documentContent.getTilesOfType("Drawing");
      documentContent.evictTilesOverLimit(["drawingTool2"]);
      expect(documentContent.getTilesOfType("Drawing")).toEqual(before);
    });
  });
});
