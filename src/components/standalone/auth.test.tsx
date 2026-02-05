import nock from "nock";
import { findMatchingOffering, findMatchingClassAndOfferingIds, startCLUE, createPortalOfferingForUnit,
         processFinalAuthenticatedState, getFinalAuthenticatedState,
         AuthenticatedState} from "./auth";
import { IPortalClassInfo } from "../../lib/portal-types";
import { reprocessUrlParams } from "../../utilities/url-params";

describe("Standalone Auth helpers", () => {
  const portalInfo = { domain: "https://example.com/", rawPortalJWT: "jwt", teacher: true, student: false };
  const classId = 1;
  const unit = "test-unit";
  const unitJson = { title: "Test Unit", investigations: [{
    description: "Investigation 1",
    ordinal: 1,
    title: "Test Investigation",
    problems: [{
      description: "Problem 1.1",
      ordinal: 1,
      title: "TEST 1.1 First Problem",
    }]
  }]};
  const problem = "1.1";
  const classWord = "test-class";
  const externalUrl = `https://localhost?unit=${unit}&problem=${problem}`;
  const offeringId = 2;

  beforeEach(() => {
    nock(/example\.com/)
      .post(/\/api\/v1\/offerings\/create_for_external_activity/)
      .reply(200, {id: offeringId});
  });

  afterEach(() => nock.cleanAll());

  describe("findMatchingOffering", () => {
    it("should find the correct offering based on unit, problem and domain", () => {
      const clazz: IPortalClassInfo = {
        id: classId,
        class_word: classWord,
        offerings: [
          { id: 1, external_url: `https://localhost?unit=${unit}&problem=1.2` },
          { id: 2, external_url: `https://collaborative-learning.concord.org?unit=other-unit&problem=${problem}` },
          { id: 3, external_url: externalUrl },
        ]
      } as any;
      const result = findMatchingOffering(clazz, unit, problem);
      expect(result?.id).toBe(3);
    });

    it("should return undefined if no matching offering is found", () => {
      const clazz: IPortalClassInfo = {
        id: classId,
        class_word: classWord,
        offerings: [
          { id: 1, external_url: "http://localhost/some-other-url" }
        ]
      } as any;
      const result = findMatchingOffering(clazz, unit, problem);
      expect(result).toBeUndefined();
    });
  });

  describe("findMatchingClassAndOfferingIds", () => {
    it("should find matching class and offering IDs", () => {
      const classes: IPortalClassInfo[] = [
        {
          id: classId,
          class_word: classWord,
          offerings: [{ id: 1, external_url: externalUrl }]
        }
      ] as any;
      const result = findMatchingClassAndOfferingIds(classes, classWord, unit, problem);
      expect(result).toEqual({ matchingClassId: classId, matchingClassWord: classWord, matchingOfferingId: 1 });
    });

    it("should return undefined if no matching class or offering is found", () => {
      const classes: IPortalClassInfo[] = [
        {
          id: 1,
          class_word: "other-class",
          offerings: [{ id: 1, external_url: "https://localhost?unit=other-unit" }]
        }
      ] as any;
      const result = findMatchingClassAndOfferingIds(classes, classWord, unit);
      expect(result).toEqual({ matchingClassId: undefined, matchingOfferingId: undefined });
    });
  });

  describe("startCLUE", () => {
    it("should return the correct authenticated state for starting CLUE", () => {
      const result = startCLUE({ classWord, classId, offeringId, portalInfo, problem});
      expect(result).toEqual({ state: "startingCLUE", classId, classWord, offeringId, portalInfo, problem });
    });
  });

  describe("createPortalOfferingForUnit", () => {
    it("should call createPortalOffering with correct parameters", async () => {
      const result = await createPortalOfferingForUnit(portalInfo, classId, unitJson, problem);
      expect(result).toEqual(offeringId);
    });
  });

  describe("processFinalAuthenticatedState", () => {
    it("should process 'startingCLUE' state correctly", async () => {
      const state: AuthenticatedState = {
        state: "startingCLUE", classWord, classId, offeringId, portalInfo, problem
      };
      const result = await processFinalAuthenticatedState(state);
      expect(result).toEqual(state);
    });

    it("should process 'creatingOffering' state correctly", async () => {
      const state: AuthenticatedState  = {
        state: "creatingOffering",
        classWord,
        classId,
        portalInfo,
        unitJson,
        problem
      };

      const result = await processFinalAuthenticatedState(state);
      expect(result).toEqual({ state: "startingCLUE", classId, classWord, offeringId, portalInfo, problem });
    });
  });

  describe("getFinalAuthenticatedState", () => {
    // In Jest 30/jsdom, window.location is not easily mockable.
    // We use jsdom's reconfigure method exposed by our custom test environment.
    const originalHref = window.location.href;

    const setLocation = (url: string) => {
      (global as any).jsdom.reconfigure({ url });
      reprocessUrlParams();
    };

    afterEach(() => {
      setLocation(originalHref);
    });

    it("should return 'startingCLUE' state if classId, offeringId, and classWord are present", () => {
      // unit must be set in the URL params
      setLocation(externalUrl);

      const state: AuthenticatedState  = {
        state: "loadedClasses",
        classId,
        offeringId,
        classWord,
        classes: [
          {
            id: classId,
            class_word: classWord,
            offerings: [{ id: offeringId, external_url: externalUrl }]
          } as any
        ],
        unitJson,
        portalInfo,
        problem
      };
      const result = getFinalAuthenticatedState(state);
      expect(result).toEqual({ state: "startingCLUE", classId, classWord, offeringId, portalInfo, problem });
    });

    it("should return the original state if conditions are not met", () => {
      const state: AuthenticatedState  = {
        state: "loadedClasses",
        classes: [],
        portalInfo,
        unitJson: { title: "Test Unit" },
        problem: "1.1",
      };
      const result = getFinalAuthenticatedState(state);
      expect(result).toEqual(state);
    });
  });
});
