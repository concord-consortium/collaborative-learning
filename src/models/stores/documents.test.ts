import { DocumentModel, DocumentModelType, SectionDocument, DocumentType} from "../document/document";
import { DocumentsModelType, DocumentsModel } from "./documents";
import { ClassModelType, ClassModel, ClassStudentModel } from "./class";

describe("documents model", () => {
  let documents: DocumentsModelType;
  let document: DocumentModelType;

  beforeEach(() => {
    document = DocumentModel.create({
      type: SectionDocument,
      title: "test",
      uid: "1",
      key: "test",
      createdAt: 1,
      sectionId: "2",
      content: {}
    }),
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
    expect(documents.getSectionDocument("1", "2")).toBe(undefined);
    documents.add(document);
    expect(documents.getSectionDocument("1", "2")).toBe(document);
  });

  describe("getLatestPublications", () => {
    let student1;
    let student2;
    let student3;

    let clazz: ClassModelType;

    beforeEach(() => {
      student1 = ClassStudentModel.create({
        id: "1",
        firstName: "aaa",
        lastName: "aaa",
        fullName: "aaa aaa",
        initials: "AA"
      });
      student2 = ClassStudentModel.create({
        id: "2",
        firstName: "zzz",
        lastName: "aaa",
        fullName: "zzz aaa",
        initials: "ZA"
      });
      student3 = ClassStudentModel.create({
        id: "3",
        firstName: "zzz",
        lastName: "zzz",
        fullName: "zzz zzz",
        initials: "ZZ"
      });

      clazz = ClassModel.create({
        name: "test",
        classHash: "testHash",
        students: [student1, student2, student3]
      });
    });

    const getPublishedDocument = (createdAt: number, sectionId: string, uid: string) => {
      return DocumentModel.create({
        uid,
        type: "publication",
        key: `llDoc-${uid}-${sectionId}-${createdAt}`,
        createdAt,
        content: {},
        groupId: "1",
        sectionId,
      });
    };

    it("finds documents from the correct section", () => {
      const pub1 = getPublishedDocument(0, "introduction", "1");
      const badPub1 = getPublishedDocument(10, "initialChallenge", "1");

      documents.add(pub1);
      documents.add(badPub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestPublicationsForSection("introduction", clazz);
      expect(latestPubs.length).toBe(1);
      expect(latestPubs[0]).toBe(pub1);
    });

    it("finds the newest document for a user", () => {
      const pub1 = getPublishedDocument(0, "introduction", "1");
      const newerPub1 = getPublishedDocument(10, "introduction", "1");

      documents.add(pub1);
      documents.add(newerPub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestPublicationsForSection("introduction", clazz);
      expect(latestPubs.length).toBe(1);
      expect(latestPubs[0]).toBe(newerPub1);
    });

    it("sorts publications by last name", () => {
      const pub1 = getPublishedDocument(0, "introduction", "1");
      const pub3 = getPublishedDocument(10, "introduction", "3");

      documents.add(pub3);
      documents.add(pub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestPublicationsForSection("introduction", clazz);
      expect(latestPubs.length).toBe(2);
      expect(latestPubs[0]).toBe(pub1);
      expect(latestPubs[1]).toBe(pub3);
    });

    it("sorts publications by first name, in case of matching last names", () => {
      const pub1 = getPublishedDocument(0, "introduction", "1");
      const pub2 = getPublishedDocument(10, "introduction", "2");

      documents.add(pub2);
      documents.add(pub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestPublicationsForSection("introduction", clazz);
      expect(latestPubs.length).toBe(2);
      expect(latestPubs[0]).toBe(pub1);
      expect(latestPubs[1]).toBe(pub2);
    });

    it("sorts publications with missing users last", () => {
      const pub1 = getPublishedDocument(0, "introduction", "1");
      const pub2 = getPublishedDocument(10, "introduction", "2");
      const pubNull = getPublishedDocument(4, "introduction", "foo");

      documents.add(pubNull);
      documents.add(pub1);
      documents.add(pub2);
      expect(documents.all.length).toBe(3);

      const latestPubs = documents.getLatestPublicationsForSection("introduction", clazz);
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

      const latestPubs = documents.getLatestLogPublications();
      expect(latestPubs.length).toBe(1);
      expect(latestPubs[0]).toBe(pub1);
    });

    it("finds the newest document for a user", () => {
      const pub1 = getPublishedDocument(0, "1");
      const newerPub1 = getPublishedDocument(10, "1");

      documents.add(pub1);
      documents.add(newerPub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestLogPublications();
      expect(latestPubs.length).toBe(1);
      expect(latestPubs[0]).toBe(newerPub1);
    });

    it("sorts publications by title", () => {
      const pub1 = getPublishedDocument(0, "1", "learningLogPublication", "aaa");
      const pub3 = getPublishedDocument(10, "3", "learningLogPublication", "zzz");

      documents.add(pub3);
      documents.add(pub1);
      expect(documents.all.length).toBe(2);

      const latestPubs = documents.getLatestLogPublications();
      expect(latestPubs.length).toBe(2);
      expect(latestPubs[0]).toBe(pub1);
      expect(latestPubs[1]).toBe(pub3);
    });
  });
});
