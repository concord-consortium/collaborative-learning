import fetchMock from "jest-fetch-mock";
import "firebase/firestore";
import { Firestore } from "./firestore";
import { ClassDocument, OfferingDocument } from "./firestore-schema";
import { IPortalClassInfo, IPortalClassUser } from "./portal-types";
import { UserModel, UserModelType, UserPortalOffering } from "../models/stores/user";
import {
  ClassWithoutTeachers, clearTeachersPromises, getNetworkClassesThatAssignedProblem, getProblemPath,
  OfferingWithoutTeachers, syncClass, syncOffering, syncTeacherClassesAndOfferings
} from "./teacher-network";
import { DB } from "./db";
import { ClassModel, ClassModelType } from "../models/stores/class";

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
const mockDoc = jest.fn((path: string) => ({
      get: mockDocGet,
      set: (obj: any) => mockDocSet(obj)
    }));
const mockCollectionGet = jest.fn();
const mockCollectionWhere = jest.fn();
const mockCollection = jest.fn((path: string) => {
  const mockObject = { doc: mockDoc, get: mockCollectionGet, where: mockCollectionWhere };
  mockObject.where.mockImplementation(() => mockObject);
  return mockObject;
});
jest.mock("firebase/app", () => ({
  firestore: () => ({
    collection: mockCollection,
    doc: mockDoc,
    runTransaction: jest.fn(callback => callback())
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

class MockFirestoreOtherError extends Error {
  code: string;

  constructor() {
    super("Some other error");
    this.code = "other-error";
  }
}

const kPortalJWT = "JWT";
const kTeacher1IdNumeric = 11;
const kTeacher1Id = `${kTeacher1IdNumeric}`;
const kTeacher1FirstName = "Teacher";
const kTeacher1LastName = "1";
const kTeacher1Initials = "T1";
const kTeacher1Name = kTeacher1FirstName + " " + kTeacher1LastName;
const kTeacher1User: IPortalClassUser = {
        id: "https://concord.org/users/11", user_id: kTeacher1IdNumeric, first_name: "Teacher", last_name: "1"
      };
const kTeacherUserModel = UserModel.create({
  type: "teacher", name: kTeacher1Name, id: kTeacher1Id
});

const kClass1IdNumeric = 1;
const kClass1Id = `${kClass1IdNumeric}`;
const kClass1Url = `https://concord.org/classes/${kClass1Id}`;
const kClass1Name = "Class 1";
const kClass1Hash = "class-hash-1";
const portalClass1: IPortalClassInfo = {
  id: kClass1IdNumeric,
  uri: kClass1Url,
  name: kClass1Name,
  class_hash: kClass1Hash,
  class_word: "class-word-1",
  teachers: [kTeacher1User],
  students: [],
  offerings: []
};
const portalClass1Model: ClassModelType = ClassModel.create({
  name: kClass1Name,
  classHash: kClass1Hash,
  users: {
    t1: { type: "teacher", id: kTeacher1Id, firstName: kTeacher1FirstName, lastName: kTeacher1LastName,
      fullName: kTeacher1Name, initials: kTeacher1Initials }
  }
});

const partClass1: ClassWithoutTeachers = {
        id: kClass1Id,
        name: kClass1Name,
        uri: kClass1Url,
        context_id: kClass1Hash,
        teacher: "Teacher 1",
        network: "test-network"
      };
const fsClass1: ClassDocument = { ...partClass1, teachers: [kTeacher1Id] };

const kOffering1IdNumeric = 101;
const kOffering1Id = `${kOffering1IdNumeric}`;
const kOffering1Url = `https://concord.org/offerings/${kOffering1Id}`;
const kOffering1Name = "Offering 101";
const kOffering1Unit = "msa";
const kOffering1Problem = "1.1";
const kOffering2IdNumeric = 102;
const kOffering2Id = `${kOffering2IdNumeric}`;
const kOffering2Url = `https://concord.org/offerings/${kOffering2Id}`;
const kOffering2Name = "Offering 102";
const kOffering2Unit = "msa";
const kOffering2Problem = "1.2";
const userOffering1 = () => UserPortalOffering.create({
        classId: kClass1Id,
        classHash: kClass1Hash,
        className: kClass1Name,
        classUrl: kClass1Url,
        teacher: kTeacher1Name,
        activityTitle: kOffering1Name,
        activityUrl: kOffering1Url,
        problemOrdinal: kOffering1Problem,
        unitCode: kOffering1Unit,
        offeringId: kOffering1Id
      });
const userOffering2 = () => UserPortalOffering.create({
        classId: kClass1Id,
        classHash: kClass1Hash,
        className: kClass1Name,
        classUrl: kClass1Url,
        teacher: kTeacher1Name,
        activityTitle: kOffering2Name,
        activityUrl: kOffering2Url,
        problemOrdinal: kOffering2Problem,
        unitCode: kOffering2Unit,
        offeringId: kOffering2Id
      });
const partOffering1: OfferingWithoutTeachers = {
        id: kOffering1Id,
        name: kOffering1Name,
        uri: kOffering1Url,
        context_id: kClass1Hash,
        unit: kOffering1Unit,
        problem: kOffering1Problem,
        problemPath: getProblemPath(kOffering1Unit, kOffering1Problem),
        network: "test-network"
      };
const fsOffering1: OfferingDocument = { ...partOffering1, teachers: [kTeacher1Id] };

describe("Teacher network functions", () => {

  function resetMocks() {
    mockDoc.mockClear();
    mockCollection.mockClear();
    mockDocGet.mockReset();
    mockDocSet.mockClear();
    mockCollectionGet.mockReset();
    mockCollectionWhere.mockClear();
    fetchMock.resetMocks();
    clearTeachersPromises();
  }

  describe("getProblemPath", () => {
    it("should convert problem paths", () => {
      expect(getProblemPath("sas", "1.2")).toBe("sas/1/2");
    });
  });

  describe("syncClass", () => {
    beforeEach(() => {
      resetMocks();
    });

    const oldClassDocPath = `/authed/test-portal/classes/test-network_${kClass1Hash}`;
    const newClassDocPath = `/authed/test-portal/classes/${kClass1Hash}`;

    it("should do nothing if the class already exists", async () => {
      mockDocGet.mockImplementation(() => Promise.resolve({
        exists: true,
        data: () => fsClass1}));
      fetchMock.mockResponseOnce(JSON.stringify(portalClass1));
      const firestore = new Firestore(mockDB);
      const result = await syncClass(firestore, kPortalJWT, partClass1, kTeacherUserModel);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(mockDoc).toHaveBeenCalledTimes(2);
      expect(mockDoc).toHaveBeenCalledWith(oldClassDocPath);
      expect(mockDoc).toHaveBeenCalledWith(newClassDocPath);
      expect(mockDocGet).toHaveBeenCalledTimes(2);
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should do nothing if the portal class api call response is not ok", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      // !ok response from fetch
      fetchMock.mockResponseOnce('{}', { status: 500, headers: { 'content-type': 'application/json' } });
      const firestore = new Firestore(mockDB);
      const result = await syncClass(firestore, kPortalJWT, partClass1, kTeacherUserModel);
      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockDocGet).not.toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should do nothing if the portal class api call fails", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      fetchMock.mockRejectOnce(new Error());
      const firestore = new Firestore(mockDB);
      const result = await syncClass(firestore, kPortalJWT, partClass1, kTeacherUserModel);
      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockDocGet).not.toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should do nothing if an unexpected firestore error occurs", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestoreOtherError(); });
      fetchMock.mockResponseOnce(JSON.stringify(portalClass1));
      const firestore = new Firestore(mockDB);
      const result = await syncClass(firestore, kPortalJWT, partClass1, kTeacherUserModel);
      expect(mockDoc).toHaveBeenCalledWith(oldClassDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should write class to firestore if it's not already there", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      fetchMock.mockResponseOnce(JSON.stringify(portalClass1));
      const firestore = new Firestore(mockDB);
      const result = await syncClass(firestore, kPortalJWT, partClass1, kTeacherUserModel);
      expect(mockDoc).toHaveBeenCalledWith(oldClassDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).toHaveBeenCalledWith(fsClass1);
      return result;
    });
  });


  describe("syncOffering", () => {
    beforeEach(() => {
      resetMocks();
    });

    const offeringDocPath = `/authed/test-portal/offerings/test-network_${kOffering1Id}`;

    it("should do nothing if the offering already exists", async () => {
      mockDocGet.mockImplementation(() => Promise.resolve(fsOffering1));
      const firestore = new Firestore(mockDB);
      const result = await syncOffering(firestore, kPortalJWT, kClass1Url, partOffering1);
      expect(mockDoc).toHaveBeenCalledWith(offeringDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should do nothing if the portal class api call response is not ok", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      // !ok response from fetch
      fetchMock.mockResponseOnce('{}', { status: 500, headers: { 'content-type': 'application/json' } });
      const firestore = new Firestore(mockDB);
      const result = await syncOffering(firestore, kPortalJWT, kClass1Url, partOffering1);
      expect(mockDoc).toHaveBeenCalledWith(offeringDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should do nothing if the portal class api call fails", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      fetchMock.mockRejectOnce(new Error());
      const firestore = new Firestore(mockDB);
      const result = await syncOffering(firestore, kPortalJWT, kClass1Url, partOffering1);
      expect(mockDoc).toHaveBeenCalledWith(offeringDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should do nothing if an unexpected firestore error occurs", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestoreOtherError(); });
      fetchMock.mockResponseOnce(JSON.stringify(portalClass1));
      const firestore = new Firestore(mockDB);
      const result = await syncOffering(firestore, kPortalJWT, kClass1Url, partOffering1);
      expect(mockDoc).toHaveBeenCalledWith(offeringDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should write class to firestore if it's not already there", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      fetchMock.mockResponseOnce(JSON.stringify(portalClass1));
      const firestore = new Firestore(mockDB);
      const result = await syncOffering(firestore, kPortalJWT, kClass1Url, partOffering1);
      expect(mockDoc).toHaveBeenCalledWith(offeringDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).toHaveBeenCalledWith(fsOffering1);
      return result;
    });
  });

  describe("syncTeacherClassesAndOfferings", () => {
    beforeEach(() => {
      resetMocks();
    });

    const completeTeacher = UserModel.create({ id: kTeacher1Id, type: "teacher", network: "test-network",
                                                portalClassOfferings: [userOffering1(), userOffering2()] });

    it("should do nothing if the user is not a teacher", () => {
      // If this tried to do something it would fail due to the bogus arguments
      syncTeacherClassesAndOfferings(
        undefined as unknown as Firestore,
        {isTeacher: false, network: null} as unknown as UserModelType,
        undefined as unknown as ClassModelType
      );
    });

    it("should sync demo class if there is no portal JWT", async () => {
      const user = UserModel.create({ id: kTeacher1Id, type: "teacher", network: "test-network" });
      const firestore = new Firestore(mockDB);
      await syncTeacherClassesAndOfferings(firestore, user, portalClass1Model, "");
      expect(mockDoc).toHaveBeenCalledTimes(2);
      expect(mockDoc).toHaveBeenCalledWith(`/authed/test-portal/classes/test-network_${kClass1Hash}`);
      expect(mockDoc).toHaveBeenCalledWith(`/authed/test-portal/classes/${kClass1Hash}`);
      expect(mockDocGet).toHaveBeenCalledTimes(2);
      expect(mockDocSet).toHaveBeenCalledTimes(2);
      expect(mockDocSet).toHaveBeenCalledWith({
        id: "class-hash-1",
        context_id: "class-hash-1",
        name: "Class 1",
        network: "test-network",
        networks: ["test-network"],
        teacher: "11",
        teachers: [ "11" ],
        uri: ""
      });
    });

    it("should sync demo class if the user has no offerings", async () => {
      const user = UserModel.create({ id: kTeacher1Id, type: "teacher", network: "test-network" });
      const firestore = new Firestore(mockDB);
      await syncTeacherClassesAndOfferings(firestore, user, portalClass1Model, kPortalJWT);
      expect(mockDoc).toHaveBeenCalledTimes(2);
      expect(mockDoc).toHaveBeenCalledWith(`/authed/test-portal/classes/test-network_${kClass1Hash}`);
      expect(mockDoc).toHaveBeenCalledWith(`/authed/test-portal/classes/${kClass1Hash}`);
      expect(mockDocGet).toHaveBeenCalledTimes(2);
      expect(mockDocSet).toHaveBeenCalledTimes(2);
      expect(mockDocSet).toHaveBeenCalledWith({
        id: "class-hash-1",
        context_id: "class-hash-1",
        name: "Class 1",
        network: "test-network",
        networks: ["test-network"],
        teacher: "11",
        teachers: [ "11" ],
        uri: ""
      });
    });

    it("should sync class even if the user has no network", async () => {
      const user = UserModel.create({ id: kTeacher1Id, type: "teacher", portalClassOfferings: [userOffering1()] });
      fetchMock.mockResponseOnce(JSON.stringify(portalClass1));
      const firestore = new Firestore(mockDB);
      await syncTeacherClassesAndOfferings(firestore, user, portalClass1Model, kPortalJWT);
      expect(mockDoc).toHaveBeenCalledTimes(1);
      expect(mockDocGet).toHaveBeenCalledTimes(1);
      expect(mockDocSet).toHaveBeenCalledTimes(1);
      expect(mockDocSet).toHaveBeenCalledWith({...fsClass1, network: undefined});
    });

    it("should sync classes and offerings when appropriate", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      fetchMock.mockResponseOnce(JSON.stringify(portalClass1));
      const firestore = new Firestore(mockDB);
      await syncTeacherClassesAndOfferings(firestore, completeTeacher, portalClass1Model, kPortalJWT);
      expect(mockDoc).toHaveBeenCalledTimes(4);
      expect(mockDocGet).toHaveBeenCalledTimes(4);
      expect(mockDocSet).toHaveBeenCalledTimes(4);
    });
  });

  describe("getNetworkClassesThatAssignedProblem", () => {
    it("calls appropriate firestore methods", () => {
      const problemPath = getProblemPath(kOffering1Unit, kOffering1Problem);
      const firestore = new Firestore(mockDB);
      getNetworkClassesThatAssignedProblem(firestore, "test-network", problemPath);
      expect(mockCollection).toHaveBeenCalledWith("/authed/test-portal/offerings");
      expect(mockCollectionWhere).toHaveBeenCalledTimes(2);
      expect(mockCollectionGet).toHaveBeenCalledTimes(1);
    });
  });
});
