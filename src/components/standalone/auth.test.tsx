import nock from "nock";
import { findMatchingOffering, findMatchingClassAndOfferingIds, startCLUE, createPortalOfferingForUnit,
         processFinalAuthenticatedState, getFinalAuthenticatedState,
         AuthenticatedState} from "./auth";
import { IPortalClassInfo } from "../../lib/portal-types";
import { reprocessUrlParams } from "../../utilities/url-params";

describe("Standalone Auth helpers", () => {
  beforeEach(() => {
    nock(/example\.com/)
      .post(/\/api\/v1\/offerings\/create_for_external_activity/)
      .reply(200, {id: 1});
  });

  afterEach(() => nock.cleanAll());

  describe("findMatchingOffering", () => {
    it("should find the correct offering based on unit and domain", () => {
      const clazz: IPortalClassInfo = {
        id: 1,
        class_word: "test-class",
        offerings: [
          { id: 1, external_url: "https://localhost?unit=test-unit" },
          { id: 2, external_url: "https://collaborative-learning.concord.org?unit=other-unit" }
        ]
      } as any;
      const result = findMatchingOffering(clazz, "test-unit");
      expect(result?.id).toBe(1);
    });

    it("should return undefined if no matching offering is found", () => {
      const clazz: IPortalClassInfo = {
        id: 1,
        class_word: "test-class",
        offerings: [
          { id: 1, external_url: "https://localhost?unit=other-unit" }
        ]
      } as any;
      const result = findMatchingOffering(clazz, "test-unit");
      expect(result).toBeUndefined();
    });
  });

  describe("findMatchingClassAndOfferingIds", () => {
    it("should find matching class and offering IDs", () => {
      const classes: IPortalClassInfo[] = [
        {
          id: 1,
          class_word: "test-class",
          offerings: [{ id: 1, external_url: "https://localhost?unit=test-unit" }]
        }
      ] as any;
      const result = findMatchingClassAndOfferingIds(classes, "test-class", "test-unit");
      expect(result).toEqual({ matchingClassId: 1, matchingClassWord: "test-class", matchingOfferingId: 1 });
    });

    it("should return undefined if no matching class or offering is found", () => {
      const classes: IPortalClassInfo[] = [
        {
          id: 1,
          class_word: "other-class",
          offerings: [{ id: 1, external_url: "https://localhost?unit=other-unit" }]
        }
      ] as any;
      const result = findMatchingClassAndOfferingIds(classes, "test-class", "test-unit");
      expect(result).toEqual({ matchingClassId: undefined, matchingOfferingId: undefined });
    });
  });

  describe("startCLUE", () => {
    it("should return the correct authenticated state for starting CLUE", () => {
      const result = startCLUE("test-class");
      expect(result).toEqual({ state: "startingCLUE", classWord: "test-class" });
    });
  });

  describe("createPortalOfferingForUnit", () => {
    it("should call createPortalOffering with correct parameters", async () => {
      const portalInfo = { domain: "https://example.com/", rawPortalJWT: "jwt", teacher: true, student: false };
      const classId = 1;
      const unitJson = { title: "Test Unit" };

      const result = await createPortalOfferingForUnit(portalInfo, classId, unitJson);

      expect(result).toEqual(1);
    });
  });

  describe("processFinalAuthenticatedState", () => {
    it("should process 'startingCLUE' state correctly", async () => {
      const state: AuthenticatedState = { state: "startingCLUE", classWord: "test-class" };
      const result = await processFinalAuthenticatedState(state);
      expect(result).toEqual(state);
    });

    it("should process 'creatingOffering' state correctly", async () => {
      const state: AuthenticatedState  = {
        state: "creatingOffering",
        classWord: "test-class",
        classId: 1,
        portalInfo: { domain: "https://example.com/", rawPortalJWT: "jwt", teacher: true, student: false },
        unitJson: { title: "Test Unit" }
      };

      const result = await processFinalAuthenticatedState(state);
      expect(result).toEqual({ state: "startingCLUE", classWord: "test-class" });
    });
  });

  describe("getFinalAuthenticatedState", () => {
    // functions to mock and reset window.location and url params
    const originalLocation = window.location;
    const mockWindowLocation = (newLocation: Location | URL) => {
      delete (window as any).location;
      (window as any).location = newLocation as Location;
      reprocessUrlParams();
    };
    const setLocation = (url: string) => mockWindowLocation(new URL(url));
    afterEach(() => mockWindowLocation(originalLocation));

    it("should return 'startingCLUE' state if classId, offeringId, and classWord are present", () => {
      // unit must be set in the URL params
      setLocation("https://localhost?unit=test-unit");

      const state: AuthenticatedState  = {
        state: "loadedClasses",
        classId: 1,
        offeringId: 1,
        classWord: "test-class",
        classes: [
          {
            id: 1,
            class_word: "test-class",
            offerings: [{ id: 1, external_url: "https://localhost?unit=test-unit" }]
          } as any
        ],
        unitJson: { title: "Test Unit" },
        portalInfo: { domain: "https://example.com/", rawPortalJWT: "jwt", teacher: true, student: false }
      };
      const result = getFinalAuthenticatedState(state);
      expect(result).toEqual({ state: "startingCLUE", classWord: "test-class" });
    });

    it("should return the original state if conditions are not met", () => {
      const state: AuthenticatedState  = {
        state: "loadedClasses",
        classes: [],
        portalInfo: {
          domain: "https://example.com/",
          rawPortalJWT: "jwt",
          teacher: true,
          student: false
        },
        unitJson: { title: "Test Unit" }
      };
      const result = getFinalAuthenticatedState(state);
      expect(result).toEqual(state);
    });
  });
});
