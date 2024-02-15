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
    "testid-17": Object {
      "height": undefined,
      "id": "testid-17",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "testid-16",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": Array [
    "testid-17",
  ],
  "sharedModelMap": Object {
    "testid-13": Object {
      "provider": undefined,
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
              "id": "testid-14",
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
              "id": "testid-15",
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
          "id": "testid-12",
          "name": "Demo Dataset",
          "sourceID": undefined,
        },
        "id": "testid-13",
        "providerId": "tableTool",
        "type": "SharedDataSet",
      },
      "tiles": Array [
        "testid-16",
      ],
    },
  },
  "tileMap": Object {
    "testid-16": Object {
      "content": Object {
        "columnWidths": Object {},
        "importedDataSet": Object {
          "attributes": Array [],
          "cases": Array [],
          "id": "testid-6",
          "name": undefined,
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "display": undefined,
      "id": "testid-16",
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
    "testid-29": Object {
      "height": undefined,
      "id": "testid-29",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "textTool",
          "widthPct": undefined,
        },
        Object {
          "tileId": "testid-35",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": Array [
    "testid-29",
  ],
  "sharedModelMap": Object {
    "testid-32": Object {
      "provider": undefined,
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
              "id": "testid-33",
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
              "id": "testid-34",
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
          "id": "testid-31",
          "name": "Demo Dataset",
          "sourceID": undefined,
        },
        "id": "testid-32",
        "providerId": "tableTool",
        "type": "SharedDataSet",
      },
      "tiles": Array [
        "testid-35",
      ],
    },
  },
  "tileMap": Object {
    "testid-35": Object {
      "content": Object {
        "columnWidths": Object {},
        "importedDataSet": Object {
          "attributes": Array [],
          "cases": Array [],
          "id": "testid-23",
          "name": undefined,
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "display": undefined,
      "id": "testid-35",
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
    "testid-19": Object {
      "height": undefined,
      "id": "testid-19",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "testid-17",
          "widthPct": undefined,
        },
        Object {
          "tileId": "testid-18",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": Array [
    "testid-19",
  ],
  "sharedModelMap": Object {
    "testid-14": Object {
      "provider": undefined,
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
              "id": "testid-15",
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
              "id": "testid-16",
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
          "id": "testid-13",
          "name": "Demo Dataset",
          "sourceID": undefined,
        },
        "id": "testid-14",
        "providerId": "tableTool",
        "type": "SharedDataSet",
      },
      "tiles": Array [
        "testid-17",
        "testid-18",
      ],
    },
  },
  "tileMap": Object {
    "testid-17": Object {
      "content": Object {
        "columnWidths": Object {},
        "importedDataSet": Object {
          "attributes": Array [],
          "cases": Array [],
          "id": "testid-6",
          "name": undefined,
          "sourceID": undefined,
        },
        "isImported": false,
        "type": "Table",
      },
      "display": undefined,
      "id": "testid-17",
      "title": "Table 2",
    },
    "testid-18": Object {
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
      "id": "testid-18",
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
