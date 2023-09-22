import { getSnapshot } from "mobx-state-tree";
import mockXhr from "xhr-mock";
import { InvestigationModel } from "../curriculum/investigation";
import { ProblemModel } from "../curriculum/problem";
import { DocumentContentModel } from "../document/document-content";
import { createDocumentModel } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { ILogHistory, logHistoryEvent } from "../../models/history/log-history-event";
import { specAppConfig } from "../../models/stores/spec-app-config";
import { createStores, IStores } from "../stores/stores";
import { UserModel } from "../stores/user";
import { createSingleTileContent } from "../../utilities/test-utils";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";

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

  describe("log history curriculum events", () => {

    // For some reason I wasn't able to track down, xhrMock didn't work for this case,
    // so we spy the logger instead.
    const logSpy = jest.spyOn(Logger, "log").mockImplementation();

    beforeEach(() => {
      logSpy.mockClear();
    });

    afterAll(() => {
      logSpy.mockRestore();
    });

    it("logs curriculum event with history metadata", () => {
      const curriculumKey = "test/1/2/section";
      const historyPayload: ILogHistory = {
        documentId: curriculumKey,
        historyIndex: 12,
        historyLength: 99,
        historyEventId: "history-id",
        action: "playStart"
      };

      logHistoryEvent(historyPayload);

      expect(logSpy).toHaveBeenCalledTimes(1);
      const [event, params] = logSpy.mock.calls[0];
      expect(event).toBe(LogEventName.HISTORY_PLAYBACK_START);
      expect(params?.curriculum).toBe(curriculumKey);
      expect(params?.curriculumSection).toBe("section");
      expect(params?.historyEventId).toBe("history-id");
      expect(params?.historyLength).toBe(99);
      expect(params?.historyIndex).toBe(12);
    });

  });

  describe ("log history document events", () => {
    const addDocument = (key: string) => {
      const document = createDocumentModel({
        type: ProblemDocument,
        uid: "1",
        key,
        createdAt: 1,
        content: {},
        visibility: "public"
      });
      stores.documents.add(document);
    };

    it("warns when logging a bogus document event with history metadata", () => {
      const documentKey = "source-document";
      addDocument(documentKey);
      const historyPayload: ILogHistory = {
        documentId: "bogus-document",
        historyIndex: 12,
        historyLength: 99,
        historyEventId: "history-id",
        action: "playStart"
      };

      // For some reason I wasn't able to track down, xhrMock didn't work for this case,
      // so we spy the logger instead.
      const logSpy = jest.spyOn(Logger, "log").mockImplementation();

      jestSpyConsole("warn", spy => {
        logHistoryEvent(historyPayload);
        expect(spy).toHaveBeenCalledTimes(1);
      });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const [event, params] = logSpy.mock.calls[0];
      expect(event).toBe(LogEventName.HISTORY_PLAYBACK_START);
      expect(params?.documentId).toBe("bogus-document");
      expect(params?.historyEventId).toBe("history-id");
      expect(params?.historyLength).toBe(99);
      expect(params?.historyIndex).toBe(12);

      logSpy.mockRestore();
    });

    it("logs document event with history metadata", (done) => {
      const documentKey = "source-document";
      addDocument(documentKey);
      const historyPayload: ILogHistory = {
        documentId: documentKey,
        historyIndex: 12,
        historyLength: 99,
        historyEventId: "history-id",
        action: "playStart"
      };

      mockXhr.post(/.*/, (req, res) => {
        const historyRequest = JSON.parse(req.body());
        expect(historyRequest.event).toBe("HISTORY_PLAYBACK_START");
        expect(historyRequest.parameters.documentKey).toBe(documentKey);
        expect(historyRequest.parameters.historyEventId).toBe("history-id");
        expect(historyRequest.parameters.historyLength).toBe(99);
        expect(historyRequest.parameters.historyIndex).toBe(12);
        done();
        return res.status(201);
      });
      logHistoryEvent(historyPayload);
    });

    it("logs showControls Event", (done) => {
      const documentKey = "source-document";
      addDocument(documentKey);
      const historyPayload: ILogHistory = {
        documentId: documentKey,
        action: "showControls"
      };

      mockXhr.post(/.*/, (req, res) => {
        const historyRequest = JSON.parse(req.body());
        expect(historyRequest.event).toBe("HISTORY_SHOW_CONTROLS");
        expect(historyRequest.parameters.documentKey).toBe(documentKey);
        done();
        return res.status(201);
      });
      logHistoryEvent(historyPayload);
    });

    it("logs hideControls Event", (done) => {
      const documentKey = "source-document";
      addDocument(documentKey);
      const historyPayload: ILogHistory = {
        documentId: documentKey,
        action: "hideControls"
      };

      mockXhr.post(/.*/, (req, res) => {
        const historyRequest = JSON.parse(req.body());
        expect(historyRequest.event).toBe("HISTORY_HIDE_CONTROLS");
        done();
        return res.status(201);
      });
      logHistoryEvent(historyPayload);
    });

    it("logs playStart Event", (done) => {
      const documentKey = "source-document";
      addDocument(documentKey);
      const historyPayload: ILogHistory = {
        documentId: documentKey,
        action: "playStart"
      };

      mockXhr.post(/.*/, (req, res) => {
        const historyRequest = JSON.parse(req.body());
        expect(historyRequest.event).toBe("HISTORY_PLAYBACK_START");
        done();
        return res.status(201);
      });
      logHistoryEvent(historyPayload);
    });

    it("logs playStop Event", (done) => {
      const documentKey = "source-document";
      addDocument(documentKey);
      const historyPayload: ILogHistory = {
        documentId: documentKey,
        action: "playStop"
      };

      mockXhr.post(/.*/, (req, res) => {
        const historyRequest = JSON.parse(req.body());
        expect(historyRequest.event).toBe("HISTORY_PLAYBACK_STOP");
        done();
        return res.status(201);
      });
      logHistoryEvent(historyPayload);
    });

    it("logs playSeek Event", (done) => {
      const documentKey = "source-document";
      addDocument(documentKey);
      const historyPayload: ILogHistory = {
        documentId: documentKey,
        action: "playSeek"
      };

      mockXhr.post(/.*/, (req, res) => {
        const historyRequest = JSON.parse(req.body());
        expect(historyRequest.event).toBe("HISTORY_PLAYBACK_SEEK");
        done();
        return res.status(201);
      });
      logHistoryEvent(historyPayload);
    });
  });
});
