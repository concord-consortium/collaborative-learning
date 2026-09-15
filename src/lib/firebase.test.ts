import { GroupDocument } from "../models/document/document-types";
import { UserModelType } from "../models/stores/user";
import { DocumentModelType } from "../models/document/document";
import { DB } from "./db";
import { Firebase } from "./firebase";

jest.mock("firebase/app", () => {
  const refMock = jest.fn(() => ({ set: jest.fn().mockResolvedValue(undefined) }));
  const databaseFn = () => ({
    ref: refMock
  });
  databaseFn.ServerValue = { TIMESTAMP: "server-timestamp" };
  return {
    __esModule: true,
    default: {
      database: databaseFn,
      storage: () => ({ ref: jest.fn() })
    }
  };
});

const mockStores = {
  appConfig: { aiEvaluation: undefined, aiPrompt: undefined },
  appMode: "authed" as const,
  demo: { name: "demo" },
  user: { portal: "test-portal", offeringId: "test-offering" },
  unit: { code: "vibe" },
  investigation: { ordinal: 1 },
  problem: { ordinal: 2 },
  commentTags: { customTagRecord: {} }
};
const mockDB = {
  stores: mockStores
} as unknown as DB;

describe("Firebase class", () => {
  describe("initialization", () => {
    it("should create a valid Firebase object", () => {
      const firebase = new Firebase(mockDB);
      expect(firebase).toBeDefined();
    });
  });
  describe("getRootFolder", () => {
    it("should handle authed mode", () => {
      const firebase = new Firebase(mockDB);
      expect(firebase.getRootFolder()).toBe("/authed/portals/test-portal/");
    });
    describe("should handle the demo appMode", () => {
      it("handles basic demo name", () => {
        const stores = {...mockStores,
          appMode: "demo", demo: { name: "test-demo" }};
        const firebase = new Firebase({stores} as DB);
        expect(firebase.getRootFolder()).toBe("/demo/test-demo/portals/test-portal/");
      });
      it("handles empty demo name", () => {
        const stores = {...mockStores,
          appMode: "demo", demo: { name: "" }};
        const firebase = new Firebase({stores} as DB);
        expect(firebase.getRootFolder()).toBe("/demo/test-portal/portals/test-portal/");
      });
      it("handles empty demo name and empty portal", () => {
        const stores = {...mockStores,
          appMode: "demo", demo: { name: "" }, user: { portal: ""}};
        const firebase = new Firebase({stores} as DB);
        expect(firebase.getRootFolder()).toBe("/demo/demo/portals//");
      });
    });
  });

  describe("getDocumentPaths", () => {
    const firebase = new Firebase(mockDB);
    const mockUser = {
      id: "{user-id}",
      portal: "{test-portal}",
      classHash: "{test-class}",
      offeringId: "{test-offering}"
    } as unknown as UserModelType;

    it("should handle personal document", () => {
      const mockDocument = {
        type: "personal",
        key: "{doc-key}",
        uid: "{user-id}"
      } as unknown as DocumentModelType;
      const paths = firebase.getDocumentPaths(mockUser, mockDocument);
      expect(paths).toEqual({
        content: "classes/{test-class}/users/{user-id}/documents/{doc-key}",
        metadata: "classes/{test-class}/users/{user-id}/documentMetadata/{doc-key}",
        typedMetadata: "classes/{test-class}/users/{user-id}/personalDocs/{doc-key}"
      });
    });

    // When the document is from another user the computed path for the typedMetadata
    // is not correct. This is probably a bug, but it isn't clear yet.
    it.failing("should handle personal documents from other users", () => {
      const mockDocument = {
        type: "personal",
        key: "{doc-key}",
        uid: "{other-user-id}"
      } as unknown as DocumentModelType;
      const paths = firebase.getDocumentPaths(mockUser, mockDocument);
      expect(paths).toEqual({
        content: "classes/{test-class}/users/{other-user-id}/documents/{doc-key}",
        metadata: "classes/{test-class}/users/{other-user-id}/documentMetadata/{doc-key}",
        typedMetadata: "classes/{test-class}/users/{other-user-id}/personalDocs/{doc-key}"
      });
    });

    it("should handle a learning log document", () => {
      const mockDocument = {
        type: "learningLog",
        key: "{doc-key}",
        uid: "{user-id}"
      } as unknown as DocumentModelType;
      const paths = firebase.getDocumentPaths(mockUser, mockDocument);
      expect(paths).toEqual({
        content: "classes/{test-class}/users/{user-id}/documents/{doc-key}",
        metadata: "classes/{test-class}/users/{user-id}/documentMetadata/{doc-key}",
        typedMetadata: "classes/{test-class}/users/{user-id}/learningLogs/{doc-key}"
      });
    });

    // When the document is from another user the computed path for the typedMetadata
    // is not correct. This is probably a bug, but it isn't clear yet.
    it.failing("should handle learning log documents from other users", () => {
      const mockDocument = {
        type: "learningLog",
        key: "{doc-key}",
        uid: "{other-user-id}"
      } as unknown as DocumentModelType;
      const paths = firebase.getDocumentPaths(mockUser, mockDocument);
      expect(paths).toEqual({
        content: "classes/{test-class}/users/{other-user-id}/documents/{doc-key}",
        metadata: "classes/{test-class}/users/{other-user-id}/documentMetadata/{doc-key}",
        typedMetadata: "classes/{test-class}/users/{other-user-id}/learningLogs/{doc-key}"
      });
    });

    it("should handle problem document", () => {
      const mockDocument = {
        type: "problem",
        key: "{doc-key}",
        uid: "{user-id}"
      } as unknown as DocumentModelType;
      const paths = firebase.getDocumentPaths(mockUser, mockDocument);
      expect(paths).toEqual({
        content: "classes/{test-class}/users/{user-id}/documents/{doc-key}",
        metadata: "classes/{test-class}/users/{user-id}/documentMetadata/{doc-key}",
        typedMetadata: "classes/{test-class}/offerings/{test-offering}/users/{user-id}/documents/{doc-key}"
      });
    });

    it("should handle problem documents from other users", () => {
      const mockDocument = {
        type: "problem",
        key: "{doc-key}",
        uid: "{other-user-id}"
      } as unknown as DocumentModelType;
      const paths = firebase.getDocumentPaths(mockUser, mockDocument);
      expect(paths).toEqual({
        content: "classes/{test-class}/users/{other-user-id}/documents/{doc-key}",
        metadata: "classes/{test-class}/users/{other-user-id}/documentMetadata/{doc-key}",
        typedMetadata: "classes/{test-class}/offerings/{test-offering}/users/{other-user-id}/documents/{doc-key}"
      });
    });

    it("should handle planning document", () => {
      const mockDocument = {
        type: "planning",
        key: "{doc-key}",
        uid: "{user-id}"
      } as unknown as DocumentModelType;
      const paths = firebase.getDocumentPaths(mockUser, mockDocument);
      expect(paths).toEqual({
        content: "classes/{test-class}/users/{user-id}/documents/{doc-key}",
        metadata: "classes/{test-class}/users/{user-id}/documentMetadata/{doc-key}",
        typedMetadata: "classes/{test-class}/offerings/{test-offering}/users/{user-id}/planning/{doc-key}"
      });
    });

    it("should handle planning documents from other users", () => {
      const mockDocument = {
        type: "planning",
        key: "{doc-key}",
        uid: "{other-user-id}"
      } as unknown as DocumentModelType;
      const paths = firebase.getDocumentPaths(mockUser, mockDocument);
      expect(paths).toEqual({
        content: "classes/{test-class}/users/{other-user-id}/documents/{doc-key}",
        metadata: "classes/{test-class}/users/{other-user-id}/documentMetadata/{doc-key}",
        typedMetadata: "classes/{test-class}/offerings/{test-offering}/users/{other-user-id}/planning/{doc-key}"
      });
    });

    it("should handle published problem documents", () => {
      const mockDocument = {
        type: "publication",
        key: "{doc-key}",
        uid: "{user-id}"
      } as unknown as DocumentModelType;
      const paths = firebase.getDocumentPaths(mockUser, mockDocument);
      expect(paths).toEqual({
        content: "classes/{test-class}/users/{user-id}/documents/{doc-key}",
        metadata: "classes/{test-class}/users/{user-id}/documentMetadata/{doc-key}",
        typedMetadata: "classes/{test-class}/offerings/{test-offering}/publications/{doc-key}"
      });
    });

    it("should handle published problem documents from other users", () => {
      const mockDocument = {
        type: "publication",
        key: "{doc-key}",
        uid: "{other-user-id}"
      } as unknown as DocumentModelType;
      const paths = firebase.getDocumentPaths(mockUser, mockDocument);
      expect(paths).toEqual({
        content: "classes/{test-class}/users/{other-user-id}/documents/{doc-key}",
        metadata: "classes/{test-class}/users/{other-user-id}/documentMetadata/{doc-key}",
        typedMetadata: "classes/{test-class}/offerings/{test-offering}/publications/{doc-key}"
      });
    });

    it("should handle group document", () => {
      const mockDocument = {
        type: GroupDocument,
        key: "{doc-key}",
        uid: "group_{offering-id}_{group-id}",
        groupId: "{group-id}"
      } as unknown as DocumentModelType;
      const paths = firebase.getDocumentPaths(mockUser, mockDocument);
      expect(paths).toEqual({
        content: "classes/{test-class}/users/group_{offering-id}_{group-id}/documents/{doc-key}",
        metadata: "classes/{test-class}/users/group_{offering-id}_{group-id}/documentMetadata/{doc-key}",
        typedMetadata: ""
      });
    });

  });

  describe("setLastEditedNow", () => {
    const mockUser = {
      id: "test-user",
      classHash: "test-class",
      portal: "test-portal",
      offeringId: "test-offering",
      authenticated: false,
      type: "student" as const,
      name: "Test User",
      className: "",
      latestGroupId: undefined,
      currentGroupId: undefined,
      network: undefined,
      networks: [],
      loggingRemoteEndpoint: undefined,
      portalClassOfferings: [],
      demoClassHashes: [],
      lastSupportViewTimestamp: undefined,
      lastStickyNoteViewTimestamp: undefined
    };
    const mockDocumentKey = "test-document";
    const mockUserId = "test-user-id";
    const expectedContext = { unit: "vibe", investigation: "1", problem: "2", offeringId: "test-offering" };

    it("should handle custom evaluation with aiPrompt", async () => {
      const storesWithCustomEvaluation = {
        ...mockStores,
        appConfig: { aiEvaluation: "custom", aiPrompt: "test prompt" }
      };
      const firebaseWithCustom = new Firebase({ stores: storesWithCustomEvaluation } as unknown as DB);
      const mockRef = { set: jest.fn().mockResolvedValue(undefined) };
      jest.spyOn(firebaseWithCustom, 'ref').mockReturnValue(mockRef as any);

      return firebaseWithCustom.setLastEditedNow(mockUser as any, mockDocumentKey, mockUserId)
        .then(() => {
          expect(mockRef.set).toHaveBeenCalledTimes(2); // lastEditedAt + evaluation
          expect(mockRef.set).toHaveBeenCalledWith({
            aiPrompt: "test prompt",
            context: expectedContext,
            timestamp: "server-timestamp"
          });
        });
    });

    it("merges teacher-added custom tag ids into aiPrompt.categories", async () => {
      const storesWithCustomTags = {
        ...mockStores,
        appConfig: { aiEvaluation: "custom", aiPrompt: { categories: ["a"] } },
        commentTags: { customTagRecord: { "custom-1": "Custom One" } }
      };
      const firebaseWithCustom = new Firebase({ stores: storesWithCustomTags } as unknown as DB);
      const mockRef = { set: jest.fn().mockResolvedValue(undefined) };
      jest.spyOn(firebaseWithCustom, 'ref').mockReturnValue(mockRef as any);

      return firebaseWithCustom.setLastEditedNow(mockUser as any, mockDocumentKey, mockUserId)
        .then(() => {
          expect(mockRef.set).toHaveBeenCalledWith({
            aiPrompt: { categories: ["a", "custom-1"] },
            context: expectedContext,
            timestamp: "server-timestamp"
          });
        });
    });

    it("should handle custom evaluation without aiPrompt", async () => {
      const storesWithCustomEvaluation = {
        ...mockStores,
        appConfig: { aiEvaluation: "custom", aiPrompt: undefined }
      };
      const firebaseWithCustom = new Firebase({ stores: storesWithCustomEvaluation } as unknown as DB);
      const mockRef = { set: jest.fn().mockResolvedValue(undefined) };
      jest.spyOn(firebaseWithCustom, 'ref').mockReturnValue(mockRef as any);

      await firebaseWithCustom.setLastEditedNow(mockUser as any, mockDocumentKey, mockUserId);
      expect(mockRef.set).toHaveBeenCalledTimes(1); // only lastEditedAt
    });

    it("should handle non-custom evaluation", () => {
      const storesWithNonCustomEvaluation = {
        ...mockStores,
        appConfig: { aiEvaluation: "standard", aiPrompt: undefined }
      };
      const firebaseWithNonCustom = new Firebase({ stores: storesWithNonCustomEvaluation } as unknown as DB);
      const mockRef = { set: jest.fn().mockResolvedValue(undefined) };
      jest.spyOn(firebaseWithNonCustom, 'ref').mockReturnValue(mockRef as any);

      return firebaseWithNonCustom.setLastEditedNow(mockUser as any, mockDocumentKey, mockUserId)
        .then(() => {
          expect(mockRef.set).toHaveBeenCalledTimes(2); // lastEditedAt + evaluation
          expect(mockRef.set).toHaveBeenCalledWith({
            context: expectedContext,
            timestamp: "server-timestamp"
          });
        });
    });

    // The placeholders would pass every check downstream and file the document under a problem
    // that does not exist, so no context is sent at all. The problem here resolves, so only the
    // unit is a placeholder and only the unit check can hold this test up.
    it("sends no context while the unit is the placeholder", () => {
      const storesBeforeTheUnitLoads = {
        ...mockStores,
        appConfig: { aiEvaluation: "standard", aiPrompt: undefined },
        unit: { code: "NULL" }
      };
      const firebaseBeforeLoad = new Firebase({ stores: storesBeforeTheUnitLoads } as unknown as DB);
      const mockRef = { set: jest.fn().mockResolvedValue(undefined) };
      jest.spyOn(firebaseBeforeLoad, 'ref').mockReturnValue(mockRef as any);

      return firebaseBeforeLoad.setLastEditedNow(mockUser as any, mockDocumentKey, mockUserId)
        .then(() => {
          expect(mockRef.set).toHaveBeenCalledWith({ timestamp: "server-timestamp" });
        });
    });

    it("sends no context when the problem did not resolve", () => {
      // A real unit with an unresolved problem: a stale offering, or a mistyped problem parameter.
      const storesWithNoProblem = {
        ...mockStores,
        appConfig: { aiEvaluation: "standard", aiPrompt: undefined },
        problem: { ordinal: 0 }
      };
      const firebaseWithNoProblem = new Firebase({ stores: storesWithNoProblem } as unknown as DB);
      const mockRef = { set: jest.fn().mockResolvedValue(undefined) };
      jest.spyOn(firebaseWithNoProblem, 'ref').mockReturnValue(mockRef as any);

      return firebaseWithNoProblem.setLastEditedNow(mockUser as any, mockDocumentKey, mockUserId)
        .then(() => {
          expect(mockRef.set).toHaveBeenCalledWith({ timestamp: "server-timestamp" });
        });
    });

    // Zero is a real investigation: vibe's first holds problems 0.1 and 0.2.
    it("sends the context for an investigation numbered zero", () => {
      const storesInInvestigationZero = {
        ...mockStores,
        appConfig: { aiEvaluation: "standard", aiPrompt: undefined },
        investigation: { ordinal: 0 },
        problem: { ordinal: 1 }
      };
      const firebaseInInvestigationZero = new Firebase({ stores: storesInInvestigationZero } as unknown as DB);
      const mockRef = { set: jest.fn().mockResolvedValue(undefined) };
      jest.spyOn(firebaseInInvestigationZero, 'ref').mockReturnValue(mockRef as any);

      return firebaseInInvestigationZero.setLastEditedNow(mockUser as any, mockDocumentKey, mockUserId)
        .then(() => {
          expect(mockRef.set).toHaveBeenCalledWith({
            context: { ...expectedContext, investigation: "0", problem: "1" },
            timestamp: "server-timestamp"
          });
        });
    });

    // The disconnect handler registers its value when the document opens, so what it carries is
    // decided here rather than when the connection drops.
    it("registers a disconnect write that carries the context", () => {
      const storesWithEvaluation = {
        ...mockStores,
        appConfig: { aiEvaluation: "standard", aiPrompt: undefined }
      };
      const firebaseWithEvaluation = new Firebase({ stores: storesWithEvaluation } as unknown as DB);
      const onDisconnectSet = jest.fn().mockResolvedValue(undefined);
      const mockRef = {
        set: jest.fn().mockResolvedValue(undefined),
        onDisconnect: () => ({ set: onDisconnectSet, cancel: jest.fn() })
      };
      jest.spyOn(firebaseWithEvaluation, 'ref').mockReturnValue(mockRef as any);

      firebaseWithEvaluation.setLastEditedOnDisconnect(mockUser as any, mockDocumentKey, mockUserId);

      expect(onDisconnectSet).toHaveBeenCalledWith({
        context: expectedContext,
        timestamp: "server-timestamp"
      });
    });

    it("writes an empty offeringId outside a portal offering", () => {
      // Firebase rejects undefined, and the function keeps a context whose offeringId is "".
      const storesOutsideAnOffering = {
        ...mockStores,
        appConfig: { aiEvaluation: "standard", aiPrompt: undefined },
        user: { ...mockStores.user, offeringId: "" }
      };
      const firebaseOutside = new Firebase({ stores: storesOutsideAnOffering } as unknown as DB);
      const mockRef = { set: jest.fn().mockResolvedValue(undefined) };
      jest.spyOn(firebaseOutside, 'ref').mockReturnValue(mockRef as any);

      return firebaseOutside.setLastEditedNow(mockUser as any, mockDocumentKey, mockUserId)
        .then(() => {
          expect(mockRef.set).toHaveBeenCalledWith({
            context: { ...expectedContext, offeringId: "" },
            timestamp: "server-timestamp"
          });
        });
    });

    it("should handle no evaluation configured", () => {
      const storesWithNoEvaluation = {
        ...mockStores,
        appConfig: { aiEvaluation: undefined, aiPrompt: undefined }
      };
      const firebaseWithNoEvaluation = new Firebase({ stores: storesWithNoEvaluation } as unknown as DB);
      const mockRef = { set: jest.fn().mockResolvedValue(undefined) };
      jest.spyOn(firebaseWithNoEvaluation, 'ref').mockReturnValue(mockRef as any);

      return firebaseWithNoEvaluation.setLastEditedNow(mockUser as any, mockDocumentKey, mockUserId)
        .then(() => {
          expect(mockRef.set).toHaveBeenCalledTimes(1); // only lastEditedAt
        });
    });
  });
});
