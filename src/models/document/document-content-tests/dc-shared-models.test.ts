// This import needs to be first so the jest.mock calls in it
// are run before the next import statements
import { getSnapshot } from "mobx-state-tree";
import { parsedExport, getColumnWidths } from "./dc-test-utils";
import { DocumentContentModel, DocumentContentModelType, DocumentContentSnapshotType } from "../document-content";
import { SharedDataSetSnapshotType } from "../../shared/shared-data-set";
import { SharedModelEntryType } from "../shared-model-entry";
import { IDropRowInfo } from "../tile-row";

import { IDocumentImportSnapshot } from "../document-content-import-types";
import { SharedModelDocumentManager } from "../shared-model-document-manager";
import { ITileEnvironment } from "../../tiles/tile-content";

import "../../../plugins/diagram-viewer/diagram-registration";

// mock Logger calls
const mockLogTileCopyEvent = jest.fn();
jest.mock("../../tiles/log/log-tile-copy-event", () => ({
  logTileCopyEvent: (...args: any[]) => mockLogTileCopyEvent()
}));
const mockLogTileDocumentEvent = jest.fn();
jest.mock("../../tiles/log/log-tile-document-event", () => ({
  logTileDocumentEvent: (...args: any[]) => mockLogTileDocumentEvent()
}));

/*
  This can be opened with: http://localhost:8080/editor/
*/
import sharedModelExample from "./shared-model-example.json";
const srcContent: IDocumentImportSnapshot = sharedModelExample.content;

// mock newCaseId so auto-generated IDs are consistent
// IDs generated with uniqueId are already doing this, but I'm not sure why.
// A similar mock function is defined for it in drag-tiles.test.ts
let caseCount = 0;
jest.mock("../../data/data-set", () => {
  const { newCaseId, ...others } = jest.requireActual("../../data/data-set");
  return {
    newCaseId: () => `caseid-${caseCount++}`,
    ...others
  };
});

// Utility function to help with typing and also to setup the sharedModelManager
function createDocumentContentModel(snapshot: IDocumentImportSnapshot) {
  const sharedModelManager = new SharedModelDocumentManager();
  const environment: ITileEnvironment = { sharedModelManager };
  const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
  sharedModelManager.setDocument(content);
  return content;
}

/**
 * Asserts everything a copied shared dataset has to carry. Checking that it arrived is not enough
 * on its own: a copy that made the wrapper but dropped the data would look the same from outside.
 */
function expectCopiedDataSet(copiedShared: SharedModelEntryType, copiedTableId: string) {
  const entry = getSnapshot(copiedShared);
  // Rewired onto the copy. Left as "tableTool", the dataset would name a tile in another document.
  expect(entry.provider).toEqual(copiedTableId);
  // The snapshot's sharedModel is the union's base type, which has no dataSet of its own.
  const sharedModel = entry.sharedModel as SharedDataSetSnapshotType;
  expect(sharedModel.providerId).toEqual(copiedTableId);

  const dataSet = sharedModel.dataSet!;
  expect(dataSet.attributes!.map(attr => attr.name)).toEqual(["x", "y"]);
  expect(dataSet.attributes![0].values).toEqual(["1", "2", "3"]);
  expect(dataSet.cases).toHaveLength(3);
  // Fresh ids, so editing the copy cannot reach back into the source's attributes.
  expect(dataSet.attributes!.map(attr => attr.id)).not.toEqual(["attribute1", "attribute2"]);
}

