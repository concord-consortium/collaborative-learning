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
Object {
  "annotations": Object {},
  "rowMap": Object {
    "testid-6": Object {
      "height": undefined,
      "id": "testid-6",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "graphTool",
          "widthPct": undefined,
        },
        Object {
          "tileId": "tableTool",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": Array [
    "testid-6",
  ],
  "sharedModelMap": Object {
    "sharedDataSet1": Object {
      "provider": "tableTool",
      "sharedModel": Object {
        "dataSet": Object {
          "attributes": Array [
            Object {
              "clientKey": "",
              "description": undefined,
              "formula": Object {
                "display": "",
              },
              "hidden": false,
              "id": "attribute1",
              "name": "x",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": Array [
                "1",
                "2",
                "3",
              ],
            },
            Object {
              "clientKey": "",
              "description": undefined,
              "formula": Object {
                "display": "",
              },
              "hidden": false,
              "id": "attribute2",
              "name": "y",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": Array [
                "-1",
                "0",
                "1",
              ],
            },
          ],
          "cases": Array [
            Object {
              "__id__": "HR3at2-RqvnRaT9z",
            },
            Object {
              "__id__": "O3SmGUb4iRPw29HU",
            },
            Object {
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
      "tiles": Array [
        "tableTool",
        "graphTool",
      ],
    },
  },
  "tileMap": Object {
    "graphTool": Object {
      "content": Object {
        "bgImage": undefined,
        "board": Object {
          "xAxis": Object {
            "label": undefined,
            "min": -2,
            "name": undefined,
            "range": undefined,
            "unit": 18.3,
          },
          "yAxis": Object {
            "label": undefined,
            "min": -1,
            "name": undefined,
            "range": undefined,
            "unit": 18.3,
          },
        },
        "isNavigatorVisible": true,
        "linkedAttributeColors": Object {},
        "navigatorPosition": "bottom",
        "objects": Object {},
        "offsetX": 0,
        "offsetY": 0,
        "pointMetadata": Object {},
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
    "tableTool": Object {
      "content": Object {
        "columnWidths": Object {},
        "importedDataSet": Object {
          "attributes": Array [],
          "cases": Array [],
          "id": "testid-7",
          "name": undefined,
          "sortByAttribute": undefined,
          "sortDirection": "NONE",
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "createdHash": "96dfe550a5c42cfd62dde9c475f70af2fcbef72a2f1a25dd84d14d1aa39e3392",
      "display": undefined,
      "fixedPosition": false,
      "id": "tableTool",
      "title": undefined,
      "updatedHash": "96dfe550a5c42cfd62dde9c475f70af2fcbef72a2f1a25dd84d14d1aa39e3392",
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
Object {
  "annotations": Object {},
  "rowMap": Object {
    "testid-21": Object {
      "height": undefined,
      "id": "testid-21",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "testid-20",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": Array [
    "testid-21",
  ],
  "sharedModelMap": Object {
    "testid-17": Object {
      "provider": "testid-20",
      "sharedModel": Object {
        "dataSet": Object {
          "attributes": Array [
            Object {
              "clientKey": "",
              "description": undefined,
              "formula": Object {
                "display": "",
              },
              "hidden": false,
              "id": "testid-18",
              "name": "x",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": Array [
                "1",
                "2",
                "3",
              ],
            },
            Object {
              "clientKey": "",
              "description": undefined,
              "formula": Object {
                "display": "",
              },
              "hidden": false,
              "id": "testid-19",
              "name": "y",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": Array [
                "-1",
                "0",
                "1",
              ],
            },
          ],
          "cases": Array [
            Object {
              "__id__": "caseid-0",
            },
            Object {
              "__id__": "caseid-1",
            },
            Object {
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
      "tiles": Array [
        "testid-20",
      ],
    },
  },
  "tileMap": Object {
    "testid-20": Object {
      "content": Object {
        "columnWidths": Object {},
        "importedDataSet": Object {
          "attributes": Array [],
          "cases": Array [],
          "id": "testid-12",
          "name": undefined,
          "sortByAttribute": undefined,
          "sortDirection": "NONE",
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "createdHash": "96dfe550a5c42cfd62dde9c475f70af2fcbef72a2f1a25dd84d14d1aa39e3392",
      "display": undefined,
      "fixedPosition": false,
      "id": "testid-20",
      "title": undefined,
      "updatedHash": "96dfe550a5c42cfd62dde9c475f70af2fcbef72a2f1a25dd84d14d1aa39e3392",
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
Object {
  "annotations": Object {},
  "rowMap": Object {
    "testid-28": Object {
      "height": undefined,
      "id": "testid-28",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "textTool",
          "widthPct": undefined,
        },
        Object {
          "tileId": "testid-34",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": Array [
    "testid-28",
  ],
  "sharedModelMap": Object {
    "testid-31": Object {
      "provider": "testid-34",
      "sharedModel": Object {
        "dataSet": Object {
          "attributes": Array [
            Object {
              "clientKey": "",
              "description": undefined,
              "formula": Object {
                "display": "",
              },
              "hidden": false,
              "id": "testid-32",
              "name": "x",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": Array [
                "1",
                "2",
                "3",
              ],
            },
            Object {
              "clientKey": "",
              "description": undefined,
              "formula": Object {
                "display": "",
              },
              "hidden": false,
              "id": "testid-33",
              "name": "y",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": Array [
                "-1",
                "0",
                "1",
              ],
            },
          ],
          "cases": Array [
            Object {
              "__id__": "caseid-3",
            },
            Object {
              "__id__": "caseid-4",
            },
            Object {
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
      "tiles": Array [
        "testid-34",
      ],
    },
  },
  "tileMap": Object {
    "testid-34": Object {
      "content": Object {
        "columnWidths": Object {},
        "importedDataSet": Object {
          "attributes": Array [],
          "cases": Array [],
          "id": "testid-24",
          "name": undefined,
          "sortByAttribute": undefined,
          "sortDirection": "NONE",
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "createdHash": "96dfe550a5c42cfd62dde9c475f70af2fcbef72a2f1a25dd84d14d1aa39e3392",
      "display": undefined,
      "fixedPosition": false,
      "id": "testid-34",
      "title": undefined,
      "updatedHash": "96dfe550a5c42cfd62dde9c475f70af2fcbef72a2f1a25dd84d14d1aa39e3392",
    },
    "textTool": Object {
      "content": Object {
        "format": undefined,
        "highlightedText": Array [],
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
Object {
  "annotations": Object {},
  "rowMap": Object {
    "testid-48": Object {
      "height": undefined,
      "id": "testid-48",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "testid-46",
          "widthPct": undefined,
        },
        Object {
          "tileId": "testid-47",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": Array [
    "testid-48",
  ],
  "sharedModelMap": Object {
    "testid-43": Object {
      "provider": "testid-46",
      "sharedModel": Object {
        "dataSet": Object {
          "attributes": Array [
            Object {
              "clientKey": "",
              "description": undefined,
              "formula": Object {
                "display": "",
              },
              "hidden": false,
              "id": "testid-44",
              "name": "x",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": Array [
                "1",
                "2",
                "3",
              ],
            },
            Object {
              "clientKey": "",
              "description": undefined,
              "formula": Object {
                "display": "",
              },
              "hidden": false,
              "id": "testid-45",
              "name": "y",
              "precision": undefined,
              "sourceID": undefined,
              "title": "",
              "units": "",
              "values": Array [
                "-1",
                "0",
                "1",
              ],
            },
          ],
          "cases": Array [
            Object {
              "__id__": "caseid-6",
            },
            Object {
              "__id__": "caseid-7",
            },
            Object {
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
      "tiles": Array [
        "testid-46",
        "testid-47",
      ],
    },
  },
  "tileMap": Object {
    "testid-46": Object {
      "content": Object {
        "columnWidths": Object {},
        "importedDataSet": Object {
          "attributes": Array [],
          "cases": Array [],
          "id": "testid-37",
          "name": undefined,
          "sortByAttribute": undefined,
          "sortDirection": "NONE",
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "createdHash": "96dfe550a5c42cfd62dde9c475f70af2fcbef72a2f1a25dd84d14d1aa39e3392",
      "display": undefined,
      "fixedPosition": false,
      "id": "testid-46",
      "title": undefined,
      "updatedHash": "96dfe550a5c42cfd62dde9c475f70af2fcbef72a2f1a25dd84d14d1aa39e3392",
    },
    "testid-47": Object {
      "content": Object {
        "bgImage": undefined,
        "board": Object {
          "xAxis": Object {
            "label": undefined,
            "min": -2,
            "name": undefined,
            "range": undefined,
            "unit": 18.3,
          },
          "yAxis": Object {
            "label": undefined,
            "min": -1,
            "name": undefined,
            "range": undefined,
            "unit": 18.3,
          },
        },
        "isNavigatorVisible": true,
        "linkedAttributeColors": Object {},
        "navigatorPosition": "bottom",
        "objects": Object {},
        "offsetX": 0,
        "offsetY": 0,
        "pointMetadata": Object {},
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
