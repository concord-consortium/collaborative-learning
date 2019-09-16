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
      it("Should parse an array of one Portal offering, and return a Array of one problem", () => {
        const clueClassOfferings = getClueClassOfferings([samplePortalOffering]);
        expect(clueClassOfferings.length).toBe(1);
        const problem = clueClassOfferings[0];
        expect(problem.className).toEqual("ClueClass1");
      });

      it("should work with multiple offerings recorded from portal api", () => {
        const clueClassOfferings = getClueClassOfferings(TeacherOfferings);
        expect(clueClassOfferings[0].className).toEqual("ClueClass1");
        expect(clueClassOfferings[1].className).toEqual("ClueClass1");
        expect(clueClassOfferings[2].className).toEqual("ClueClass2");
        expect(clueClassOfferings.length).toEqual(3);
        // The class "DavesTETester" doesn't have a clue assignment.
        // Our list should not include assigments from that class.
      });
    });

    describe("getProblemLinkForClass", () => {
      it("Should return links for the matching problems ...", () => {
        // convert portal offerings to clue class problem list
        const clueClassOfferings = getClueClassOfferings(TeacherOfferings);

        let problemLink  = getProblemLinkForClass(clueClassOfferings, "ClueClass2", "1.2");
        // This link actually goes to problem 1.1 -- because ClueClass2 doesn't incude
        // problem 1.2 ... TBD this is what we want to do right?
        const expectedLink = {
          className: "ClueClass2",
          dashboardUrl: "https://learn.staging.concord.org/portal/offerings/1191/external_report/14",
          problemOrdinal: "1.1"
        };

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
