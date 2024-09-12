import { DB } from "./db";
import { Firebase } from "./firebase";
import { kClueDevIDKey } from "./root-id";

const mockStores = {
  appMode: "authed",
  demo: { name: "demo" },
  user: { portal: "test-portal" }
};
const mockDB = {
  stores: mockStores
} as DB;

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
      expect(firebase.getRootFolder()).toBe("/authed/test-portal/portals/test-portal/");
    });
    it("should handle the dev appMode", () => {
      window.localStorage.setItem(kClueDevIDKey, "random-id");
      const stores = {...mockStores, appMode: "dev"};
      const firestore = new Firebase({stores} as DB);
      expect(firestore.getRootFolder()).toBe("/dev/random-id/portals/test-portal/");
    });
    describe("should handle the demo appMode", () => {
      it("handles basic demo name", () => {
        const stores = {...mockStores,
          appMode: "demo", demo: { name: "test-demo" }};
        const firestore = new Firebase({stores} as DB);
        expect(firestore.getRootFolder()).toBe("/demo/test-demo/portals/test-portal/");
      });
      it("handles empty demo name", () => {
        const stores = {...mockStores,
          appMode: "demo", demo: { name: "" }};
        const firestore = new Firebase({stores} as DB);
        expect(firestore.getRootFolder()).toBe("/demo/test-portal/portals/test-portal/");
      });
      it("handles empty demo name and empty portal", () => {
        const stores = {...mockStores,
          appMode: "demo", demo: { name: "" }, user: { portal: ""}};
        const firestore = new Firebase({stores} as DB);
        // FIXME
        expect(firestore.getRootFolder()).toBe("/demo/demo/portals//");
      });
    });
  });
});
