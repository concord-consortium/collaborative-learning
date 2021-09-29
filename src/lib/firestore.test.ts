import { DB } from "./db";
import { Firestore } from "./firestore";

var mockStores = {
  appMode: "authed",
  demo: { name: "demo" },
  user: { portal: "test-portal" }
};
var mockDB = {
  stores: mockStores
} as DB;
var mockDocGet = jest.fn();
var mockDocSet = jest.fn();
var mockDoc = jest.fn((path: string) => ({
      get: mockDocGet,
      set: (obj: any) => mockDocSet(obj)
    }));
var mockCollection = jest.fn(() => ({ doc: mockDoc }));
jest.mock("firebase/app", () => ({
  firestore: () => ({
    collection: mockCollection,
    doc: mockDoc
  })
}));

// permissions error is returned for document not found due to security rules
class MockFirestorePermissionsError extends Error {
  code: string;

  constructor() {
    super("Permission denied");
    this.code = "permission-denied";
  }
}

// class MockFirestoreOtherError extends Error {
//   code: string;

//   constructor() {
//     super("Some other error");
//     this.code = "other-error";
//   }
// }

describe("Firestore class", () => {

  function resetMocks() {
    mockDocGet.mockReset();
    mockDocSet.mockReset();
    mockDoc.mockClear();
    mockCollection.mockClear();
  }

  describe("initialization", () => {
    beforeEach(() => resetMocks());
    it("should create a valid Firestore object", () => {
      const firestore = new Firestore(mockDB);
      expect(firestore).toBeDefined();
      expect(firestore.getRootFolder()).toBe("/authed/test-portal/");
    });
  });

  describe("setFirebaseUser", () => {
    beforeEach(() => resetMocks());
    it("should update user information", () => {
      const firestore = new Firestore(mockDB);
      expect(firestore.userId).toBe("no-user-id");
      expect(firestore.isConnected).toBe(false);
      firestore.setFirebaseUser({ uid: "user-1"} as any);
      expect(firestore.userId).toBe("user-1");
      expect(firestore.isConnected).toBe(true);
    });
  });

  describe("collectionRef", () => {
    beforeEach(() => resetMocks());
    it("should call the `collection()` method with an appropriate path", () => {
      const firestore = new Firestore(mockDB);
      firestore.collectionRef("/full/path");
      expect(mockCollection).toHaveBeenCalledWith("/full/path");
    });
  });

  describe("documentRef", () => {
    beforeEach(() => resetMocks());
    it("should call the `collection()` or `doc()` methods with an appropriate path", () => {
      const firestore = new Firestore(mockDB);
      firestore.documentRef("/full/path");
      expect(mockDoc).toHaveBeenCalledWith("/full/path");
      firestore.documentRef("/full/path", "doc-id");
      expect(mockCollection).toHaveBeenCalledWith("/full/path");
      expect(mockDoc).toHaveBeenLastCalledWith("doc-id");
    });
  });

  describe("collection", () => {
    beforeEach(() => resetMocks());
    it("should call the `collection()` method with an appropriate path", () => {
      const firestore = new Firestore(mockDB);
      firestore.collection("partial/path");
      expect(mockCollection).toHaveBeenCalledWith("/authed/test-portal/partial/path");
    });
  });

  describe("doc", () => {
    beforeEach(() => resetMocks());
    it("should call the `doc()` method with an appropriate path", () => {
      const firestore = new Firestore(mockDB);
      firestore.doc("partial/path");
      expect(mockDoc).toHaveBeenCalledWith("/authed/test-portal/partial/path");
    });
  });

  describe("newDocumentRef", () => {
    beforeEach(() => resetMocks());
    it("should call the `collection()` method with an appropriate path", () => {
      const firestore = new Firestore(mockDB);
      firestore.newDocumentRef("/full/path");
      expect(mockCollection).toHaveBeenCalledWith("/full/path");
      expect(mockDoc).toHaveBeenCalled();
    });
  });

  describe("getDocument", () => {
    beforeEach(() => resetMocks());
    it("should call the `collection()` and `doc()` methods with an appropriate path", () => {
      const firestore = new Firestore(mockDB);
      firestore.getDocument("/full/path", "doc-id");
      expect(mockCollection).toHaveBeenCalledWith("/full/path");
      expect(mockDoc).toHaveBeenLastCalledWith("doc-id");
      expect(mockDocGet).toHaveBeenCalled();
    });
  });

  interface Foo { foo: string }
  describe("guaranteeDocument", () => {
    beforeEach(() => resetMocks());

    it("should `get()` the document if it exists", async () => {
      const content = { foo: "bar" };
      mockDocGet.mockImplementation(() => ({ data: () => Promise.resolve(content) }));
      const firestore = new Firestore(mockDB);
      const result = await firestore.guaranteeDocument<Foo>("partial/path", () => Promise.resolve(content));
      expect(mockDocGet).toHaveBeenCalled();
      expect(result).toEqual(content);
      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it("should create the document if it doesn't exist", async () => {
      const content = { foo: "bar" };
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      const firestore = new Firestore(mockDB);
      await firestore.guaranteeDocument<Foo>("partial/path", () => Promise.resolve(content));
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).toHaveBeenCalledWith(content);
    });

    it("should update the document if requested", async () => {
      const content = { foo: "bar" };
      mockDocGet.mockImplementation(() => ({ data: () => Promise.resolve(content) }));
      const firestore = new Firestore(mockDB);
      await firestore.guaranteeDocument<Foo>("partial/path", () => Promise.resolve(content), () => true);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).toHaveBeenCalledWith(content);
    });

  });

  describe("getFirestoreUser", () => {
    beforeEach(() => resetMocks());
    it("should call the `doc()` and `get()` methods with an appropriate path", () => {
      const firestore = new Firestore(mockDB);
      firestore.getFirestoreUser("user-1");
      expect(mockDoc).toHaveBeenCalledWith(`/authed/test-portal/users/user-1`);
      expect(mockDocGet).toHaveBeenCalled();
    });
  });

});
