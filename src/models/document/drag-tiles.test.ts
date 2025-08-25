// Must be first so mocks are set up before any other imports
import { resetMockUniqueId } from "./document-content-tests/dc-test-utils";
import { DocumentContentModel, DocumentContentModelType, DocumentContentSnapshotType } from "./document-content";
// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../register-tile-types";
import { IDocumentImportSnapshot } from "./document-content-import-types";
import { SharedDataSetSnapshotType } from "../shared/shared-data-set";
import { SharedModelDocumentManager } from "./shared-model-document-manager";
import { ITileEnvironment } from "../tiles/tile-content";
import { IDragTileItem } from "../tiles/tile-model";
import { IDragTilesData } from "./document-content-types";

registerTileTypes(["Text"]);

// Utility function to help with typing and also to setup the sharedModelManager
function createDocumentContentModel(snapshot: IDocumentImportSnapshot) {
  const sharedModelManager = new SharedModelDocumentManager();
  const environment: ITileEnvironment = { sharedModelManager };
  const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
  sharedModelManager.setDocument(content);
  return content;
}

// For simplicify of comparing to a snapshot, replace the complex rowList object
// with a simpler object that just has the rowOrder.
function cleanDragTileItems(items: IDragTileItem[]) {
  return items.map((item: { rowList: { rowOrder: any; }; }) => {
    return {
      ...item,
      rowList: { rowOrder: item.rowList.rowOrder }
    };
  });
}

function cleanDragTiles(tiles: IDragTilesData) {
  return {
    ...tiles,
    tiles: cleanDragTileItems(tiles.tiles)
  };
}

