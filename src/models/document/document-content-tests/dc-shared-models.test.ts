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
  This can be opened with: http://localhost:8080/doc-editor.html
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
          { content: { type: "Table", name: "Demo Dataset", columnWidths } },
          { content: { type: "Geometry", objects: [] } }
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
              attributes: [
                {
                  clientKey: "",
                  formula: {},
                  hidden: false,
                  id: "attribute1",
                  name: "x",
                  title: "",
                  units: "",
                  values: [ "1", "2", "3"]
                },
                {
                  clientKey: "",
                  formula: {},
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
        rowDropIndex: 0,
        rowDropLocation: "right"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(getSnapshot(documentContent)).toMatchInlineSnapshot(`
Object {
  "annotations": Object {},
  "rowMap": Object {
    "testid-12": Object {
      "height": undefined,
      "id": "testid-12",
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
    "testid-12",
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
                "canonical": undefined,
                "display": undefined,
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
                "canonical": undefined,
                "display": undefined,
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
        "objects": Object {},
        "type": "Geometry",
      },
      "display": undefined,
      "id": "graphTool",
      "title": undefined,
    },
    "tableTool": Object {
      "content": Object {
        "columnWidths": Object {},
        "importedDataSet": Object {
          "attributes": Array [],
          "cases": Array [],
          "id": "testid-13",
          "name": undefined,
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "display": undefined,
      "id": "tableTool",
      "title": undefined,
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
    "testid-32": Object {
      "height": undefined,
      "id": "testid-32",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "testid-31",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": Array [
    "testid-32",
  ],
  "sharedModelMap": Object {
    "testid-28": Object {
      "provider": "testid-31",
      "sharedModel": Object {
        "dataSet": Object {
          "attributes": Array [
            Object {
              "clientKey": "",
              "description": undefined,
              "formula": Object {
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "testid-29",
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
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "testid-30",
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
          "id": "testid-27",
          "name": "Demo Dataset",
          "sourceID": undefined,
        },
        "id": "testid-28",
        "providerId": "testid-31",
        "type": "SharedDataSet",
      },
      "tiles": Array [
        "testid-31",
      ],
    },
  },
  "tileMap": Object {
    "testid-31": Object {
      "content": Object {
        "columnWidths": Object {},
        "importedDataSet": Object {
          "attributes": Array [],
          "cases": Array [],
          "id": "testid-21",
          "name": undefined,
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "display": undefined,
      "id": "testid-31",
      "title": "Table 2",
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
        rowDropIndex: 0,
        rowDropLocation: "right"
      };
      targetDocument.handleDragCopyTiles(dragTileInfo, dropRowInfo);
      // FIXME: the ids here are not going to be consistent, so we should
      // reset them in beforeEach
      expect(getSnapshot(targetDocument)).toMatchInlineSnapshot(`
Object {
  "annotations": Object {},
  "rowMap": Object {
    "testid-44": Object {
      "height": undefined,
      "id": "testid-44",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "textTool",
          "widthPct": undefined,
        },
        Object {
          "tileId": "testid-50",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": Array [
    "testid-44",
  ],
  "sharedModelMap": Object {
    "testid-47": Object {
      "provider": "testid-50",
      "sharedModel": Object {
        "dataSet": Object {
          "attributes": Array [
            Object {
              "clientKey": "",
              "description": undefined,
              "formula": Object {
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "testid-48",
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
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "testid-49",
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
          "id": "testid-46",
          "name": "Demo Dataset",
          "sourceID": undefined,
        },
        "id": "testid-47",
        "providerId": "testid-50",
        "type": "SharedDataSet",
      },
      "tiles": Array [
        "testid-50",
      ],
    },
  },
  "tileMap": Object {
    "testid-50": Object {
      "content": Object {
        "columnWidths": Object {},
        "importedDataSet": Object {
          "attributes": Array [],
          "cases": Array [],
          "id": "testid-38",
          "name": undefined,
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "display": undefined,
      "id": "testid-50",
      "title": undefined,
    },
    "textTool": Object {
      "content": Object {
        "format": undefined,
        "text": "",
        "type": "Text",
      },
      "display": undefined,
      "id": "textTool",
      "title": undefined,
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
    "testid-69": Object {
      "height": undefined,
      "id": "testid-69",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "testid-67",
          "widthPct": undefined,
        },
        Object {
          "tileId": "testid-68",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": Array [
    "testid-69",
  ],
  "sharedModelMap": Object {
    "testid-64": Object {
      "provider": "testid-67",
      "sharedModel": Object {
        "dataSet": Object {
          "attributes": Array [
            Object {
              "clientKey": "",
              "description": undefined,
              "formula": Object {
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "testid-65",
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
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "testid-66",
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
          "id": "testid-63",
          "name": "Demo Dataset",
          "sourceID": undefined,
        },
        "id": "testid-64",
        "providerId": "testid-67",
        "type": "SharedDataSet",
      },
      "tiles": Array [
        "testid-67",
        "testid-68",
      ],
    },
  },
  "tileMap": Object {
    "testid-67": Object {
      "content": Object {
        "columnWidths": Object {},
        "importedDataSet": Object {
          "attributes": Array [],
          "cases": Array [],
          "id": "testid-56",
          "name": undefined,
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "display": undefined,
      "id": "testid-67",
      "title": "Table 2",
    },
    "testid-68": Object {
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
        "objects": Object {},
        "type": "Geometry",
      },
      "display": undefined,
      "id": "testid-68",
      "title": undefined,
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
