import mock from "xhr-mock";
import { Logger, LogEventName } from "./logger";
import { DocumentModel, DocumentModelType } from "../models/document/document";
import { ProblemDocument } from "../models/document/document-types";
import { AppConfigModel } from "../models/stores/app-config-model";
import { DocumentContentModel } from "../models/document/document-content";
import { InvestigationModel } from "../models/curriculum/investigation";
import { IStores, createStores } from "../models/stores/stores";
import { UserModel } from "../models/stores/user";
import { WorkspaceModel, ProblemWorkspace, WorkspaceModelType } from "../models/stores/workspace";
import { defaultGeometryContent } from "../models/tools/geometry/geometry-content";
import { JXGChange } from "../models/tools/geometry/jxg-changes";
import { defaultTextContent } from "../models/tools/text/text-content";
import { IDragTileItem, ToolTileModel } from "../models/tools/tool-tile";
import { createSingleTileContent } from "../utilities/test-utils";

const investigation = InvestigationModel.create({
  ordinal: 1,
  title: "Investigation 1",
  problems: [ { ordinal: 1, title: "Problem 1.1" } ]
});
const problem = investigation.getProblem(1);

// can be useful for debugging tests
// jest.mock("../lib/debug", () => ({
//   DEBUG_LOGGER: true
// }));

describe("uninitialized logger", () => {
  it("throws exception if not initialized", () => {
    expect(() => Logger.Instance).toThrow();
  });
});

