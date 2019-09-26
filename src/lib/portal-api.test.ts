import { getPortalOfferings, PortalOfferingParser } from "./portal-api";
import * as nock from "nock";
import { TeacherOfferings } from "../test-fixtures/sample-portal-offerings";
import * as appConfigJson from "../clue/app-config.json";

const userType = "teacher";
const userID = 22;
const domain = "http://superfake.dev/";
const fakeJWT = {};

describe("Portal Offerings", () => {
  beforeEach(() => {
    nock(/superfake/)
      .get(/\/api\/v1\/offerings\/\?user_id=22/)
      .reply(200, TeacherOfferings);
  });

  afterEach(() => nock.cleanAll());

  describe("getPortalOfferings", () => {
    let fetchedOfferings;

    beforeEach(async () => {
      fetchedOfferings = await getPortalOfferings(userType, userID, domain, fakeJWT);
    });

    it("Result should have 3 Offerings", () => {
      expect(fetchedOfferings.length).toEqual(3);
    });
  });

  describe("PortalOfferingParser", () => {
    const { getProblemOrdinal, getUnitCode } = PortalOfferingParser;

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
        const unitCode = getUnitCode(samplePortalOffering.activity_url);
        expect(unitCode).toEqual("foo");
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

    const defaultOrdinal = appConfigJson.defaultProblemOrdinal;
    const defaultUnit = appConfigJson.defaultUnit;

    describe("getProblemOrdinal", () => {
      it(`should default to '${defaultOrdinal}'`, () => {
        const ordinal = getProblemOrdinal(samplePortalOffering.activity_url);
        expect(ordinal).toEqual(defaultOrdinal);
      });
    });

    describe("getUnitCode", () => {
      it(`should default to '${defaultUnit}'`, () => {
        const unitCode = getUnitCode(samplePortalOffering.activity_url);
        expect(unitCode).toEqual(defaultUnit);
      });
    });
  });
});
