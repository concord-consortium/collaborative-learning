import { getSnapshot } from "mobx-state-tree";
import { DocumentContentModel } from "../document/document-content";
import { InvestigationModel } from "./investigation";
import { ProblemModel } from "./problem";
import { specAppConfig } from "../stores/spec-app-config";
import { createStores, IStores } from "../stores/stores";
import { UserModel } from "../stores/user";
import { createSingleTileContent } from "../../utilities/test-utils";
import { logCurriculumEvent } from "./log-curriculum-event";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";

const investigation = InvestigationModel.create({
  ordinal: 1,
  title: "Investigation 1",
  problems: [ { ordinal: 1, title: "Problem 1.1" } ]
});
const problem = investigation.getProblem(1);

describe("logCurriculumEvent", () => {
  let stores: IStores;

  const logSpy = jest.spyOn(Logger, "log").mockImplementation(() => null);

  beforeEach(() => {
    logSpy.mockClear();

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

  afterAll(() => {
    logSpy.mockRestore();
  });

  it("logs curriculum event with invalid curriculum path", () => {
    const curriculum = "bogus";

    logCurriculumEvent(LogEventName.INTERNAL_TEST_EVENT, { curriculum });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [event, params] = logSpy.mock.calls[0];
    expect(event).toBe(LogEventName.INTERNAL_TEST_EVENT);
    expect(params?.curriculum).toBe(curriculum);
    expect(params?.curriculumFacet).toBe("");
    expect(params?.curriculumSection).toBeUndefined();
  });

  it("logs curriculum event without facet", () => {
    const curriculum = "test/1/2/section";

    logCurriculumEvent(LogEventName.INTERNAL_TEST_EVENT, { curriculum });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [event, params] = logSpy.mock.calls[0];
    expect(event).toBe(LogEventName.INTERNAL_TEST_EVENT);
    expect(params?.curriculum).toBe(curriculum);
    expect(params?.curriculumFacet).toBe("");
    expect(params?.curriculumSection).toBe("section");
  });

  it("logs curriculum event with facet", () => {
    const curriculum = "test:facet/1/2/section";

    logCurriculumEvent(LogEventName.INTERNAL_TEST_EVENT, { curriculum });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [event, params] = logSpy.mock.calls[0];
    expect(event).toBe(LogEventName.INTERNAL_TEST_EVENT);
    expect(params?.curriculum).toBe(curriculum);
    expect(params?.curriculumFacet).toBe("facet");
    expect(params?.curriculumSection).toBe("section");
  });

  it("logs curriculum event with client-provided properties", () => {
    const curriculum = "test/1/2/section";

    logCurriculumEvent(LogEventName.INTERNAL_TEST_EVENT, { curriculum, foo: "bar" });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [event, params] = logSpy.mock.calls[0];
    expect(event).toBe(LogEventName.INTERNAL_TEST_EVENT);
    expect(params?.curriculum).toBe(curriculum);
    expect(params?.curriculumFacet).toBe("");
    expect(params?.curriculumSection).toBe("section");
    expect(params?.foo).toBe("bar");
  });
});
