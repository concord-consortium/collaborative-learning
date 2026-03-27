// This import needs to be first so the jest.mock calls in it
// are run before the next import statements
import { getSnapshot } from "mobx-state-tree";
import { parsedExport, getColumnWidths } from "./dc-test-utils";
import { DocumentContentModel, DocumentContentModelType, DocumentContentSnapshotType } from "../document-content";
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
      expect(getSnapshot(documentContent)).toMatchInlineSnapshot(`
{
  "annotations": {},
  "rowMap": {
    "testid-6": {
      "height": undefined,
      "id": "testid-6",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": [
        {
          "tileId": "graphTool",
          "widthPct": undefined,
        },
        {
          "tileId": "tableTool",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": [
    "testid-6",
  ],
  "sharedModelMap": {
    "sharedDataSet1": {
      "provider": "tableTool",
      "sharedModel": {
        "dataSet": {
          "attributes": [
            {
              "clientKey": "",
              "description": undefined,
              "formula": {
                "display": "",
              },
              "hidden": false,
              "id": "attribute1",
              "name": "x",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": [
                "1",
                "2",
                "3",
              ],
            },
            {
              "clientKey": "",
              "description": undefined,
              "formula": {
                "display": "",
              },
              "hidden": false,
              "id": "attribute2",
              "name": "y",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": [
                "-1",
                "0",
                "1",
              ],
            },
          ],
          "cases": [
            {
              "__id__": "HR3at2-RqvnRaT9z",
            },
            {
              "__id__": "O3SmGUb4iRPw29HU",
            },
            {
              "__id__": "76WRbhQpTu2Wqy1c",
            },
          ],
          "id": "dataSet1",
          "name": "Demo Dataset",
          "sortByAttribute": undefined,
          "sortDirection": "NONE",
          "sourceID": undefined,
        },
        "id": "sharedDataSet1",
        "providerId": "tableTool",
        "type": "SharedDataSet",
      },
      "tiles": [
        "tableTool",
        "graphTool",
      ],
    },
  },
  "tileMap": {
    "graphTool": {
      "content": {
        "bgImage": undefined,
        "board": {
          "xAxis": {
            "label": undefined,
            "min": -2,
            "name": undefined,
            "range": undefined,
            "unit": 18.3,
          },
          "yAxis": {
            "label": undefined,
            "min": -1,
            "name": undefined,
            "range": undefined,
            "unit": 18.3,
          },
        },
        "isNavigatorVisible": true,
        "linkedAttributeColors": {},
        "navigatorPosition": "bottom",
        "objects": {},
        "offsetX": 0,
        "offsetY": 0,
        "pointMetadata": {},
        "type": "Geometry",
        "zoom": 1,
      },
      "createdHash": "5faefa6a838fb8d6c69e520146666176cce3219ed34cad6cf82c438ca8adf6a0",
      "display": undefined,
      "fixedPosition": false,
      "id": "graphTool",
      "title": undefined,
      "updatedHash": "5faefa6a838fb8d6c69e520146666176cce3219ed34cad6cf82c438ca8adf6a0",
    },
    "tableTool": {
      "content": {
        "columnWidths": {},
        "importedDataSet": {
          "attributes": [],
          "cases": [],
          "id": "testid-7",
          "name": undefined,
          "sortByAttribute": undefined,
          "sortDirection": "NONE",
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "createdHash": "9715aa61a8206041413d8b00982ad72ca4ac872cc93dc1aab1a6e394ecad6991",
      "display": undefined,
      "fixedPosition": false,
      "id": "tableTool",
      "title": undefined,
      "updatedHash": "9715aa61a8206041413d8b00982ad72ca4ac872cc93dc1aab1a6e394ecad6991",
    },
  },
}
`);

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
      // FIXME: the ids here are not going to be consistent, so we should
      // reset them in beforeEach
      expect(getSnapshot(targetDocument)).toMatchInlineSnapshot(`
{
  "annotations": {},
  "rowMap": {
    "testid-21": {
      "height": undefined,
      "id": "testid-21",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": [
        {
          "tileId": "testid-20",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": [
    "testid-21",
  ],
  "sharedModelMap": {
    "testid-17": {
      "provider": "testid-20",
      "sharedModel": {
        "dataSet": {
          "attributes": [
            {
              "clientKey": "",
              "description": undefined,
              "formula": {
                "display": "",
              },
              "hidden": false,
              "id": "testid-18",
              "name": "x",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": [
                "1",
                "2",
                "3",
              ],
            },
            {
              "clientKey": "",
              "description": undefined,
              "formula": {
                "display": "",
              },
              "hidden": false,
              "id": "testid-19",
              "name": "y",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": [
                "-1",
                "0",
                "1",
              ],
            },
          ],
          "cases": [
            {
              "__id__": "caseid-0",
            },
            {
              "__id__": "caseid-1",
            },
            {
              "__id__": "caseid-2",
            },
          ],
          "id": "testid-16",
          "name": "Demo Dataset",
          "sortByAttribute": undefined,
          "sortDirection": "NONE",
          "sourceID": undefined,
        },
        "id": "testid-17",
        "providerId": "testid-20",
        "type": "SharedDataSet",
      },
      "tiles": [
        "testid-20",
      ],
    },
  },
  "tileMap": {
    "testid-20": {
      "content": {
        "columnWidths": {},
        "importedDataSet": {
          "attributes": [],
          "cases": [],
          "id": "testid-12",
          "name": undefined,
          "sortByAttribute": undefined,
          "sortDirection": "NONE",
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "createdHash": "0aeddcb588714035abc5feadb188e793ad31d8008d19d5b8743e7eb260a69e22",
      "display": undefined,
      "fixedPosition": false,
      "id": "testid-20",
      "title": undefined,
      "updatedHash": "0aeddcb588714035abc5feadb188e793ad31d8008d19d5b8743e7eb260a69e22",
    },
  },
}
`);
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
      // FIXME: the ids here are not going to be consistent, so we should
      // reset them in beforeEach
      expect(getSnapshot(targetDocument)).toMatchInlineSnapshot(`
{
  "annotations": {},
  "rowMap": {
    "testid-28": {
      "height": undefined,
      "id": "testid-28",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": [
        {
          "tileId": "textTool",
          "widthPct": undefined,
        },
        {
          "tileId": "testid-34",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": [
    "testid-28",
  ],
  "sharedModelMap": {
    "testid-31": {
      "provider": "testid-34",
      "sharedModel": {
        "dataSet": {
          "attributes": [
            {
              "clientKey": "",
              "description": undefined,
              "formula": {
                "display": "",
              },
              "hidden": false,
              "id": "testid-32",
              "name": "x",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": [
                "1",
                "2",
                "3",
              ],
            },
            {
              "clientKey": "",
              "description": undefined,
              "formula": {
                "display": "",
              },
              "hidden": false,
              "id": "testid-33",
              "name": "y",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": [
                "-1",
                "0",
                "1",
              ],
            },
          ],
          "cases": [
            {
              "__id__": "caseid-3",
            },
            {
              "__id__": "caseid-4",
            },
            {
              "__id__": "caseid-5",
            },
          ],
          "id": "testid-30",
          "name": "Demo Dataset",
          "sortByAttribute": undefined,
          "sortDirection": "NONE",
          "sourceID": undefined,
        },
        "id": "testid-31",
        "providerId": "testid-34",
        "type": "SharedDataSet",
      },
      "tiles": [
        "testid-34",
      ],
    },
  },
  "tileMap": {
    "testid-34": {
      "content": {
        "columnWidths": {},
        "importedDataSet": {
          "attributes": [],
          "cases": [],
          "id": "testid-24",
          "name": undefined,
          "sortByAttribute": undefined,
          "sortDirection": "NONE",
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "createdHash": "bf6efb008cb9048ef82b551651c76a15ed948932a17ca38054ab3f2e26942395",
      "display": undefined,
      "fixedPosition": false,
      "id": "testid-34",
      "title": undefined,
      "updatedHash": "bf6efb008cb9048ef82b551651c76a15ed948932a17ca38054ab3f2e26942395",
    },
    "textTool": {
      "content": {
        "format": undefined,
        "highlightedText": [],
        "text": "",
        "type": "Text",
      },
      "createdHash": "7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674",
      "display": undefined,
      "fixedPosition": false,
      "id": "textTool",
      "title": undefined,
      "updatedHash": "7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674",
    },
  },
}
`);
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
      // FIXME: the ids here are not going to be consistent, so we should
      // reset them in beforeEach
      expect(getSnapshot(targetDocument)).toMatchInlineSnapshot(`
{
  "annotations": {},
  "rowMap": {
    "testid-48": {
      "height": undefined,
      "id": "testid-48",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": [
        {
          "tileId": "testid-46",
          "widthPct": undefined,
        },
        {
          "tileId": "testid-47",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": [
    "testid-48",
  ],
  "sharedModelMap": {
    "testid-43": {
      "provider": "testid-46",
      "sharedModel": {
        "dataSet": {
          "attributes": [
            {
              "clientKey": "",
              "description": undefined,
              "formula": {
                "display": "",
              },
              "hidden": false,
              "id": "testid-44",
              "name": "x",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": [
                "1",
                "2",
                "3",
              ],
            },
            {
              "clientKey": "",
              "description": undefined,
              "formula": {
                "display": "",
              },
              "hidden": false,
              "id": "testid-45",
              "name": "y",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": [
                "-1",
                "0",
                "1",
              ],
            },
          ],
          "cases": [
            {
              "__id__": "caseid-6",
            },
            {
              "__id__": "caseid-7",
            },
            {
              "__id__": "caseid-8",
            },
          ],
          "id": "testid-42",
          "name": "Demo Dataset",
          "sortByAttribute": undefined,
          "sortDirection": "NONE",
          "sourceID": undefined,
        },
        "id": "testid-43",
        "providerId": "testid-46",
        "type": "SharedDataSet",
      },
      "tiles": [
        "testid-46",
        "testid-47",
      ],
    },
  },
  "tileMap": {
    "testid-46": {
      "content": {
        "columnWidths": {},
        "importedDataSet": {
          "attributes": [],
          "cases": [],
          "id": "testid-37",
          "name": undefined,
          "sortByAttribute": undefined,
          "sortDirection": "NONE",
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "createdHash": "ce1722ac802435259cd5159bc84abc42e4c04111d0b538d13cd5af2edeced810",
      "display": undefined,
      "fixedPosition": false,
      "id": "testid-46",
      "title": undefined,
      "updatedHash": "ce1722ac802435259cd5159bc84abc42e4c04111d0b538d13cd5af2edeced810",
    },
    "testid-47": {
      "content": {
        "bgImage": undefined,
        "board": {
          "xAxis": {
            "label": undefined,
            "min": -2,
            "name": undefined,
            "range": undefined,
            "unit": 18.3,
          },
          "yAxis": {
            "label": undefined,
            "min": -1,
            "name": undefined,
            "range": undefined,
            "unit": 18.3,
          },
        },
        "isNavigatorVisible": true,
        "linkedAttributeColors": {},
        "navigatorPosition": "bottom",
        "objects": {},
        "offsetX": 0,
        "offsetY": 0,
        "pointMetadata": {},
        "type": "Geometry",
        "zoom": 1,
      },
      "createdHash": "5faefa6a838fb8d6c69e520146666176cce3219ed34cad6cf82c438ca8adf6a0",
      "display": undefined,
      "fixedPosition": false,
      "id": "testid-47",
      "title": undefined,
      "updatedHash": "5faefa6a838fb8d6c69e520146666176cce3219ed34cad6cf82c438ca8adf6a0",
    },
  },
}
`);
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
