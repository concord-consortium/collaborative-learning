import nock from "nock";
import { getPortalClassOfferings, getPortalOfferings } from "./portal-api";
import { IPortalOffering } from "./portal-types";
import { TeacherMineClasses, TeacherOfferings } from "../test-fixtures/sample-portal-offerings";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { CurriculumConfig } from "../models/stores/curriculum-config";

const userType = "teacher";
const userID = 22;
const domain = "http://superfake.dev/";
const fakeJWT = {};

describe("Portal Offerings", () => {
  beforeEach(() => {
    nock(/superfake/)
      .get(/\/api\/v1\/offerings\/\?user_id=22/)
      .reply(200, TeacherOfferings);
    nock(/superfake/)
      .get(/\/api\/v1\/classes\/mine/)
      .reply(200, TeacherMineClasses);
  });

  afterEach(() => nock.cleanAll());

  describe("getPortalOfferings", () => {
    let fetchedOfferings: IPortalOffering[];

    beforeEach(async () => {
      fetchedOfferings = await getPortalOfferings(userType, userID, domain, fakeJWT);
    });

    it("Result should have 3 Offerings", () => {
      expect(fetchedOfferings.length).toEqual(3);
    });

    it("offerings should have class hashes", () => {
      expect(fetchedOfferings.every(o => o.clazz_hash));
    });
  });

  describe("getPortalClassOfferings", () => {
    const curriculumConfig = CurriculumConfig.create({curriculumBaseUrl: ""});
    const mockAppConfig = {
      config: { defaultProblemOrdinal: "1.1" }
    } as AppConfigModelType;
    const mockUrlParams = {
            class: "https://learn.staging.concord.org/api/v1/classes/242",
            offering: "https://collaborative-learning.concord.org/branch/master/?problem=1.2",
            reportType: "report-type",
            token: "token"
          };
    it("only includes CLUE activities", () => {
      const offerings = getPortalClassOfferings(TeacherOfferings, mockAppConfig, curriculumConfig, mockUrlParams);
      // TeacherOfferings has one non-CLUE activity
      expect(offerings.length).toBe(TeacherOfferings.length - 1);
    });
  });
});
