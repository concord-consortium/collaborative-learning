import { getPortalOfferings, IPortalOffering, PortalOfferingParser } from "./portal-api";
import nock from "nock";
import { TeacherMineClasses, TeacherOfferings } from "../test-fixtures/sample-portal-offerings";
import { AppConfigModel } from "../models/stores/app-config-model";

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

  describe("PortalOfferingParser", () => {
    const { getProblemOrdinal, getUnitCode } = PortalOfferingParser;

    const appConfig = AppConfigModel.create();
    const samplePortalOffering = {
      id: 1190,
      teacher: "Dave Love",
      clazz: "ClueClass1",
      clazz_id: 242,
      activity: "CLUE 1.2: Stretching a Figure - Comparing Similar Figures",
      activity_url: "https://collaborative-learning.concord.org/branch/master/?problem=1.2&unit=foo"
    };

    describe("getProblemOrdinal", () => {
      it("should return a problemOrdinal", () => {
        const ordinal = getProblemOrdinal(samplePortalOffering.activity_url);
        expect(ordinal).toEqual("1.2");
      });
    });

    describe("getUnitCode", () => {
      it("should return a unit code for problem", () => {
        const unitCode = getUnitCode(samplePortalOffering.activity_url, appConfig);
        expect(unitCode).toEqual("foo");
      });

      it("should return a mapped unit code for legacy units", () => {
        const barAppConfig = AppConfigModel.create({ unitCodeMap: { foo: "bar" }});
        const unitCode = getUnitCode(samplePortalOffering.activity_url, barAppConfig);
        expect(unitCode).toEqual("bar");
      });
    });
  });

  describe("PortalOfferingParserWithDefaults", () => {
    const { getProblemOrdinal, getUnitCode } = PortalOfferingParser;

    const samplePortalOffering = {
      id: 1190,
      teacher: "Dave Love",
      clazz: "ClueClass1",
      clazz_id: 242,
      activity: "CLUE 1.2: Stretching a Figure - Comparing Similar Figures",
      activity_url: "https://collaborative-learning.concord.org/branch/master/"
    };

    describe("getProblemOrdinal", () => {
      it(`should default to 'undefined'`, () => {
        const ordinal = getProblemOrdinal(samplePortalOffering.activity_url);
        expect(ordinal).toBeUndefined();
      });
    });

    describe("getUnitCode", () => {
      const appConfig = AppConfigModel.create();
      it(`should default to 'undefined'`, () => {
        const unitCode = getUnitCode(samplePortalOffering.activity_url, appConfig);
        expect(unitCode).toBeUndefined();
      });
    });
  });
});
