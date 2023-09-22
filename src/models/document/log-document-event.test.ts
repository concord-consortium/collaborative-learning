import { getSnapshot } from "mobx-state-tree";
import mockXhr from "xhr-mock";
import { DocumentContentModel } from "./document-content";
import { InvestigationModel } from "../curriculum/investigation";
import { ProblemModel } from "../curriculum/problem";
import { specAppConfig } from "../stores/spec-app-config";
import { createStores, IStores } from "../stores/stores";
import { UserModel } from "../stores/user";
import { createSingleTileContent } from "../../utilities/test-utils";
import { logDocumentEvent } from "./log-document-event";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { createDocumentModel } from "./document";
import { ProblemDocument } from "./document-types";

const investigation = InvestigationModel.create({
  ordinal: 1,
  title: "Investigation 1",
  problems: [ { ordinal: 1, title: "Problem 1.1" } ]
});
const problem = investigation.getProblem(1);

describe("logDocumentEvent", () => {
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

  const addDocument = (key: string, overrides?: Record<string, any>) => {
    const document = createDocumentModel({
      type: ProblemDocument,
      uid: "1",
      key,
      createdAt: 1,
      content: {},
      visibility: "public",
      ...overrides
    });
    stores.documents.add(document);
    return document;
  };

  it("logs document event without properties", (done) => {
    const documentKey = "source-document";
    const document = addDocument(documentKey);

    mockXhr.post(/.*/, (req, res) => {
      const logRequest = JSON.parse(req.body());
      expect(logRequest.event).toBe("INTERNAL_TEST_EVENT");
      expect(logRequest.parameters.documentUid).toBe("1");
      expect(logRequest.parameters.documentKey).toBe("source-document");
      expect(logRequest.parameters.documentType).toBe(ProblemDocument);
      expect(logRequest.parameters.documentVisibility).toBe("public");
      done();
      return res.status(201);
    });
    logDocumentEvent(LogEventName.INTERNAL_TEST_EVENT, { document });
  });

  it("logs document event with title", (done) => {
    const documentKey = "source-document";
    const document = addDocument(documentKey, { title: "title" });

    mockXhr.post(/.*/, (req, res) => {
      const logRequest = JSON.parse(req.body());
      expect(logRequest.event).toBe("INTERNAL_TEST_EVENT");
      expect(logRequest.parameters.documentUid).toBe("1");
      expect(logRequest.parameters.documentKey).toBe("source-document");
      expect(logRequest.parameters.documentType).toBe(ProblemDocument);
      expect(logRequest.parameters.documentTitle).toBe("title");
      expect(logRequest.parameters.documentVisibility).toBe("public");
      expect(logRequest.parameters.documentProperties).toEqual({});
      done();
      return res.status(201);
    });
    logDocumentEvent(LogEventName.INTERNAL_TEST_EVENT, { document });
  });

  it("logs document event with properties", (done) => {
    const documentKey = "source-document";
    const document = addDocument(documentKey, { properties: { foo: "bar" } });

    mockXhr.post(/.*/, (req, res) => {
      const logRequest = JSON.parse(req.body());
      expect(logRequest.event).toBe("INTERNAL_TEST_EVENT");
      expect(logRequest.parameters.documentUid).toBe("1");
      expect(logRequest.parameters.documentKey).toBe("source-document");
      expect(logRequest.parameters.documentType).toBe(ProblemDocument);
      expect(logRequest.parameters.documentVisibility).toBe("public");
      expect(logRequest.parameters.documentProperties).toEqual({ foo: "bar" });
      done();
      return res.status(201);
    });
    logDocumentEvent(LogEventName.INTERNAL_TEST_EVENT, { document });
  });

  it("logs remote document event", (done) => {
    const documentKey = "source-document";
    const document = addDocument(documentKey, { remoteContext: "class-hash" });

    mockXhr.post(/.*/, (req, res) => {
      const logRequest = JSON.parse(req.body());
      expect(logRequest.event).toBe("INTERNAL_TEST_EVENT");
      expect(logRequest.parameters.documentUid).toBe("1");
      expect(logRequest.parameters.documentKey).toBe("source-document");
      expect(logRequest.parameters.documentType).toBe(ProblemDocument);
      expect(logRequest.parameters.documentVisibility).toBe("public");
      expect(logRequest.parameters.documentProperties).toEqual({});
      expect(logRequest.parameters.networkClassHash).toBe("class-hash");
      expect(logRequest.parameters.networkUsername).toBe("1@test");
      done();
      return res.status(201);
    });
    logDocumentEvent(LogEventName.INTERNAL_TEST_EVENT, { document });
  });

});