describe("tile dragging", () => {

  // registerTileTypes returns a promise so Jest will wait for this promise to resolve
  // before running later `before*` calls and the tests.
  beforeAll(() => registerTileTypes(["Text", "Table"]));

  let documentContent: DocumentContentModelType;
  beforeEach(() => {
    // The DocumentContentModel.create will trigger a calls to uniqueId which
    // increment idCount. So all of these ids will start at 0.
    resetMockUniqueId(-1);

    // This has to happen after the types have been registered
    // Jest takes care of this because registerTileTypes is async and
    // is in an earlier beforeAll
    const sharedDataSet: SharedDataSetSnapshotType = {
      "type": "SharedDataSet",
      "id": "shared-data-set-1",
      "providerId": "tile3",
      "dataSet": {
        "id": "data-set-1",
        "name": "Table 1",
        "attributes": [
          {
            "id": "attribute-1",
            "name": "x",
            "values": ["0"]
          },
          {
            "id": "attribute-2",
            "name": "y",
            "values": ["1"]
          }
        ],
        "cases": [
          {"__id__": "case-1"}
        ]
      }
    };

    documentContent = createDocumentContentModel({
      tiles: [
        {
          id: "tile1",
          title: "tile 1",
          content: {
            type: "Text"
          }
        },
        {
          id: "tile2",
          title: "tile 2",
          content: {
            type: "Text",
          }
        },
        {
          id: "tile3",
          title: "tile 3",
          content: {
            type: "Table",
          }
        }
      ],
      sharedModels: [
        {
          tiles: ["tile3"],
          sharedModel: sharedDataSet,
          provider: "tile3"
        }
      ]
    });

    // Set the idCount to 999, this way any future uniqueIds created will be consistent
    // regardless of how many uniqueIds the createDocumentContentModel called
    resetMockUniqueId(999);
  });

  describe("getDragTileItems", () => {
    describe("when a non-existent tile is selected", () => {
      it("returns an empty array", () => {
        const items = documentContent.getDragTileItems(["foo"]);

        expect(items).toHaveLength(0);
      });
    });
    describe("when one tile is selected", () => {
      it("returns an array of one IDragTileItem object", () => {
        const items = cleanDragTileItems(documentContent.getDragTileItems(["tile1"]));
        // Jest messes up the indentation when it writes out the snapshots with
        // --updateSnapshot (see https://jestjs.io/docs/snapshot-testing)
        // But having them inline seems more valuable than consistent indentation
        /*eslint-disable max-len*/
        expect(items).toMatchInlineSnapshot(`
Array [
  Object {
    "rowHeight": undefined,
    "rowIndex": 0,
    "rowList": Object {
      "rowOrder": Array [
        "testid-3",
        "testid-4",
        "testid-5",
      ],
    },
    "tileContent": "{\\"id\\":\\"testid-1000\\",\\"title\\":\\"tile 1\\",\\"fixedPosition\\":false,\\"content\\":{\\"type\\":\\"Text\\",\\"text\\":\\"\\",\\"highlightedText\\":[]},\\"createdHash\\":\\"7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674\\",\\"updatedHash\\":\\"7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674\\"}",
    "tileId": "tile1",
    "tileIndex": 0,
    "tileType": "Text",
  },
]
`);
        /*eslint-enable max-len*/
      });
    });
    describe("when two tiles are selected", () => {
      it("returns an array of both IDragTileItem objects", () => {
        const items = cleanDragTileItems(documentContent.getDragTileItems(["tile1", "tile2"]));

        /*eslint-disable max-len*/
        expect(items).toMatchInlineSnapshot(`
Array [
  Object {
    "rowHeight": undefined,
    "rowIndex": 0,
    "rowList": Object {
      "rowOrder": Array [
        "testid-3",
        "testid-4",
        "testid-5",
      ],
    },
    "tileContent": "{\\"id\\":\\"testid-1000\\",\\"title\\":\\"tile 1\\",\\"fixedPosition\\":false,\\"content\\":{\\"type\\":\\"Text\\",\\"text\\":\\"\\",\\"highlightedText\\":[]},\\"createdHash\\":\\"7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674\\",\\"updatedHash\\":\\"7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674\\"}",
    "tileId": "tile1",
    "tileIndex": 0,
    "tileType": "Text",
  },
  Object {
    "rowHeight": undefined,
    "rowIndex": 1,
    "rowList": Object {
      "rowOrder": Array [
        "testid-3",
        "testid-4",
        "testid-5",
      ],
    },
    "tileContent": "{\\"id\\":\\"testid-1001\\",\\"title\\":\\"tile 2\\",\\"fixedPosition\\":false,\\"content\\":{\\"type\\":\\"Text\\",\\"text\\":\\"\\",\\"highlightedText\\":[]},\\"createdHash\\":\\"7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674\\",\\"updatedHash\\":\\"7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674\\"}",
    "tileId": "tile2",
    "tileIndex": 0,
    "tileType": "Text",
  },
]
`);
        /*eslint-enable max-len*/
      });
    });

    describe("when a table using a shared dataset is selected", () => {
      it("returns the table IDragTileItem object", () => {
        const items = cleanDragTileItems(documentContent.getDragTileItems(["tile3"]));

        // TODO: The exported table here includes importedDataSet property.
        // Since we are going to include the actual shared dataset too, the
        // importedDataSet should not be here.

        /*eslint-disable max-len*/
        expect(items).toMatchInlineSnapshot(`
Array [
  Object {
    "rowHeight": undefined,
    "rowIndex": 2,
    "rowList": Object {
      "rowOrder": Array [
        "testid-3",
        "testid-4",
        "testid-5",
      ],
    },
    "tileContent": "{\\"id\\":\\"testid-1000\\",\\"fixedPosition\\":false,\\"content\\":{\\"type\\":\\"Table\\",\\"isImported\\":false,\\"importedDataSet\\":{\\"id\\":\\"testid-6\\",\\"attributes\\":[],\\"cases\\":[],\\"sortDirection\\":\\"NONE\\"},\\"columnWidths\\":{}},\\"createdHash\\":\\"96dfe550a5c42cfd62dde9c475f70af2fcbef72a2f1a25dd84d14d1aa39e3392\\",\\"updatedHash\\":\\"96dfe550a5c42cfd62dde9c475f70af2fcbef72a2f1a25dd84d14d1aa39e3392\\"}",
    "tileId": "tile3",
    "tileIndex": 0,
    "tileType": "Table",
  },
]
`);
        /*eslint-enable max-len*/
      });
    });
  });

  describe("getDragTiles", () => {
    describe("when one tile is selected", () => {
      it("returns that tile and an the other IDragTiles properties", () => {
        const dragTiles = cleanDragTiles(documentContent.getDragTiles(["tile1"]));
        /*eslint-disable max-len*/
        expect(dragTiles).toMatchInlineSnapshot(`
Object {
  "annotations": Array [],
  "sharedModels": Array [],
  "sourceDocId": "testid-7",
  "tiles": Array [
    Object {
      "rowHeight": undefined,
      "rowIndex": 0,
      "rowList": Object {
        "rowOrder": Array [
          "testid-3",
          "testid-4",
          "testid-5",
        ],
      },
      "tileContent": "{\\"id\\":\\"testid-1000\\",\\"title\\":\\"tile 1\\",\\"fixedPosition\\":false,\\"content\\":{\\"type\\":\\"Text\\",\\"text\\":\\"\\",\\"highlightedText\\":[]},\\"createdHash\\":\\"7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674\\",\\"updatedHash\\":\\"7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674\\"}",
      "tileId": "tile1",
      "tileIndex": 0,
      "tileType": "Text",
    },
  ],
}
`);
        /*eslint-enable max-len*/

      });
    });
    describe("with two tiles selected", () => {
      it("returns both tiles in document order", () => {
        const dragTiles = cleanDragTiles(documentContent.getDragTiles(["tile2", "tile1"]));
        /*eslint-disable max-len*/
        expect(dragTiles).toMatchInlineSnapshot(`
Object {
  "annotations": Array [],
  "sharedModels": Array [],
  "sourceDocId": "testid-7",
  "tiles": Array [
    Object {
      "rowHeight": undefined,
      "rowIndex": 0,
      "rowList": Object {
        "rowOrder": Array [
          "testid-3",
          "testid-4",
          "testid-5",
        ],
      },
      "tileContent": "{\\"id\\":\\"testid-1001\\",\\"title\\":\\"tile 1\\",\\"fixedPosition\\":false,\\"content\\":{\\"type\\":\\"Text\\",\\"text\\":\\"\\",\\"highlightedText\\":[]},\\"createdHash\\":\\"7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674\\",\\"updatedHash\\":\\"7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674\\"}",
      "tileId": "tile1",
      "tileIndex": 0,
      "tileType": "Text",
    },
    Object {
      "rowHeight": undefined,
      "rowIndex": 1,
      "rowList": Object {
        "rowOrder": Array [
          "testid-3",
          "testid-4",
          "testid-5",
        ],
      },
      "tileContent": "{\\"id\\":\\"testid-1000\\",\\"title\\":\\"tile 2\\",\\"fixedPosition\\":false,\\"content\\":{\\"type\\":\\"Text\\",\\"text\\":\\"\\",\\"highlightedText\\":[]},\\"createdHash\\":\\"7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674\\",\\"updatedHash\\":\\"7e10c66d65b651c9af8ccb4d214747f659f719659104bda6e0f5f1ab81152674\\"}",
      "tileId": "tile2",
      "tileIndex": 0,
      "tileType": "Text",
    },
  ],
}
`);
        /*eslint-enable max-len*/

      });
    });
    describe("with a tile using a shared model", () => {
      it("returns the tile and the shared model", () => {
        const dragTiles = cleanDragTiles(documentContent.getDragTiles(["tile3"]));

        /*eslint-disable max-len*/
        expect(dragTiles).toMatchInlineSnapshot(`
Object {
  "annotations": Array [],
  "sharedModels": Array [
    Object {
      "content": "{\\"type\\":\\"SharedDataSet\\",\\"id\\":\\"shared-data-set-1\\",\\"providerId\\":\\"tile3\\",\\"dataSet\\":{\\"id\\":\\"data-set-1\\",\\"name\\":\\"tile 3\\",\\"attributes\\":[{\\"id\\":\\"attribute-1\\",\\"clientKey\\":\\"\\",\\"name\\":\\"x\\",\\"hidden\\":false,\\"units\\":\\"\\",\\"formula\\":{\\"display\\":\\"\\"},\\"values\\":[\\"0\\"],\\"title\\":\\"\\"},{\\"id\\":\\"attribute-2\\",\\"clientKey\\":\\"\\",\\"name\\":\\"y\\",\\"hidden\\":false,\\"units\\":\\"\\",\\"formula\\":{\\"display\\":\\"\\"},\\"values\\":[\\"1\\"],\\"title\\":\\"\\"}],\\"cases\\":[{\\"__id__\\":\\"case-1\\"}],\\"sortDirection\\":\\"NONE\\"}}",
      "modelId": "shared-data-set-1",
      "providerId": "tile3",
      "tileIds": Array [
        "tile3",
      ],
    },
  ],
  "sourceDocId": "testid-7",
  "tiles": Array [
    Object {
      "rowHeight": undefined,
      "rowIndex": 2,
      "rowList": Object {
        "rowOrder": Array [
          "testid-3",
          "testid-4",
          "testid-5",
        ],
      },
      "tileContent": "{\\"id\\":\\"testid-1000\\",\\"fixedPosition\\":false,\\"content\\":{\\"type\\":\\"Table\\",\\"isImported\\":false,\\"importedDataSet\\":{\\"id\\":\\"testid-6\\",\\"attributes\\":[],\\"cases\\":[],\\"sortDirection\\":\\"NONE\\"},\\"columnWidths\\":{}},\\"createdHash\\":\\"96dfe550a5c42cfd62dde9c475f70af2fcbef72a2f1a25dd84d14d1aa39e3392\\",\\"updatedHash\\":\\"96dfe550a5c42cfd62dde9c475f70af2fcbef72a2f1a25dd84d14d1aa39e3392\\"}",
      "tileId": "tile3",
      "tileIndex": 0,
      "tileType": "Table",
    },
  ],
}
`);
        /*eslint-enable max-len*/
      });
    });
  });
});
