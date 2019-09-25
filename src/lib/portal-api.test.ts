import { getPortalOfferings, PortalOfferingParser } from "./portal-api";
import * as nock from "nock";
import { TeacherOfferings } from "../test-fixtures/sample-portal-offerings";

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

    // TODO: Fix this!
    // describe("getClueClassOfferings", () => {
    //   it("Should parse an array of one Portal offering, and return a Array of one problem", () => {
    //     const clueClassOfferings = getClueClassOfferings([samplePortalOffering]);
    //     // expect(clueClassOfferings.length).toBe(1);   // TODO: Why isn't this 1?
    //     const problem = clueClassOfferings[0];
    //     expect(problem.className).toEqual("ClueClass1");
    //   });

    //   it("should work with multiple offerings recorded from portal api", () => {
    //     const clueClassOfferings = getClueClassOfferings(TeacherOfferings);
    //     expect(clueClassOfferings.length).toEqual(3);
    //     expect(clueClassOfferings[0].className).toEqual("ClueClass1");
    //     expect(clueClassOfferings[1].className).toEqual("ClueClass1");
    //     expect(clueClassOfferings[2].className).toEqual("ClueClass2");
    //     // The class "DavesTETester" doesn't have a clue assignment.
    //     // Our list should not include assigments from that class.
    //   });
    // });

  });
});
