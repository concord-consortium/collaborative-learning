import fetchMock from "jest-fetch-mock";
import "firebase/firestore";
import { Firestore } from "./firestore";
import { ClassDocument, OfferingDocument } from "./firestore-schema";
import { IPortalClassInfo, IPortalClassUser } from "./portal-types";
import { UserModel, UserPortalOffering } from "../models/stores/user";
import {
  ClassWithoutTeachers, clearTeachersPromises, getNetworkClassesThatAssignedProblem, getProblemPath,
  OfferingWithoutTeachers, syncClass, syncOffering, syncTeacherClassesAndOfferings
} from "./teacher-network";

var mockDocGet = jest.fn();
var mockDocSet = jest.fn();
var mockCollectionGet = jest.fn();
var mockCollectionWhere = jest.fn();
var mockDoc = jest.fn((path: string) => ({ get: mockDocGet, set: mockDocSet }));
var mockCollection = jest.fn((path: string) => {
  const mockObject = { get: mockCollectionGet, where: mockCollectionWhere };
  mockObject.where.mockImplementation(() => mockObject);
  return mockObject;
});
const firestore = {
  collection: mockCollection,
  doc: mockDoc
} as any as Firestore;

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
const kTeacher1Name = "Teacher 1";
const kTeacher1User: IPortalClassUser = {
        id: "https://concord.org/users/11", user_id: kTeacher1IdNumeric, first_name: "Teacher", last_name: "1"
      };

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
  teachers: [kTeacher1User],
  students: [],
  offerings: []
};
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

    const classDocPath = `classes/test-network_${kClass1Hash}`;

    it("should do nothing if the class already exists", async () => {
      mockDocGet.mockImplementation(() => Promise.resolve(fsClass1));
      const result = await syncClass(firestore, kPortalJWT, partClass1);
      expect(mockDoc).toHaveBeenCalledWith(classDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should do nothing if the portal class api call response is not ok", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      // !ok response from fetch
      fetchMock.mockResponseOnce('{}', { status: 500, headers: { 'content-type': 'application/json' } });
      const result = await syncClass(firestore, kPortalJWT, partClass1);
      expect(mockDoc).toHaveBeenCalledWith(classDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should do nothing if the portal class api call fails", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      fetchMock.mockRejectOnce(new Error());
      const result = await syncClass(firestore, kPortalJWT, partClass1);
      expect(mockDoc).toHaveBeenCalledWith(classDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should do nothing if an unexpected firestore error occurs", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestoreOtherError(); });
      fetchMock.mockResponseOnce(JSON.stringify(portalClass1));
      const result = await syncClass(firestore, kPortalJWT, partClass1);
      expect(mockDoc).toHaveBeenCalledWith(classDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should write class to firestore if it's not already there", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      fetchMock.mockResponseOnce(JSON.stringify(portalClass1));
      const result = await syncClass(firestore, kPortalJWT, partClass1);
      expect(mockDoc).toHaveBeenCalledWith(classDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).toHaveBeenCalledWith(fsClass1);
      return result;
    });
  });


  describe("syncOffering", () => {
    beforeEach(() => {
      resetMocks();
    });

    const offeringDocPath = `offerings/test-network_${kOffering1Id}`;

    it("should do nothing if the offering already exists", async () => {
      mockDocGet.mockImplementation(() => Promise.resolve(fsOffering1));
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
      const result = await syncOffering(firestore, kPortalJWT, kClass1Url, partOffering1);
      expect(mockDoc).toHaveBeenCalledWith(offeringDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should do nothing if the portal class api call fails", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      fetchMock.mockRejectOnce(new Error());
      const result = await syncOffering(firestore, kPortalJWT, kClass1Url, partOffering1);
      expect(mockDoc).toHaveBeenCalledWith(offeringDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should do nothing if an unexpected firestore error occurs", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestoreOtherError(); });
      fetchMock.mockResponseOnce(JSON.stringify(portalClass1));
      const result = await syncOffering(firestore, kPortalJWT, kClass1Url, partOffering1);
      expect(mockDoc).toHaveBeenCalledWith(offeringDocPath);
      expect(mockDocGet).toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
      return result;
    });

    it("should write class to firestore if it's not already there", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      fetchMock.mockResponseOnce(JSON.stringify(portalClass1));
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

    it("should do nothing if there is no portal JWT", async () => {
      const user = UserModel.create({ id: kTeacher1Id, type: "teacher", network: "test-network" });
      await syncTeacherClassesAndOfferings(firestore, user, "");
      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockDocGet).not.toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it("should do nothing if the user has no offerings", async () => {
      const user = UserModel.create({ id: kTeacher1Id, type: "teacher", network: "test-network" });
      await syncTeacherClassesAndOfferings(firestore, user, kPortalJWT);
      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockDocGet).not.toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it("should do nothing if the user has no network", async () => {
      const user = UserModel.create({ id: kTeacher1Id, type: "teacher", portalClassOfferings: [userOffering1()] });
      await syncTeacherClassesAndOfferings(firestore, user, kPortalJWT);
      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockDocGet).not.toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it("should sync classes and offerings when appropriate", async () => {
      mockDocGet.mockImplementation(() => { throw new MockFirestorePermissionsError(); });
      fetchMock.mockResponseOnce(JSON.stringify(portalClass1));
      await Promise.all(syncTeacherClassesAndOfferings(firestore, completeTeacher, kPortalJWT));
      expect(mockDoc).toHaveBeenCalledTimes(3);
      expect(mockDocGet).toHaveBeenCalledTimes(3);
      expect(mockDocSet).toHaveBeenCalledTimes(3);
    });
  });

  describe("getNetworkClassesThatAssignedProblem", () => {
    it("calls appropriate firestore methods", () => {
      const problemPath = getProblemPath(kOffering1Unit, kOffering1Problem);
      getNetworkClassesThatAssignedProblem(firestore, "test-network", problemPath);
      expect(mockCollection).toHaveBeenCalledWith("offerings");
      expect(mockCollectionWhere).toHaveBeenCalledTimes(2);
      expect(mockCollectionGet).toHaveBeenCalledTimes(1);
    });
  });
});
