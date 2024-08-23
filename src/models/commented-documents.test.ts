import fetchMock from "jest-fetch-mock";
import "firebase/firestore";
import { Firestore } from "../lib/firestore";
import { UserModelType } from "./stores/user";
import { CommentedDocumentsQuery } from "./commented-documents";
import { DB } from "../lib/db";


const mockStores = {
  appMode: "authed",
  demo: { name: "demo" },
  user: { portal: "test-portal" }
};

const mockDB = {
  stores: mockStores
} as DB;

const mockDocGet = jest.fn();

const mockDocSet = jest.fn();

const mockDocCollection = jest.fn();

const mockDocObject = {
  get: mockDocGet,
  set: (obj: any) => mockDocSet(obj),
  collection: (path: string) => mockDocCollection(path)
};
mockDocCollection.mockImplementation(() => mockCollectionObject);

const mockDoc = jest.fn((path: string) => mockDocObject);

const mockCollectionGet = jest.fn();

const mockCollectionWhere = jest.fn();

const mockCollectionObject = {
  doc: mockDoc,
  get: mockCollectionGet,
  where: mockCollectionWhere
};
mockCollectionObject.where.mockImplementation(() => mockCollectionObject);

const mockCollection = jest.fn((path: string) => mockCollectionObject);

jest.mock("firebase/app", () => ({
  firestore: () => ({
    collection: mockCollection,
    doc: mockDoc,
    runTransaction: jest.fn(callback => callback())
  })
}));

const user = {
  id: "user-id",
  network: "test-network"
} as UserModelType;

const non_network_user = {
  id: "user-id"
} as UserModelType;

