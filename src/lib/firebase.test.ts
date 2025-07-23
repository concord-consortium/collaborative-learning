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
          expect(mockRef.set).toHaveBeenCalledTimes(2); // lastEditedAt and timestamp + aiPrompt
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
      expect(mockRef.set).toHaveBeenCalledTimes(2); // lastEditedAt and timestamp
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
          expect(mockRef.set).toHaveBeenCalledTimes(2); // lastEditedAt and timestamp
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
