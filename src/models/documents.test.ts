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

  /*

  FIXME: publication tests

  const getPublishedWorkspace = (createdAt: number, sectionId: string, groupId: string) => {
    return PublishedWorkspaceModel.create({
      document: DocumentModel.create({
        uid: "1",
        key: "ll-test",
        createdAt,
        content: {}
      }),
      createdAt,
      userId: "uid",
      groupId,
      sectionId,
    });
  };

  it("gets a correctly sorted list of publications for a given section", () => {
    const pub1 = getPublishedWorkspace(0, "introduction", "1");
    const newerPub1 = getPublishedWorkspace(10, "introduction", "1");
    const badPub1 = getPublishedWorkspace(5, "initialChallenge", "1");
    const pub2 = getPublishedWorkspace(7, "introduction", "2");

    workspaces.addPublishedWorkspace(pub2);
    workspaces.addPublishedWorkspace(pub1);
    workspaces.addPublishedWorkspace(newerPub1);
    workspaces.addPublishedWorkspace(badPub1);
    expect(workspaces.publications.length).toBe(4);

    const latestPubs = workspaces.getLatestPublicationsForSection("introduction");
    expect(latestPubs.length).toBe(2);
    expect(latestPubs[0]).toBe(newerPub1);
    expect(latestPubs[1]).toBe(pub2);
  });

  */
});
