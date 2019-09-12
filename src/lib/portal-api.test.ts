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
    const {
      getProblemOrdinal,
      getDashboardUrl,
      getClueClassOfferings,
      getProblemLinkForClass
    } = PortalOfferingParser;
    const samplePortalOffering = {
      id: 1190,
      teacher: "Dave Love",
      clazz: "ClueClass1",
      clazz_id: 242,
      activity: "CLUE 1.2: Stretching a Figure - Comparing Similar Figures",
      activity_url: "https://collaborative-learning.concord.org/branch/master/?problem=1.2",
      external_report: {
        id: 14,
        name: "CLUE Dashboard",
        url: "https://learn.staging.concord.org/portal/offerings/1190/external_report/14",
        launch_text: "CLUE Dashboard"
      }
    };

    const sampleClueProblems = {
      ClueClass1: [{
        name: "CLUE 1.2: Stretching a Figure - Comparing Similar Figures",
        launchUrl: "https://collaborative-learning.concord.org/branch/master/?problem=1.2",
        problemOrdinal: "1.1.2", // TODO: Unclude unit in launch params?
        dashboardUrl: "https://learn.staging.concord.org/portal/offerings/1190/external_report/14"}]
      };

    describe("getProblemOrdinal", () => {
      it("should return a problemOrdinal", () => {
        const ordinal = getProblemOrdinal(samplePortalOffering);
        expect(ordinal).toEqual("1.2");
      });
    });

    describe("getDashboardUrl", () => {
      it("should return a problemOrdinal", () => {
        const dashboard = getDashboardUrl(samplePortalOffering);
        expect(dashboard).toEqual("https://learn.staging.concord.org/portal/offerings/1190/external_report/14");
      });
    });

    describe("getClueClassOfferings", () => {
      it("Should parse an array of one offering, and return a dictionary with one problem", () => {
        const clueClassOfferings = getClueClassOfferings([samplePortalOffering]);
        expect(clueClassOfferings).toHaveProperty("ClueClass1");
        expect(clueClassOfferings.ClueClass1.length).toBe(1);
        const problem = clueClassOfferings.ClueClass1[0];
        expect(problem.name).toEqual("CLUE 1.2: Stretching a Figure - Comparing Similar Figures");
      });

      it("should handle a large number of offerings", () => {
        const clueClassOfferings = getClueClassOfferings(TeacherOfferings);
        expect(clueClassOfferings).toHaveProperty("ClueClass1");
        expect(clueClassOfferings).toHaveProperty("ClueClass2");
        // This class doesn't have a clue assignment.
        expect(clueClassOfferings).not.toHaveProperty("DavesTETester");
      });
    });
    describe("getProblemLinkForClass", () => {
      it("Should return links for the matching problems ...", () => {
        const clueClassOfferings = getClueClassOfferings(TeacherOfferings);
        let problemLink  = getProblemLinkForClass(clueClassOfferings, "ClueClass2", "1.2");
        const expectedLink = "https://learn.staging.concord.org/portal/offerings/1191/external_report/14";
        expect(problemLink).toEqual(expectedLink);
        problemLink = getProblemLinkForClass(clueClassOfferings, "ClueClass5", "1.2");
        expect(problemLink).toEqual(null);
        // If we haven't assigned that problem, just choose the first one:
        problemLink  = getProblemLinkForClass(clueClassOfferings, "ClueClass2", "1.4");
        expect(problemLink).toEqual(expectedLink);
      });
    });
  });
});
