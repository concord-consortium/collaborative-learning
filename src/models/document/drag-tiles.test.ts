import { DocumentContentModel, DocumentContentModelType, DocumentContentSnapshotType } from "./document-content";
import { getDragTileItems, getDragTiles } from "./drag-tiles";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../register-tile-types";
import { IDocumentImportSnapshot } from "./document-content-import-types";
import { SharedDataSetSnapshotType } from "../shared/shared-data-set";
import { SharedModelDocumentManager } from "./shared-model-document-manager";
import { ITileEnvironment } from "../tiles/tile-content";
registerTileTypes(["Text"]);

// mock uniqueId so we auto-generated IDs are consistent
let idCount = 0;
jest.mock("../../utilities/js-utils", () => {
  const { uniqueId, ...others } = jest.requireActual("../../utilities/js-utils");
  return {
    uniqueId: () => `testid-${idCount++}`,
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

describe("tile dragging", () => {

  // registerTileTypes returns a promise so Jest will wait for this promise to resolve
  // before running later `before*` calls and the tests.
  beforeAll(() => registerTileTypes(["Text", "Table"]));

  let documentContent: DocumentContentModelType;
  beforeEach(() => {
    // The DocumentContentModel.create will trigger a calls to uniqueId which
    // increment idCount. So all of these ids will start at 0.
    idCount = 0;

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
        }
      ]
    });

    // set the idCount to 1000, this way any future uniqueIds created will be
    // consistent regardless of how many uniqueIds the
    // createDocumentContentModel called
    idCount = 1000;
  });

  describe("getDragTileItems", () => {
    describe("when one tile selected", () => {
      it("returns an array of one IDragTileItem object", () => {
        const items = getDragTileItems(documentContent, ["tile1"]);

        // Jest messes up the indentation when it writes out the snapshots with
        // --updateSnapshot (see https://jestjs.io/docs/snapshot-testing)
        // But having them inline seems more valuable than consistent indentation
        /*eslint-disable max-len*/
        expect(items).toMatchInlineSnapshot(`
Array [
  Object {
    "rowHeight": undefined,
    "rowIndex": 0,
    "tileContent": "{\\"id\\":\\"testid-1000\\",\\"title\\":\\"tile 1\\",\\"content\\":{\\"type\\":\\"Text\\",\\"text\\":\\"\\"}}",
    "tileId": "tile1",
    "tileIndex": 0,
    "tileType": "Text",
  },
]
`);
        /*eslint-enable max-len*/
      });
    });
    describe("when two tiles selected", () => {
      it("returns an array of both IDragTileItem objects", () => {
        const items = getDragTileItems(documentContent, ["tile1", "tile2"]);

        /*eslint-disable max-len*/
        expect(items).toMatchInlineSnapshot(`
Array [
  Object {
    "rowHeight": undefined,
    "rowIndex": 0,
    "tileContent": "{\\"id\\":\\"testid-1000\\",\\"title\\":\\"tile 1\\",\\"content\\":{\\"type\\":\\"Text\\",\\"text\\":\\"\\"}}",
    "tileId": "tile1",
    "tileIndex": 0,
    "tileType": "Text",
  },
  Object {
    "rowHeight": undefined,
    "rowIndex": 1,
    "tileContent": "{\\"id\\":\\"testid-1001\\",\\"title\\":\\"tile 2\\",\\"content\\":{\\"type\\":\\"Text\\",\\"text\\":\\"\\"}}",
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
        const items = getDragTileItems(documentContent, ["tile3"]);

        // TODO: The exported table here includes importedDataSet property.
        // Since we are going to include the actual shared dataset too, the
        // importedDataSet should not be here.

        /*eslint-disable max-len*/
        expect(items).toMatchInlineSnapshot(`
Array [
  Object {
    "rowHeight": undefined,
    "rowIndex": 2,
    "tileContent": "{\\"id\\":\\"testid-1000\\",\\"title\\":\\"tile 3\\",\\"content\\":{\\"type\\":\\"Table\\",\\"isImported\\":false,\\"importedDataSet\\":{\\"id\\":\\"data-set-1\\",\\"name\\":\\"Table 1\\",\\"attributes\\":[{\\"id\\":\\"attribute-1\\",\\"clientKey\\":\\"\\",\\"name\\":\\"x\\",\\"hidden\\":false,\\"units\\":\\"\\",\\"formula\\":{},\\"values\\":[\\"0\\"]},{\\"id\\":\\"attribute-2\\",\\"clientKey\\":\\"\\",\\"name\\":\\"y\\",\\"hidden\\":false,\\"units\\":\\"\\",\\"formula\\":{},\\"values\\":[\\"1\\"]}],\\"cases\\":[{\\"__id__\\":\\"case-1\\"}]},\\"columnWidths\\":{}}}",
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

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  describe("getDragTiles", () => {
    describe("with one tile selected", () => {
      it("returns that tile", () => {
        const model = documentContent.getTile("tile1");
        expect(model).toBeDefined();
        const dragTiles = getDragTiles(documentContent, model!, ["tile1"]);
        /*eslint-disable max-len*/
        expect(dragTiles).toMatchInlineSnapshot(`
Object {
  "sharedModels": Array [],
  "sourceDocId": "testid-10",
  "tiles": Array [
    Object {
      "rowHeight": undefined,
      "rowIndex": 0,
      "tileContent": "{\\"id\\":\\"testid-1000\\",\\"title\\":\\"tile 1\\",\\"content\\":{\\"type\\":\\"Text\\",\\"text\\":\\"\\"}}",
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
        const model = documentContent.getTile("tile2");
        expect(model).toBeDefined();
        const dragTiles = getDragTiles(documentContent, model!, ["tile2", "tile1"]);
        /*eslint-disable max-len*/
        expect(dragTiles).toMatchInlineSnapshot(`
Object {
  "sharedModels": Array [],
  "sourceDocId": "testid-10",
  "tiles": Array [
    Object {
      "rowHeight": undefined,
      "rowIndex": 0,
      "tileContent": "{\\"id\\":\\"testid-1001\\",\\"title\\":\\"tile 1\\",\\"content\\":{\\"type\\":\\"Text\\",\\"text\\":\\"\\"}}",
      "tileId": "tile1",
      "tileIndex": 0,
      "tileType": "Text",
    },
    Object {
      "rowHeight": undefined,
      "rowIndex": 1,
      "tileContent": "{\\"id\\":\\"testid-1000\\",\\"title\\":\\"tile 2\\",\\"content\\":{\\"type\\":\\"Text\\",\\"text\\":\\"\\"}}",
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
        const model = documentContent.getTile("tile3");
        expect(model).toBeDefined();
        const dragTiles = getDragTiles(documentContent, model!, ["tile3"]);

        /*eslint-disable max-len*/
        expect(dragTiles).toMatchInlineSnapshot(`
Object {
  "sharedModels": Array [
    Object {
      "dataSet": Object {
        "attributes": Array [
          Object {
            "clientKey": "",
            "formula": Object {
              "canonical": undefined,
              "display": undefined,
            },
            "hidden": false,
            "id": "attribute-1",
            "name": "x",
            "sourceID": undefined,
            "units": "",
            "values": Array [
              "0",
            ],
          },
          Object {
            "clientKey": "",
            "formula": Object {
              "canonical": undefined,
              "display": undefined,
            },
            "hidden": false,
            "id": "attribute-2",
            "name": "y",
            "sourceID": undefined,
            "units": "",
            "values": Array [
              "1",
            ],
          },
        ],
        "cases": Array [
          Object {
            "__id__": "case-1",
          },
        ],
        "id": "data-set-1",
        "name": "Table 1",
        "sourceID": undefined,
      },
      "id": "shared-data-set-1",
      "providerId": "tile3",
      "type": "SharedDataSet",
    },
  ],
  "sourceDocId": "testid-10",
  "tiles": Array [
    Object {
      "rowHeight": undefined,
      "rowIndex": 2,
      "tileContent": "{\\"id\\":\\"testid-1000\\",\\"title\\":\\"tile 3\\",\\"content\\":{\\"type\\":\\"Table\\",\\"isImported\\":false,\\"importedDataSet\\":{\\"id\\":\\"data-set-1\\",\\"name\\":\\"Table 1\\",\\"attributes\\":[{\\"id\\":\\"attribute-1\\",\\"clientKey\\":\\"\\",\\"name\\":\\"x\\",\\"hidden\\":false,\\"units\\":\\"\\",\\"formula\\":{},\\"values\\":[\\"0\\"]},{\\"id\\":\\"attribute-2\\",\\"clientKey\\":\\"\\",\\"name\\":\\"y\\",\\"hidden\\":false,\\"units\\":\\"\\",\\"formula\\":{},\\"values\\":[\\"1\\"]}],\\"cases\\":[{\\"__id__\\":\\"case-1\\"}]},\\"columnWidths\\":{}}}",
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
