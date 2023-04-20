// This import needs to be first so the jest.mock calls in it
// are run before the next import statements
import { getSnapshot } from "mobx-state-tree";
import { parsedExport, getColumnWidths } from "./dc-test-utils";
import { DocumentContentModel, DocumentContentModelType, DocumentContentSnapshotType } from "../document-content";
import { IDropRowInfo } from "../tile-row";

import { IDocumentImportSnapshot } from "../document-content-import-types";
import { SharedModelDocumentManager } from "../shared-model-document-manager";
import { ITileEnvironment } from "../../tiles/tile-content";
// mock Logger calls
const mockLogTileCopyEvent = jest.fn();
jest.mock("../../tiles/log/log-tile-copy-event", () => ({
  logTileCopyEvent: (...args: any[]) => mockLogTileCopyEvent()
}));

/*
  This can be opened with: http://localhost:8080/doc-editor.html
*/
import sharedModelExample from "./shared-model-example.json";
const srcContent: IDocumentImportSnapshot = sharedModelExample.content;

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
                  units: "",
                  values: [ "1", "2", "3"]
                },
                {
                  clientKey: "",
                  formula: {},
                  hidden: false,
                  id: "attribute2",
                  name: "y",
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
  "rowMap": Object {
    "testid-14": Object {
      "height": undefined,
      "id": "testid-14",
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
    "testid-14",
  ],
  "sharedModelMap": Object {
    "sharedDataSet1": Object {
      "provider": "tableTool",
      "sharedModel": Object {
        "dataSet": Object {
          "attributes": Array [
            Object {
              "clientKey": "",
              "formula": Object {
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "attribute1",
              "name": "x",
              "sourceID": undefined,
              "units": "",
              "values": Array [
                "1",
                "2",
                "3",
              ],
            },
            Object {
              "clientKey": "",
              "formula": Object {
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "attribute2",
              "name": "y",
              "sourceID": undefined,
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
  "rowMap": Object {
    "testid-32": Object {
      "height": undefined,
      "id": "testid-32",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "testid-30",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": Array [
    "testid-32",
  ],
  "sharedModelMap": Object {
    "sharedDataSet1": Object {
      "provider": "testid-30",
      "sharedModel": Object {
        "dataSet": Object {
          "attributes": Array [
            Object {
              "clientKey": "",
              "formula": Object {
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "attribute1",
              "name": "x",
              "sourceID": undefined,
              "units": "",
              "values": Array [
                "1",
                "2",
                "3",
              ],
            },
            Object {
              "clientKey": "",
              "formula": Object {
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "attribute2",
              "name": "y",
              "sourceID": undefined,
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
        "providerId": "testid-30",
        "type": "SharedDataSet",
      },
      "tiles": Array [
        "testid-30",
      ],
    },
  },
  "tileMap": Object {
    "testid-30": Object {
      "content": Object {
        "columnWidths": Object {},
        "type": "Table",
      },
      "display": undefined,
      "id": "testid-30",
      "title": "Table 1",
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
  "rowMap": Object {
    "testid-45": Object {
      "height": undefined,
      "id": "testid-45",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "textTool",
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
    "testid-45",
  ],
  "sharedModelMap": Object {
    "sharedDataSet1": Object {
      "provider": "testid-47",
      "sharedModel": Object {
        "dataSet": Object {
          "attributes": Array [
            Object {
              "clientKey": "",
              "formula": Object {
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "attribute1",
              "name": "x",
              "sourceID": undefined,
              "units": "",
              "values": Array [
                "1",
                "2",
                "3",
              ],
            },
            Object {
              "clientKey": "",
              "formula": Object {
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "attribute2",
              "name": "y",
              "sourceID": undefined,
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
        "providerId": "testid-47",
        "type": "SharedDataSet",
      },
      "tiles": Array [
        "testid-47",
      ],
    },
  },
  "tileMap": Object {
    "testid-47": Object {
      "content": Object {
        "columnWidths": Object {},
        "type": "Table",
      },
      "display": undefined,
      "id": "testid-47",
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
  "rowMap": Object {
    "testid-65": Object {
      "height": undefined,
      "id": "testid-65",
      "isSectionHeader": false,
      "sectionId": undefined,
      "tiles": Array [
        Object {
          "tileId": "testid-62",
          "widthPct": undefined,
        },
        Object {
          "tileId": "testid-63",
          "widthPct": undefined,
        },
      ],
    },
  },
  "rowOrder": Array [
    "testid-65",
  ],
  "sharedModelMap": Object {
    "sharedDataSet1": Object {
      "provider": "testid-62",
      "sharedModel": Object {
        "dataSet": Object {
          "attributes": Array [
            Object {
              "clientKey": "",
              "formula": Object {
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "attribute1",
              "name": "x",
              "sourceID": undefined,
              "units": "",
              "values": Array [
                "1",
                "2",
                "3",
              ],
            },
            Object {
              "clientKey": "",
              "formula": Object {
                "canonical": undefined,
                "display": undefined,
              },
              "hidden": false,
              "id": "attribute2",
              "name": "y",
              "sourceID": undefined,
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
        "providerId": "testid-62",
        "type": "SharedDataSet",
      },
      "tiles": Array [
        "testid-62",
        "testid-63",
      ],
    },
  },
  "tileMap": Object {
    "testid-62": Object {
      "content": Object {
        "columnWidths": Object {},
        "type": "Table",
      },
      "display": undefined,
      "id": "testid-62",
      "title": "Table 1",
    },
    "testid-63": Object {
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
      "id": "testid-63",
      "title": undefined,
    },
  },
}
`);
    });
  });
});