describe("logger", () => {
  let stores: IStores;

  beforeEach(() => {
    mock.setup();
    stores = createStores({
      appMode: "test",
      appConfig: AppConfigModel.create({ appName: "TestLogger"}),
      user: UserModel.create({id: "0", portal: "test"})
    });

    Logger.initializeLogger(stores, investigation, problem);
  });

  afterEach(() => {
    mock.teardown();
  });

  describe ("tile CRUD events", () => {

    it("can log a simple message with all the appropriate properties", (done) => {
      mock.post(/.*/, (req, res) => {
        expect(req.header("Content-Type")).toEqual("application/json; charset=UTF-8");

        const request = JSON.parse(req.body());

        expect(request.application).toBe("TestLogger");
        expect(request.username).toBe("0@test");
        expect(request.investigation).toBe("Investigation 1");
        expect(request.problem).toBe("Problem 1.1");
        expect(request.session).toEqual(expect.anything());
        expect(request.time).toEqual(expect.anything());
        expect(request.event).toBe("CREATE_TILE");
        expect(request.method).toBe("do");
        expect(request.parameters).toEqual({foo: "bar"});

        done();
        return res.status(201);
      });

      Logger.log(LogEventName.CREATE_TILE, { foo: "bar" });
    });

    it("can log tile creation", (done) => {
      const tile = ToolTileModel.create({ content: defaultTextContent() });

      mock.post(/.*/, (req, res) => {
        const request = JSON.parse(req.body());

        expect(request.event).toBe("CREATE_TILE");
        expect(request.parameters.objectId).toBe(tile.id);
        expect(request.parameters.objectType).toBe("Text");
        expect(request.parameters.serializedObject).toEqual({
          type: "Text",
          text: ""
        });
        expect(request.parameters.documentKey).toBe(undefined);

        done();
        return res.status(201);
      });

      Logger.logTileEvent(LogEventName.CREATE_TILE, tile);
    });

    it("can log tile creation in a document", (done) => {
      const document = DocumentModel.create({
        type: ProblemDocument,
        uid: "1",
        key: "source-document",
        createdAt: 1,
        content: {},
        visibility: "public"
      });
      stores.documents.add(document);

      mock.post(/.*/, (req, res) => {
        const request = JSON.parse(req.body());

        expect(request.event).toBe("CREATE_TILE");
        // expect(request.parameters.objectId).toBe(tile.id);
        expect(request.parameters.objectType).toBe("Text");
        expect(request.parameters.serializedObject).toEqual({
          type: "Text",
          text: ""
        });
        expect(request.parameters.documentKey).toBe("source-document");
        expect(request.parameters.documentType).toBe("problem");

        done();
        return res.status(201);
      });

      document.content.userAddTile("text");
    });

    it("can log copying tiles between documents", (done) => {
      const sourceDocument = DocumentModel.create({
        type: ProblemDocument,
        uid: "source-user",
        key: "source-document",
        createdAt: 1,
        content: {},
        visibility: "public"
      });
      const content = createSingleTileContent({ type: "Text", text: "test" });
      sourceDocument.setContent(DocumentContentModel.create(content));

      const destinationDocument = DocumentModel.create({
        type: ProblemDocument,
        uid: "destination-user",
        key: "destination-document",
        createdAt: 1,
        content: {},
        visibility: "public"
      });

      stores.documents.add(sourceDocument);
      stores.documents.add(destinationDocument);

      mock.post(/.*/, (req, res) => {
        const request = JSON.parse(req.body());

        expect(request.event).toBe("COPY_TILE");
        // expect(request.parameters.objectId).toBe(tile.id);
        expect(request.parameters.objectType).toBe("Text");
        expect(request.parameters.serializedObject).toEqual({
          type: "Text",
          text: "test"
        });
        expect(request.parameters.documentKey).toBe("destination-document");
        expect(request.parameters.documentType).toBe("problem");
        expect(request.parameters.objectId).not.toBe(tileToCopy.id);
        expect(request.parameters.sourceDocumentKey).toBe("source-document");
        expect(request.parameters.sourceDocumentType).toBe("problem");
        expect(request.parameters.sourceObjectId).toBe(tileToCopy.id);
        expect(request.parameters.sourceUsername).toBe("source-user");

        done();
        return res.status(201);
      });

      const tileToCopy = sourceDocument.content.firstTile!;

      const copyTileInfo: IDragTileItem = {
        rowIndex: 0,
        tileIndex: 0,
        tileId: tileToCopy.id,
        tileContent: JSON.stringify(tileToCopy),
        tileType: tileToCopy.content.type
      };

      destinationDocument.content.userCopyTiles([copyTileInfo], { rowInsertIndex: 0 });
    });

  });

  describe("Tile changes", () => {
    it("can log tile change events", (done) => {
      const tile = ToolTileModel.create({ content: defaultGeometryContent() });
      const change: JXGChange = { operation: "create", target: "point" };

      mock.post(/.*/, (req, res) => {
        const request = JSON.parse(req.body());

        expect(request.event).toBe("GRAPH_TOOL_CHANGE");
        expect(request.parameters.toolId).toBe(tile.id);
        expect(request.parameters.operation).toBe("create");
        expect(request.parameters.target).toBe("point");
        expect(request.parameters.documentKey).toBe(undefined);

        done();
        return res.status(201);
      });

      Logger.logToolChange(LogEventName.GRAPH_TOOL_CHANGE, "create", change, tile.id);
    });
  });

  describe("workspace events", () => {

    let workspace: WorkspaceModelType;
    let doc1: DocumentModelType;
    let doc2: DocumentModelType;

    beforeEach(() => {
      workspace = WorkspaceModel.create({
        type: ProblemWorkspace,
        mode: "1-up",
      });

      doc1 = DocumentModel.create({
        uid: "1",
        type: ProblemWorkspace,
        key: "test1",
        createdAt: 1,
        content: {}
      });

      doc2 = DocumentModel.create({
        uid: "2",
        type: ProblemDocument,
        key: "test2",
        createdAt: 1,
        content: {}
      });
    });

    it("can log opening the primary document", (done) => {
      mock.post(/.*/, (req, res) => {
        const request = JSON.parse(req.body());

        expect(request.event).toBe("VIEW_SHOW_DOCUMENT");
        expect(request.parameters.documentKey).toBe("test1");
        expect(request.parameters.documentType).toBe("problem");

        done();
        return res.status(201);
      });

      workspace.setPrimaryDocument(doc1);
    });

    it("can log opening the comparison document", (done) => {
      mock.post(/.*/, (req, res) => {
        const request = JSON.parse(req.body());

        expect(request.event).toBe("VIEW_SHOW_COMPARISON_DOCUMENT");
        expect(request.parameters.documentKey).toBe("test2");
        expect(request.parameters.documentType).toBe("problem");

        done();
        return res.status(201);
      });

      workspace.setComparisonDocument(doc2);
    });

    it("can log toggling the comparison panel", (done) => {
      mock.post(/.*/, (req, res) => {
        const request = JSON.parse(req.body());

        expect(request.event).toBe("VIEW_SHOW_COMPARISON_PANEL");

        done();
        return res.status(201);
      });

      workspace.toggleComparisonVisible();
    });

    it("can log toggling of mode", (done) => {
      mock.post(/.*/, (req, res) => {
        const request = JSON.parse(req.body());

        expect(request.event).toBe("VIEW_ENTER_FOUR_UP");

        done();
        return res.status(201);
      });

      workspace.toggleMode();
    });
  });
});
