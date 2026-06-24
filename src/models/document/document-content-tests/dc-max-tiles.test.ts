import { Instance } from "mobx-state-tree";

import { registerTileTypes } from "../../../register-tile-types";
import { TreeManager } from "../../history/tree-manager";
import { expectEntryToBeComplete } from "../../history/undo-store-test-utils";
import { specAppConfig } from "../../stores/spec-app-config";
import { resetMockUniqueId, setupDocumentContent } from "./dc-test-utils";
import { createDocumentModelWithEnv, DocumentModelType } from "../document";
import { DocumentContentSnapshotType } from "../document-content";
import { ProblemDocument } from "../document-types";
import multipleTilesExamples from "./multiple-tiles-example.json";

// This is needed so MST can deserialize snapshots referring to tools
registerTileTypes(["Text"]);

// mock Logger calls; the high-level copy/duplicate paths log copy events, which
// require a Logger context that isn't set up in these isolated model tests.
const mockLogTileCopyEvent = jest.fn();
jest.mock("../../tiles/log/log-tile-copy-event", () => ({
  logTileCopyEvent: (...args: any[]) => mockLogTileCopyEvent()
}));
// const mockLogTileDocumentEvent = jest.fn();
// jest.mock("../../tiles/log/log-tile-document-event", () => ({
//   logTileDocumentEvent: (...args: any[]) => mockLogTileDocumentEvent()
// }));
const mockLogTileDocumentEvent = jest.fn();
jest.mock("../../tiles/log/log-tile-document-event", () => ({
  logTileDocumentEvent: (event: any, _params: any, runBeforeContainerLogging?: () => void) => {
    mockLogTileDocumentEvent();
    runBeforeContainerLogging?.();
  }
}));
const mockLogDocumentEvent = jest.fn();
jest.mock("../log-document-event", () => ({
  logDocumentEvent: (...args: any[]) => mockLogDocumentEvent()
}));

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

  describe("copyTiles enforcement", () => {
    it("duplicating over the limit evicts the oldest, keeping the duplicate", () => {
      const { documentContent } = setupDocumentContent(srcContent, {
        drawing: { maxTiles: 2 }
      });
      expect(documentContent.getTilesOfType("Drawing")).toEqual(["drawingTool1", "drawingTool2"]);

      const items = documentContent.getDragTileItems(["drawingTool2"]);
      documentContent.duplicateTiles(items);

      const drawings = documentContent.getTilesOfType("Drawing");
      expect(drawings.length).toBe(2);
      expect(drawings).not.toContain("drawingTool1");
      expect(drawings).toContain("drawingTool2");
    });

    it("only returns tiles that are still in the document after eviction", () => {
      // limit 1; copy BOTH existing drawings so the pasted batch (2) exceeds the
      // limit. The older of the two copies is evicted, so copyTiles must not
      // return it.
      const { documentContent } = setupDocumentContent(srcContent, {
        drawing: { maxTiles: 1 }
      });
      const rowId = documentContent.rowOrder[documentContent.rowOrder.length - 1];
      const rowInfo = {
        rowDropId: rowId,
        rowInsertIndex: documentContent.getRowIndex(rowId) + 1,
        rowDropLocation: "bottom" as const
      };
      const items = documentContent.getDragTileItems(["drawingTool1", "drawingTool2"]);
      const returned = documentContent.copyTiles(items, [], [], false, rowInfo);

      // Every returned tile id must actually exist in the document.
      returned.forEach(t => {
        expect(t.newTileId && documentContent.getTile(t.newTileId)).toBeTruthy();
      });
      // Net effect: a single surviving drawing.
      expect(documentContent.getTilesOfType("Drawing").length).toBe(1);
    });
  });
});

describe("DocumentContentModel -- maxTiles single undo --", () => {
  it("reverts both the copy and the eviction in a single undo", async () => {
    const appConfig = specAppConfig({ config: { settings: { text: { maxTiles: 2 } } } });
    const document: DocumentModelType = createDocumentModelWithEnv(appConfig, {
      type: ProblemDocument,
      uid: "1",
      key: "test",
      createdAt: 1,
      content: {},
      visibility: "public"
    });
    const content = document.content!;

    // Seed two text tiles before enabling monitoring so they aren't part of undo history.
    const t1 = document.addTile("text")!.tileId;
    const t2 = document.addTile("text")!.tileId;
    expect(content.getTilesOfType("Text")).toEqual([t1, t2]);

    document.treeMonitor!.enableMonitoring();
    const manager = document.treeManagerAPI as Instance<typeof TreeManager>;

    // Duplicate t2; this would make 3 text tiles, but the limit is 2, so the
    // oldest (t1) is evicted in the same action.
    const items = content.getDragTileItems([t2]);
    content.duplicateTiles(items);
    await expectEntryToBeComplete(manager, 1);

    const afterCopy = content.getTilesOfType("Text");
    expect(afterCopy.length).toBe(2);
    expect(afterCopy).not.toContain(t1); // oldest evicted
    expect(afterCopy).toContain(t2);

    // A single undo must restore the original two tiles: t1 returns and the
    // duplicate is removed.
    document.undoLastAction();
    await expectEntryToBeComplete(manager, 2);
    expect(content.getTilesOfType("Text")).toEqual([t1, t2]);
  });
});