describe("DocumentContentModel -- shared Models --", () => {

  let documentContent: DocumentContentModelType;
  let columnWidths: Record<string, number>;

  function getDocumentDragTileItems(tileIds: string[]) {
    return documentContent.getDragTileItems(tileIds);
  }

  beforeEach(() => {
    documentContent = createDocumentContentModel(srcContent);
    const tableTileIds = documentContent.getTilesOfType("Table");
    columnWidths = getColumnWidths(documentContent, tableTileIds[0]);
  });

  it("can export content with shared models", () => {
    expect(parsedExport(documentContent)).toEqual({
      tiles: [
        [
          { content: { type: "Table", columnWidths } },
          { content: {
            type: "Geometry",
            objects: {},
            linkedAttributeColors: {},
            pointMetadata: {},
            isNavigatorVisible: true,
            navigatorPosition: "bottom",
            zoom: 1,
            offsetX: 0,
            offsetY: 0
          } }
        ]
      ],
      sharedModels: [
        {
          provider: "tableTool",
          tiles: ["tableTool", "graphTool"],
          sharedModel: {
            type: "SharedDataSet",
            id: "sharedDataSet1",
            providerId: "tableTool",
            dataSet: {
              id: "dataSet1",
              name: "Demo Dataset",
              sortDirection: "NONE",
              attributes: [
                {
                  clientKey: "",
                  formula: { display: "" },
                  hidden: false,
                  id: "attribute1",
                  name: "x",
                  title: "",
                  units: "",
                  values: [ "1", "2", "3"]
                },
                {
                  clientKey: "",
                  formula: { display: "" },
                  hidden: false,
                  id: "attribute2",
                  name: "y",
                  title: "",
                  units: "",
                  values: ["-1", "0", "1"]
                }
              ],
              cases: [
                {__id__: "HR3at2-RqvnRaT9z" },
                {__id__: "O3SmGUb4iRPw29HU" },
                {__id__: "76WRbhQpTu2Wqy1c" }
              ]
            }
          }
        }
      ]
    });
  });

  describe("single tile moves", () => {
    it("can move a tile within its own row before another tile in its own row", () => {
      // move tableTool to the right of graphTool
      const dragTiles = getDocumentDragTileItems(["tableTool"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: documentContent.getRowByIndex(0)!.id,
        rowDropLocation: "right"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      // A move reorders the row; it must not duplicate the tile or its shared model.
      const movedOrder = documentContent.getAllTilesInRow(documentContent.getRowByIndex(0)!.id)
                           .map(tile => tile.id);
      expect(movedOrder).toEqual(["graphTool", "tableTool"]);
      expect(documentContent.tileMap.size).toEqual(2);

      expect(documentContent.sharedModelMap.size).toEqual(1);

      const sharedDataSet = documentContent.sharedModelMap.get("sharedDataSet1");
      expect(sharedDataSet).toBeDefined();
      const sharedDataSetSnasphot = getSnapshot(sharedDataSet!);
      expect(sharedDataSetSnasphot.tiles).toEqual(["tableTool", "graphTool"]);
    });
  });

  describe("single tile copies", () => {
    it("can copy a tile into another empty document", () => {
      const dragTileInfo = documentContent.getDragTiles(["tableTool"]);
      const targetDocument = createDocumentContentModel({tiles: []});
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0
      };
      targetDocument.handleDragCopyTiles(dragTileInfo, dropRowInfo);
      // The copy lands as the only tile in the only row, under a new id, and the shared dataset
      // comes with it rewired to that id rather than the source tile's.
      expect(targetDocument.rowOrder).toHaveLength(1);
      const copiedIds = targetDocument.getTilesInDocumentOrder();
      expect(copiedIds).toHaveLength(1);
      expect(copiedIds[0]).not.toEqual("tableTool");
      expect(targetDocument.tileMap.get(copiedIds[0])!.content.type).toEqual("Table");

      expect(targetDocument.sharedModelMap.size).toEqual(1);
      const copiedShared = Array.from(targetDocument.sharedModelMap.values())[0];
      expect(getSnapshot(copiedShared).tiles).toEqual(copiedIds);

      expectCopiedDataSet(copiedShared, copiedIds[0]);
    });

    it("can copy a tile into another document's row", () => {
      const dragTileInfo = documentContent.getDragTiles(["tableTool"]);
      // The import doc needs to have a tile in the row for the first
      // row to be created
      const targetDocument = createDocumentContentModel({
        tiles: [{ "id": "textTool", "content": {"type": "Text" }}]
      });
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: targetDocument.getRowByIndex(0)!.id,
        rowDropLocation: "right"
      };
      targetDocument.handleDragCopyTiles(dragTileInfo, dropRowInfo);
      // The copy joins the existing row beside the text tile rather than making a row of its own.
      expect(targetDocument.rowOrder).toHaveLength(1);
      const rowTileIds = targetDocument.getAllTilesInRow(targetDocument.getRowByIndex(0)!.id)
                           .map(tile => tile.id);
      expect(rowTileIds).toHaveLength(2);
      expect(rowTileIds[0]).toEqual("textTool");

      const copiedId = rowTileIds[1];
      expect(copiedId).not.toEqual("tableTool");
      expect(targetDocument.tileMap.get(copiedId)!.content.type).toEqual("Table");

      expect(targetDocument.sharedModelMap.size).toEqual(1);
      const copiedShared = Array.from(targetDocument.sharedModelMap.values())[0];
      expect(getSnapshot(copiedShared).tiles).toEqual([copiedId]);

      expectCopiedDataSet(copiedShared, copiedId);
    });

  });

  describe("multiple tile copies", () => {
    it("can copy two tiles into another document", () => {
      const dragTileInfo = documentContent.getDragTiles(["tableTool", "graphTool"]);
      const targetDocument = createDocumentContentModel({tiles: []});
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0
      };
      targetDocument.handleDragCopyTiles(dragTileInfo, dropRowInfo);
      // Both tiles arrive, and the one dataset they shared is copied once rather than twice, with
      // both copies referencing it.
      const copiedIds = targetDocument.getTilesInDocumentOrder();
      expect(copiedIds).toHaveLength(2);
      expect(copiedIds.map(id => targetDocument.tileMap.get(id)!.content.type))
        .toEqual(["Table", "Geometry"]);

      expect(targetDocument.sharedModelMap.size).toEqual(1);
      const copiedShared = Array.from(targetDocument.sharedModelMap.values())[0];
      expect(getSnapshot(copiedShared).tiles).toEqual(copiedIds);

      expectCopiedDataSet(copiedShared, copiedIds[0]);
    });
  });

  it("queries for consumer and provider tiles", () => {
    const { consumers, providers } = documentContent.getLinkableTiles();
    expect(providers).toHaveLength(1);
    expect(providers[0].type).toEqual("Table");
    expect(consumers).toHaveLength(2);
    expect(consumers.map(t => t.type).sort()).toEqual(["Geometry", "Table"]);
  });

});
