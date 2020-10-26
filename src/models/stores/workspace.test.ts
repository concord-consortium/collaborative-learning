import { WorkspaceModel, WorkspaceModelType, ProblemWorkspace } from "./workspace";
import { DocumentModel, DocumentModelType } from "../document/document";
import { ProblemDocument } from "../document/document-types";

describe("workspaces model", () => {
  let workspace: WorkspaceModelType;
  let goodDoc: DocumentModelType;
  // let badDoc: DocumentModelType;

  beforeEach(() => {
    workspace = WorkspaceModel.create({
      type: ProblemWorkspace,
      mode: "1-up",
    });

    goodDoc = DocumentModel.create({
      uid: "2",
      type: ProblemDocument,
      key: "test2",
      createdAt: 1,
      content: {}
    });

    // badDoc = DocumentModel.create({
    //   uid: "3",
    //   type: ProblemDocument,
    //   key: "test3",
    //   createdAt: 1,
    //   content: {}
    // });
  });

  it("has default values", () => {
    expect(workspace.mode).toBe("1-up");
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

  it("allows primary document to be set", () => {
    workspace.setPrimaryDocument(goodDoc);
    expect(workspace.primaryDocumentKey).toBe("test2");
    workspace.setPrimaryDocument(undefined);
    expect(workspace.primaryDocumentKey).toBe(undefined);
  });

  it("allows available document to be set", () => {
    workspace.setAvailableDocument(goodDoc);
    expect(workspace.primaryDocumentKey).toBe("test2");
    workspace.setAvailableDocument(undefined);
    workspace.toggleComparisonVisible();
    workspace.setAvailableDocument(goodDoc);
    expect(workspace.primaryDocumentKey).toBe(undefined);
    expect(workspace.comparisonDocumentKey).toBe("test2");
  });

  it("allows comparison document to be set", () => {
    workspace.setComparisonDocument(goodDoc);
    expect(workspace.comparisonDocumentKey).toBe("test2");
    workspace.setComparisonDocument(undefined);
    expect(workspace.comparisonDocumentKey).toBe(undefined);
  });

  it("allows comparisonWorkspaceVisible to be set", () => {
    workspace.toggleComparisonVisible();
    expect(workspace.comparisonVisible).toBe(true);
    workspace.toggleComparisonVisible();
    expect(workspace.comparisonVisible).toBe(false);
    workspace.toggleComparisonVisible({override: true});
    expect(workspace.comparisonVisible).toBe(true);
    workspace.toggleComparisonVisible({override: false});
    expect(workspace.comparisonVisible).toBe(false);
  });

});