describe("CommentedDocumentsQuery", () => {

  let firestore: Firestore;

  function resetMocks() {
    mockDoc.mockClear();
    mockCollection.mockClear();
    mockDocGet.mockReset();
    mockDocSet.mockClear();
    mockCollectionGet.mockReset();
    mockCollectionWhere.mockClear();
    fetchMock.resetMocks();
  }

  beforeEach(() => {
    firestore = new Firestore(mockDB);
    resetMocks();
  });

  it("should return empty arrays if there are no documents", async () => {
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });

    const query = new CommentedDocumentsQuery(firestore, "unit-1", "problem-1");
    query.setUser(user);

    expect(mockCollectionGet).toHaveBeenCalledTimes(2);
    expect(query.user).toEqual(user);
    expect(query.curriculumDocs).toEqual([]);
    expect(query.userDocs).toEqual([]);
  });

  it("should return empty arrays if there are curriculum documents with no comments", async () => {
    const curriculumDocs = [
      {
        id: "uid:user-id_unit-1_1_1_first",
        data: () => { return {
          uid: "user-id",
          network: "test-network",
          problem: "1.1",
          section: "first",
          unit: "unit-1"
        }; }
      }];
      mockCollectionGet
      .mockResolvedValue({ empty: true, docs: [] })
      .mockResolvedValueOnce({ empty: false, docs: curriculumDocs });
      // next call to get comments will return empty

    const query = new CommentedDocumentsQuery(firestore, "unit-1", "1.1");
    query.setUser(user);

    expect(mockCollectionGet).toHaveBeenCalledTimes(2);
    expect(mockCollectionWhere).toHaveBeenCalledWith("unit", "==", "unit-1");
    expect(mockCollectionWhere).toHaveBeenCalledWith("problem", "==", "1.1");
    expect(mockCollectionWhere).toHaveBeenCalledWith("network", "==", "test-network");

    expect(query.user).toEqual(user);
    expect(query.curriculumDocs).toEqual([]);
    expect(query.userDocs).toEqual([]);
  });

  it("should find curriculum documents with comments for network user", async () => {
    const curriculumDocs = [
    {
      id: "uid:user-id_unit-1_1_1_first",
      data: () => { return {
        uid: "user-id",
        network: "test-network",
        problem: "1.1",
        section: "first",
        unit: "unit-1"
      }; }
    }];

    mockCollectionGet
      .mockResolvedValue({ empty: true, docs: [] })
      .mockResolvedValueOnce({ empty: false, docs: curriculumDocs })
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({ empty: false, size: 2 });

    const query = new CommentedDocumentsQuery(firestore, "unit-1", "1.1");
    await query.setUser(user);

    // 4th query is for classes with teacher's network
    expect(mockCollectionGet).toHaveBeenCalledTimes(4);

    expect(mockCollectionWhere).toHaveBeenCalledWith("unit", "==", "unit-1");
    expect(mockCollectionWhere).toHaveBeenCalledWith("problem", "==", "1.1");
    expect(mockCollectionWhere).toHaveBeenCalledWith("network", "==", "test-network");

    expect(query.curriculumDocs).toEqual([
      {
        id: "uid:user-id_unit-1_1_1_first",
        network: "test-network",
        unit: "unit-1",
        problem: "1.1",
        section: "first",
        title: "Unknown",
        uid: "user-id",
        numComments: 2
      }]);
  });

  it("should find curriculum documents with comments for non-network user", async () => {
    const curriculumDocs = [
    {
      id: "uid:user-id_unit-1_1_1_first",
      data: () => { return {
        uid: "user-id",
        network: null,
        problem: "1.1",
        section: "first",
        unit: "unit-1"
      }; }
    }];

    mockCollectionGet
      .mockResolvedValue({ empty: true, docs: [] })
      .mockResolvedValueOnce({ empty: false, docs: curriculumDocs })
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({ empty: false, size: 2 });

    const query = new CommentedDocumentsQuery(firestore, "unit-1", "1.1");
    await query.setUser(non_network_user);

    expect(mockCollectionGet).toHaveBeenCalledTimes(3);

    expect(mockCollectionWhere).toHaveBeenCalledWith("unit", "==", "unit-1");
    expect(mockCollectionWhere).toHaveBeenCalledWith("problem", "==", "1.1");
    expect(mockCollectionWhere).toHaveBeenCalledWith("uid", "==", "user-id");

    expect(query.curriculumDocs).toEqual([
      {
        id: "uid:user-id_unit-1_1_1_first",
        network: null,
        unit: "unit-1",
        problem: "1.1",
        section: "first",
        title: "Unknown",
        uid: "user-id",
        numComments: 2
      }]);
  });

  it("should return empty arrays if there are user documents with no comments", async () => {
    const classList = [
      { data: () => ({ context_id: "class-1" }) }
    ];

    const userDocs = [
    {
      id: "uid:user-id_unit-1_1_1_first",
      data: () => { return {
        uid: "user-id",
        network: null,
        problem: "1.1",
        section: "first",
        unit: "unit-1"
      }; }
    }];

    mockCollectionGet
      .mockResolvedValue({ empty: true, docs: [] })
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({ empty: false, docs: classList })
      .mockResolvedValueOnce({ empty: false, docs: userDocs });

    const query = new CommentedDocumentsQuery(firestore, "unit-1", "1.1");
    await query.setUser(non_network_user);

    expect(mockCollectionGet).toHaveBeenCalledTimes(4);

    expect(mockCollectionWhere).toHaveBeenCalledWith("teachers", "array-contains", "user-id");
    expect(mockCollectionWhere).toHaveBeenCalledWith("context_id", "in", ["class-1"]);

    expect(query.curriculumDocs).toEqual([]);
    expect(query.userDocs).toEqual([]);
  });

  it("should find user documents with comments for teacher's class", async () => {
    const classList = [
      { data: () => ({ context_id: "class-1" }) }
    ];

    const userDocs = [
    {
      id: "uid:document-id",
      data: () => { return {
        uid: "user-id",
        type: "problem",
        title: "doc-title",
        createdAt: 1712951484070
      }; }
    }];

    mockCollectionGet
      .mockResolvedValue({ empty: true, docs: [] })
      .mockResolvedValueOnce({ empty: true, docs: [] }) // curriculum docs query
      .mockResolvedValueOnce({ empty: false, docs: classList })
      .mockResolvedValueOnce({ empty: false, docs: userDocs })
      .mockResolvedValueOnce({ empty: false, size: 2 });

    const query = new CommentedDocumentsQuery(firestore, "unit-1", "1.1");
    await query.setUser(non_network_user);

    expect(mockCollectionGet).toHaveBeenCalledTimes(4);

    expect(mockCollectionWhere).toHaveBeenCalledWith("teachers", "array-contains", "user-id");
    expect(mockCollectionWhere).toHaveBeenCalledWith("context_id", "in", ["class-1"]);

    expect(query.curriculumDocs).toEqual([]);
    expect(query.userDocs).toEqual([
      {
        id: "uid:document-id",
        uid: "user-id",
        type: "problem",
        title: "doc-title",
        createdAt: 1712951484070,
        numComments: 2
      }
    ]);
  });


});
