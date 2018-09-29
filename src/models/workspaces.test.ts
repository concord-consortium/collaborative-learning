import { SectionWorkspaceModel,
         SectionWorkspaceModelType,
         WorkspacesModel,
         WorkspacesModelType,
         LearningLogWorkspaceModel,
         PublishedWorkspaceModel} from "./workspaces";
import { DocumentModel, DocumentModelType } from "./document";

describe("workspaces model", () => {
  let workspaces: WorkspacesModelType;
  let workspace: SectionWorkspaceModelType;
  let goodDoc: DocumentModelType;
  let badDoc: DocumentModelType;

  beforeEach(() => {
    workspace = SectionWorkspaceModel.create({
      mode: "1-up",
      tool: "select",
      sectionId: "1",
      visibility: "public",
      document: DocumentModel.create({
        uid: "1",
        key: "test",
        createdAt: 1,
        content: {
          tiles: [{
            id: "1",
            content: {
              type: "Text",
              text: "test"
            }
          }]
        }
      }),
      groupDocuments: {},
    });
    workspaces = WorkspacesModel.create({});
    workspaces.addSectionWorkspace(workspace);

    goodDoc = DocumentModel.create({
      uid: "2",
      key: "test2",
      createdAt: 1,
      content: {}
    });

    badDoc = DocumentModel.create({
      uid: "3",
      key: "test3",
      createdAt: 1,
      content: {}
    });
  });

  it("has default values", () => {
    expect(workspace.mode).toBe("1-up");
    expect(workspace.tool).toBe("select");
  });

  it("allows the mode to be toggled", () => {
    workspace.toggleMode();
    expect(workspace.mode).toBe("4-up");
    workspace.toggleMode();
    expect(workspace.mode).toBe("1-up");
  });

  it("allows the mode to be explicitly set", () => {
    workspace.toggleMode("1-up");
    expect(workspace.mode).toBe("1-up");
    workspace.toggleMode("4-up");
    expect(workspace.mode).toBe("4-up");
  });

  it("allows the tools to be selected", () => {
    workspace.selectTool("select");
    expect(workspace.tool).toBe("select");
    workspace.selectTool("text");
    expect(workspace.tool).toBe("text");
    workspace.selectTool("geometry");
    expect(workspace.tool).toBe("geometry");
  });

  it("allows tiles to be deleted", () => {
    expect(workspace.document.content.tiles.length).toBe(1);
    workspace.deleteTile("1");
    expect(workspace.document.content.tiles.length).toBe(0);
  });

  it("allows the visibility to be toggled", () => {
    workspace.toggleVisibility();
    expect(workspace.visibility).toBe("private");
    workspace.toggleVisibility();
    expect(workspace.visibility).toBe("public");
  });

  it("allows the visibility to be explicity set", () => {
    workspace.toggleVisibility("public");
    expect(workspace.visibility).toBe("public");
    workspace.toggleVisibility("private");
    expect(workspace.visibility).toBe("private");
  });

  it("allows workspaces to be found by section id", () => {
    expect(workspaces.getSectionWorkspace("1")).toBe(workspace);
  });

  it("allows workspaces with new section ids to be added", () => {
    const newWorkspace = SectionWorkspaceModel.create({
      mode: "1-up",
      tool: "select",
      sectionId: "2",
      visibility: "private",
      document: DocumentModel.create({
        uid: "1",
        key: "test",
        createdAt: 1,
        content: {}
      }),
      groupDocuments: {},
    });
    workspaces.addSectionWorkspace(newWorkspace);
    expect(workspaces.getSectionWorkspace("2")).toBe(newWorkspace);
  });

  it("allows ignores adding workspaces with existing section ids", () => {
    const newWorkspace = SectionWorkspaceModel.create({
      mode: "1-up",
      tool: "select",
      sectionId: "1",
      visibility: "private",
      document: DocumentModel.create({
        uid: "1",
        key: "test",
        createdAt: 1,
        content: {}
      }),
      groupDocuments: {},
    });
    workspaces.addSectionWorkspace(newWorkspace);
    expect(workspaces.getSectionWorkspace("1")).toBe(workspace);
  });

  it("adds new group documents", () => {
    workspace.setGroupDocument("1", goodDoc);
    expect(workspace.groupDocuments.get("1")).toBe(goodDoc);
  });

  it("updates existing group documents", () => {
    workspace.setGroupDocument("2", badDoc);
    workspace.setGroupDocument("2", goodDoc);
    expect(workspace.groupDocuments.get("2")).toBe(goodDoc);
  });

  it("clears group documents", () => {
    workspace.setGroupDocument("1", badDoc);
    workspace.clearGroupDocument("1");
    expect(workspace.groupDocuments.get("1")).toBeUndefined();
  });

  it("allows learning log workspaces to be added and deleted", () => {
    const newWorkspace = LearningLogWorkspaceModel.create({
      tool: "select",
      document: DocumentModel.create({
        uid: "1",
        key: "ll-test",
        createdAt: 1,
        content: {
          tiles: [{
            id: "1",
            content: {
              type: "Text",
              text: "test"
            }
          }]
        }
      }),
      title: "Test Log",
      createdAt: 1,
    });
    workspaces.addLearningLogWorkspace(newWorkspace);
    expect(workspaces.getWorkspace("ll-test")).toBe(newWorkspace);
    expect(workspaces.getLearningLogWorkspace("ll-test")).toBe(newWorkspace);

    newWorkspace.setTitle("New Log");
    expect(newWorkspace.title).toBe("New Log");

    newWorkspace.selectTool("text");
    expect(newWorkspace.tool).toBe("text");

    expect(newWorkspace.document.content.tiles.length).toBe(2);
    newWorkspace.deleteTile("1");
    expect(newWorkspace.document.content.tiles.length).toBe(1);

    workspaces.deleteLearningLogWorkspace(newWorkspace);
    expect(workspaces.getLearningLogWorkspace("ll-test")).toBe(undefined);
  });

  it("does not allow learning log workspaces with duplicate keys to be added", () => {
    const learningLog1 = LearningLogWorkspaceModel.create({
      tool: "select",
      document: DocumentModel.create({
        uid: "1",
        key: "ll-test",
        createdAt: 1,
        content: {}
      }),
      title: "Test Log #1",
      createdAt: 1,
    });
    const learningLog2 = LearningLogWorkspaceModel.create({
      tool: "select",
      document: DocumentModel.create({
        uid: "1",
        key: "ll-test",
        createdAt: 1,
        content: {}
      }),
      title: "Test Log #2",
      createdAt: 1,
    });
    expect(workspaces.learningLogs.length).toBe(0);
    workspaces.addLearningLogWorkspace(learningLog1);
    expect(workspaces.learningLogs.length).toBe(1);
    workspaces.addLearningLogWorkspace(learningLog2);
    expect(workspaces.learningLogs.length).toBe(1);
  });

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
});
