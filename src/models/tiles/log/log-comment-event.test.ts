import { getSnapshot } from "mobx-state-tree";
import mockXhr from "xhr-mock";
import { ILogComment, logCommentEvent } from "./log-comment-event";
import { InvestigationModel } from "../../curriculum/investigation";
import { ProblemModel } from "../../curriculum/problem";
import { DocumentContentModel } from "../../document/document-content";
import { createDocumentModel } from "../../document/document";
import { ProblemDocument } from "../../document/document-types";
import { specAppConfig } from "../../stores/spec-app-config";
import { createStores, IStores } from "../../stores/stores";
import { UserModel } from "../../stores/user";
import { TileModel } from "../tile-model";
import { TextContentModel } from "../text/text-content";
import { Logger } from "../../../lib/logger";
import { createSingleTileContent } from "../../../utilities/test-utils";

// This is needed so MST can deserialize snapshots referring to tiles
import { registerTileTypes } from "../../../register-tile-types";
registerTileTypes(["Text"]);

const investigation = InvestigationModel.create({
  ordinal: 1,
  title: "Investigation 1",
  problems: [ { ordinal: 1, title: "Problem 1.1" } ]
});
const problem = investigation.getProblem(1);

describe("authed logger", () => {
  let stores: IStores;

  beforeEach(() => {
    mockXhr.setup();

    const content = DocumentContentModel.create(createSingleTileContent({
      id: "tile1",
      type: "Text",
      title: "test title",
    }));

    stores = createStores({
      appMode: "authed",
      appConfig: specAppConfig({ config: { appName: "TestLogger" } }),
      user: UserModel.create({
        id: "0", type: "student", portal: "test",
        loggingRemoteEndpoint: "foo"
      }),
      problem:  ProblemModel.create({
        ordinal: 1, title: "Problem",
        sections: [{
          type: "introduction",
          content: getSnapshot(content),
        }]
      })
    });

    Logger.initializeLogger(stores, { investigation: investigation.title, problem: problem?.title });
  });

  afterEach(() => {
    mockXhr.teardown();
  });

  describe ("log comment events", () => {
    const addDocumentWithTile = (key: string)=> {
      const document = createDocumentModel({
        type: ProblemDocument,
        uid: "1",
        key,
        createdAt: 1,
        content: createSingleTileContent({
          id: "tile1",
          type: "Text",
          title: "test title",
        }),
        visibility: "public"
      });
      stores.documents.add(document);
    };

    it("can log an ADD a document initial comment event", (done) => {
      const documentKey = "source-document";
      addDocumentWithTile(documentKey);
      const commentText = "TeSt";
      const addEventPayload: ILogComment = {
        focusDocumentId: documentKey,
        isFirst: true,
        commentText,
        action: "add"
      };

      mockXhr.post(/.*/, (req, res) => {
        const addCommentRequest = JSON.parse(req.body());
        expect(addCommentRequest.event).toBe("ADD_INITIAL_COMMENT_FOR_DOCUMENT");
        expect(addCommentRequest.parameters.commentText).toBe(commentText);
        expect(addCommentRequest.parameters.documentKey).toBe(documentKey);
        done();
        return res.status(201);
      });

      logCommentEvent(addEventPayload);
    });

    it("Curriculum path comment event logs Tile Type", (done) => {
      const documentKey = "sas/0/1/introduction";
      addDocumentWithTile(documentKey);
      const commentText = "TeSt";
      const addEventPayload: ILogComment = {
        focusDocumentId: documentKey,
        focusTileId: 'tile1',
        isFirst: true,
        commentText,
        action: "add"
      };

      mockXhr.post(/.*/, (req, res) => {
        const addCommentRequest = JSON.parse(req.body());
        expect(addCommentRequest.event).toBe("ADD_INITIAL_COMMENT_FOR_TILE");
        expect(addCommentRequest.parameters.commentText).toBe(commentText);
        expect(addCommentRequest.parameters.curriculum).toBe(documentKey);
        expect(addCommentRequest.parameters.tileType).toBe("Text");
        done();
        return res.status(201);
      });

      logCommentEvent(addEventPayload);
    });

    it("can log an ADD a document response comment event", (done) => {
      const documentKey = "source-document";
      addDocumentWithTile(documentKey);
      const commentText = "TeSt";
      const addEventPayload: ILogComment = {
        focusDocumentId: documentKey,
        isFirst: false,
        commentText,
        action: "add"
      };

      mockXhr.post(/.*/, (req, res) => {
        const addCommentRequest = JSON.parse(req.body());
        expect(addCommentRequest.event).toBe("ADD_RESPONSE_COMMENT_FOR_DOCUMENT");
        expect(addCommentRequest.parameters.commentText).toBe(commentText);
        expect(addCommentRequest.parameters.documentKey).toBe(documentKey);
        expect(addCommentRequest.parameters.tileType).toBeUndefined();

        done();
        return res.status(201);
      });

      logCommentEvent(addEventPayload);
    });

    it("can log an ADD a tile comment event and tile type logged", (done) => {
      const documentKey = "source-document";

      addDocumentWithTile(documentKey);
      const tileId = "tile1";
      const commentText = "TeSt";
      const addEventPayload: ILogComment = {
        focusDocumentId: documentKey,
        focusTileId: "tile1",
        isFirst: false,
        commentText,
        action: "add"
      };

      mockXhr.post(/.*/, (req, res) => {
        const addCommentRequest = JSON.parse(req.body());
        expect(addCommentRequest.event).toBe("ADD_RESPONSE_COMMENT_FOR_TILE");
        expect(addCommentRequest.parameters.tileId).toBe(tileId);
        expect(addCommentRequest.parameters.commentText).toBe(commentText);
        expect(addCommentRequest.parameters.documentKey).toBe(documentKey);
        expect(addCommentRequest.parameters.tileType).toBe("Text");
        done();
        return res.status(201);
      });

      logCommentEvent(addEventPayload);
    });

    it("can log a DELETE document comment event", (done) => {
      const documentKey = "source-document";
      addDocumentWithTile(documentKey);
      const commentText = "TeSt";
      const deleteEventPayload: ILogComment = {
        focusDocumentId: documentKey,
        isFirst: false,
        commentText,
        action: "delete"
      };

      mockXhr.post(/.*/, (req, res) => {
        const deleteCommentRequest = JSON.parse(req.body());
        expect(deleteCommentRequest.event).toBe("DELETE_COMMENT_FOR_DOCUMENT");
        expect(deleteCommentRequest.parameters.commentText).toBe(commentText);
        expect(deleteCommentRequest.parameters.documentKey).toBe(documentKey);
        done();
        return res.status(201);
      });
      logCommentEvent(deleteEventPayload);
    });

    it("can log a DELETE tile comment event", (done) => {
      const documentKey = "source-document";
      addDocumentWithTile(documentKey);
      const tile = TileModel.create({ content: TextContentModel.create() });
      const tileId = tile.id;
      const commentText = "TeSt";
      const deleteEventPayload: ILogComment = {
        focusDocumentId: documentKey,
        focusTileId: tile.id,
        isFirst: false,
        commentText,
        action: "delete"
      };

      mockXhr.post(/.*/, (req, res) => {
        const deleteCommentRequest = JSON.parse(req.body());
        expect(deleteCommentRequest.event).toBe("DELETE_COMMENT_FOR_TILE");
        expect(deleteCommentRequest.parameters.tileId).toBe(tileId);
        expect(deleteCommentRequest.parameters.commentText).toBe(commentText);
        expect(deleteCommentRequest.parameters.documentKey).toBe(documentKey);
        done();
        return res.status(201);
      });
      logCommentEvent(deleteEventPayload);
    });

    it("can log a EXPAND tile comment thread event", (done) => {
      const documentKey = "source-document";
      addDocumentWithTile(documentKey);
      const tile = TileModel.create({ content: TextContentModel.create() });
      const tileId = tile.id;
      const expandCommentPayload: ILogComment = {
        focusDocumentId: documentKey,
        focusTileId: tile.id,
        isFirst: false,
        commentText: '',
        action: "expand"
      };

      mockXhr.post(/.*/, (req, res) => {
        const expand = JSON.parse(req.body());
        expect(expand.event).toBe("EXPAND_COMMENT_THREAD_FOR_TILE");
        expect(expand.parameters.tileId).toBe(tileId);
        expect(expand.parameters.documentKey).toBe(documentKey);
        done();
        return res.status(201);
      });
      logCommentEvent(expandCommentPayload);
    });

    it("can log a COLLAPSE tile comment thread event", (done) => {
      const documentKey = "source-document";
      addDocumentWithTile(documentKey);
      const tile = TileModel.create({ content: TextContentModel.create() });
      const tileId = tile.id;
      const collapseCommentPayload: ILogComment = {
        focusDocumentId: documentKey,
        focusTileId: tile.id,
        isFirst: false,
        commentText: '',
        action: "collapse"
      };

      mockXhr.post(/.*/, (req, res) => {
        const expand = JSON.parse(req.body());
        expect(expand.event).toBe("COLLAPSE_COMMENT_THREAD_FOR_TILE");
        expect(expand.parameters.tileId).toBe(tileId);
        expect(expand.parameters.documentKey).toBe(documentKey);
        done();
        return res.status(201);
      });
      logCommentEvent(collapseCommentPayload);
    });

    it("can log a EXPAND document comment thread event", (done) => {
      const documentKey = "source-document";
      addDocumentWithTile(documentKey);
      const expandCommentPayload: ILogComment = {
        focusDocumentId: documentKey,
        focusTileId: undefined,
        isFirst: false,
        commentText: '',
        action: "expand"
      };

      mockXhr.post(/.*/, (req, res) => {
        const expand = JSON.parse(req.body());
        expect(expand.event).toBe("EXPAND_COMMENT_THREAD_FOR_DOCUMENT");
        expect(expand.parameters.tileId).toBe(undefined);
        expect(expand.parameters.documentKey).toBe(documentKey);
        done();
        return res.status(201);
      });
      logCommentEvent(expandCommentPayload);
    });

    it("can log a COLLAPSE document comment thread event", (done) => {
      const documentKey = "source-document";
      addDocumentWithTile(documentKey);
      const expandCommentPayload: ILogComment = {
        focusDocumentId: documentKey,
        focusTileId: undefined,
        isFirst: false,
        commentText: '',
        action: "collapse"
      };

      mockXhr.post(/.*/, (req, res) => {
        const expand = JSON.parse(req.body());
        expect(expand.event).toBe("COLLAPSE_COMMENT_THREAD_FOR_DOCUMENT");
        expect(expand.parameters.tileId).toBe(undefined);
        expect(expand.parameters.documentKey).toBe(documentKey);
        done();
        return res.status(201);
      });
      logCommentEvent(expandCommentPayload);
    });
  });
});
