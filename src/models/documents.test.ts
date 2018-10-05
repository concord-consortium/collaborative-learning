import { WorkspaceModel, WorkspaceModelType, SectionWorkspace } from "./workspace";
import { DocumentModel, DocumentModelType, SectionDocument } from "./document";
import { DocumentsModelType, DocumentsModel } from "./documents";

describe("documents model", () => {
  let workspace: WorkspaceModelType;
  let documents: DocumentsModelType;
  let document: DocumentModelType;

  beforeEach(() => {
    workspace = WorkspaceModel.create({
      type: SectionWorkspace,
      mode: "1-up",
    });
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

  const getPublishedDocument = (createdAt: number, sectionId: string, groupId: string) => {
    return DocumentModel.create({
      uid: "1",
      type: "publication",
      key: `llDoc-${groupId}-${sectionId}-${createdAt}`,
      createdAt,
      content: {},
      groupId,
      sectionId,
    });
  };

  it("gets a correctly sorted list of publications for a given section", () => {
    const pub1 = getPublishedDocument(0, "introduction", "1");
    const newerPub1 = getPublishedDocument(10, "introduction", "1");
    const badPub1 = getPublishedDocument(5, "initialChallenge", "1");
    const pub2 = getPublishedDocument(7, "introduction", "2");

    documents.add(pub2);
    documents.add(pub1);
    documents.add(newerPub1);
    documents.add(badPub1);
    expect(documents.all.length).toBe(4);

    const latestPubs = documents.getLatestPublicationsForSection("introduction");
    expect(latestPubs.length).toBe(2);
    expect(latestPubs[0]).toBe(newerPub1);
    expect(latestPubs[1]).toBe(pub2);
  });
});
