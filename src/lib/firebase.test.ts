import { UserModelType } from "src/models/stores/user";
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
  user: { portal: "test-portal" }
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

    it("should throw error for group document missing groupId", () => {
      const mockDocument = {
        type: "group",
        key: "{doc-key}",
        uid: "{user-id}"
      } as unknown as DocumentModelType;
      expect(() => {
        firebase.getDocumentPaths(mockUser, mockDocument);
      }).toThrow("getDocumentPaths: group document missing groupId");
    });

    it("should handle group document", () => {
      const mockDocument = {
        type: "group",
        key: "{doc-key}",
        uid: "{user-id}",
        groupId: "{group-id}"
      } as unknown as DocumentModelType;
      const paths = firebase.getDocumentPaths(mockUser, mockDocument);
      expect(paths).toEqual({
        content: "classes/{test-class}/offerings/{test-offering}/groups/{group-id}/documents/{doc-key}"
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
