import { DocumentModel, DocumentModelType } from "../document/document";
import { ProblemDocument, DocumentType} from "../document/document-types";
import { DocumentsModelType, DocumentsModel } from "./documents";
import { ClassModelType, ClassModel, ClassUserModel } from "./class";

describe("documents model", () => {
  let documents: DocumentsModelType;
  let document: DocumentModelType;

  beforeEach(() => {
    document = DocumentModel.create({
      type: ProblemDocument,
      title: "test",
      uid: "1",
      key: "test",
      createdAt: 1,
      content: {}
    });
    documents = DocumentsModel.create({});
  });

  it("has default values", () => {
    expect(documents.all.length).toBe(0);
  });

  it("allows documents to be added", () => {
    documents.add(document);
    expect(documents.getDocument("test")).toBe(document);
  });

  it("does not allow duplicate documents to be added", () => {
    documents.add(document);
    expect(documents.all.length).toBe(1);
    documents.add(document);
    expect(documents.all.length).toBe(1);
  });

  it("allows documents to be found by section id", () => {
    expect(documents.getProblemDocument("1")).toBe(undefined);
    documents.add(document);
    expect(documents.getProblemDocument("1")).toBe(document);
  });

  describe("getLatestPublications", () => {
    let student1;
    let student2;
    let student3;

    let clazz: ClassModelType;

    beforeEach(() => {
      student1 = ClassUserModel.create({
        type: "student",
        id: "1",
        firstName: "aaa",
        lastName: "aaa",
        fullName: "aaa aaa",
        initials: "AA"
      });
      student2 = ClassUserModel.create({
        type: "student",
        id: "2",
        firstName: "zzz",
        lastName: "aaa",
        fullName: "zzz aaa",
        initials: "ZA"
      });
      student3 = ClassUserModel.create({
        type: "student",
        id: "3",
        firstName: "zzz",
        lastName: "zzz",
        fullName: "zzz zzz",
        initials: "ZZ"
      });

      clazz = ClassModel.create({
        name: "test",
        classHash: "testHash",
        users: {1: student1, 2: student2, 3: student3}
      });
    });

    const getPublishedDocument = (createdAt: number, uid: string) => {
      return DocumentModel.create({
        uid,
        type: "publication",
        key: `pubDoc-${uid}-${createdAt}`,
        createdAt,
        content: {},
        groupId: "1"
      });
    };

    it("finds documents from the correct section", () => {
      const pub1 = getPublishedDocument(0, "1");
      const badPub1 = getPublishedDocument(10, "1");

      documents.add(pub1);
      documents.add(badPub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestPublications(clazz);
      expect(latestPubs.length).toBe(1);
      expect(latestPubs[0]).toBe(badPub1);
    });

    it("finds the newest document for a user", () => {
      const pub1 = getPublishedDocument(0, "1");
      const newerPub1 = getPublishedDocument(10, "1");

      documents.add(pub1);
      documents.add(newerPub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestPublications(clazz);
      expect(latestPubs.length).toBe(1);
      expect(latestPubs[0]).toBe(newerPub1);
    });

    it("sorts publications by last name", () => {
      const pub1 = getPublishedDocument(0, "1");
      const pub3 = getPublishedDocument(10, "3");

      documents.add(pub3);
      documents.add(pub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestPublications(clazz);
      expect(latestPubs.length).toBe(2);
      expect(latestPubs[0]).toBe(pub1);
      expect(latestPubs[1]).toBe(pub3);
    });

    it("sorts publications by first name, in case of matching last names", () => {
      const pub1 = getPublishedDocument(0, "1");
      const pub2 = getPublishedDocument(10, "2");

      documents.add(pub2);
      documents.add(pub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestPublications(clazz);
      expect(latestPubs.length).toBe(2);
      expect(latestPubs[0]).toBe(pub1);
      expect(latestPubs[1]).toBe(pub2);
    });

    it("sorts publications with missing users last", () => {
      const pub1 = getPublishedDocument(0, "1");
      const pub2 = getPublishedDocument(10, "2");
      const pubNull = getPublishedDocument(4, "foo");

      documents.add(pubNull);
      documents.add(pub1);
      documents.add(pub2);
      expect(documents.all.length).toBe(3);

      const latestPubs = documents.getLatestPublications(clazz);
      expect(latestPubs.length).toBe(3);
      expect(latestPubs[0]).toBe(pub1);
      expect(latestPubs[1]).toBe(pub2);
      expect(latestPubs[2]).toBe(pubNull);
    });
  });

  describe("getLatestLogPublications", () => {
    const getPublishedDocument = (createdAt: number, uid: string, type?: DocumentType, title?: string) => {
      return DocumentModel.create({
        uid,
        type: type || "learningLogPublication",
        key: `llDoc-${uid}-${title}-${createdAt}`,
        originDoc: `llDoc-${uid}-${title}-origin`,
        title,
        createdAt,
        content: {},
        groupId: "1",
      });
    };

    it("finds published learning logs", () => {
      const pub1 = getPublishedDocument(0, "1");
      const badPub1 = getPublishedDocument(10, "1", "section");

      documents.add(pub1);
      documents.add(badPub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestOtherPublications("learningLogPublication");
      expect(latestPubs.length).toBe(1);
      expect(latestPubs[0]).toBe(pub1);
    });

    it("finds the newest document for a user", () => {
      const pub1 = getPublishedDocument(0, "1");
      const newerPub1 = getPublishedDocument(10, "1");

      documents.add(pub1);
      documents.add(newerPub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestOtherPublications("learningLogPublication");
      expect(latestPubs.length).toBe(1);
      expect(latestPubs[0]).toBe(newerPub1);
    });

    it("sorts publications by title", () => {
      const pub1 = getPublishedDocument(0, "1", "learningLogPublication", "aaa");
      const pub3 = getPublishedDocument(10, "3", "learningLogPublication", "zzz");

      documents.add(pub3);
      documents.add(pub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestOtherPublications("learningLogPublication");
      expect(latestPubs.length).toBe(2);
      expect(latestPubs[0]).toBe(pub1);
      expect(latestPubs[1]).toBe(pub3);
    });
  });
});
