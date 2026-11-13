import { render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import React from "react";
import { createDocumentModel } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { ToolbarModel } from "../../models/stores/problem-configuration";
import { specStores } from "../../models/stores/spec-stores";
import { EditableDocumentContent } from "./editable-document-content";

// Keep the render tree to what decides between the spinner and the document.
jest.mock("../../hooks/use-document-sync-to-firebase", () => ({
  useDocumentSyncToFirebase: jest.fn()
}));
jest.mock("./canvas", () => ({
  CanvasComponent: () => <div data-testid="canvas" />
}));
jest.mock("./document-toolbar", () => ({
  DocumentToolbar: () => <div data-testid="document-toolbar" />
}));
jest.mock("../four-up", () => ({
  FourUpComponent: () => null
}));

function setup({ readOnly, inWorkspace }: { readOnly?: boolean, inWorkspace?: boolean }) {
  const stores = specStores();
  const historyCatchUp = jest.spyOn(stores.documents, "historyCatchUp").mockResolvedValue();
  const document = createDocumentModel({ type: ProblemDocument, uid: "u1", key: "doc1", createdAt: 1, content: {} });
  document.setHistoryCatchUpPending(true);
  const toolbar = ToolbarModel.create([
    { id: "delete", title: "Delete", iconId: "icon-delete-tool", isTileTool: false }
  ]);
  render(
    <Provider stores={stores}>
      <EditableDocumentContent mode="1-up" isPrimary={!readOnly} document={document} toolbar={toolbar}
        readOnly={readOnly} inWorkspace={inWorkspace} />
    </Provider>
  );
  return { document, historyCatchUp };
}

describe("EditableDocumentContent", () => {
  it("catches up a document opened for editing, showing a spinner until it has", () => {
    const { document, historyCatchUp } = setup({ inWorkspace: true });
    expect(historyCatchUp).toHaveBeenCalledWith(document);
    expect(screen.getByTestId("history-catch-up-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("document-toolbar")).toBeNull();
  });

  // The workspace's comparison pane shows a read-only document with the workspace's editing toolbar.
  it("catches up a read-only document in the workspace, showing a spinner until it has", () => {
    const { document, historyCatchUp } = setup({ readOnly: true, inWorkspace: true });
    expect(historyCatchUp).toHaveBeenCalledWith(document);
    expect(screen.getByTestId("history-catch-up-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("document-toolbar")).toBeNull();
  });

  it("shows a read-only document outside the workspace without catching it up", () => {
    const { historyCatchUp } = setup({ readOnly: true });
    expect(historyCatchUp).not.toHaveBeenCalled();
    expect(screen.queryByTestId("history-catch-up-spinner")).toBeNull();
    expect(screen.getByTestId("document-toolbar")).toBeInTheDocument();
  });
});
