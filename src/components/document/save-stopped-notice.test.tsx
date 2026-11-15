import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { observer } from "mobx-react";
import React from "react";
import { createDocumentModel, DocumentModelType } from "../../models/document/document";
import { DocumentContentModel } from "../../models/document/document-content";
import { ProblemDocument } from "../../models/document/document-types";
import { resetUnrecordedChangeRepeatsForTesting } from "../../models/document/save-stopped-notice";
import { NotExactReason } from "../../models/history/session-exactness";
import { TreeManagerType } from "../../models/history/tree-manager";
import { SaveStoppedNotice, useSaveStoppedNotice } from "./save-stopped-notice";

const Harness = observer(function Harness({ document }: { document: DocumentModelType }) {
  const state = useSaveStoppedNotice(document);
  return (
    <div>
      <button type="button">Under the notice</button>
      {state && <SaveStoppedNotice state={state} />}
    </div>
  );
});

function setup(concurrent = true) {
  const document = createDocumentModel({
    uid: "1", type: ProblemDocument, key: "doc-1", concurrent: concurrent || undefined,
    content: DocumentContentModel.create({}) as any
  });
  const { exactness } = document.treeManagerAPI as TreeManagerType;
  exactness.startAt("e0");
  render(<Harness document={document} />);
  const stop = (reason: NotExactReason) => act(() => exactness.markNotExact(reason));
  return { document, stop };
}

describe("SaveStoppedNotice", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetUnrecordedChangeRepeatsForTesting();
  });

  it("shows nothing while the session is exact, or on an individual document", () => {
    setup();
    expect(screen.queryByTestId("save-stopped-notice")).toBeNull();
    const individual = setup(false);
    individual.stop("timed-out-entry");
    expect(screen.queryByTestId("save-stopped-notice")).toBeNull();
  });

  it("covers the document with a notice that can't be closed, and makes the document inert", () => {
    const { stop } = setup();
    stop("unrecorded-change");
    const dialog = screen.getByRole("alertdialog", { name: "Saving stopped" });
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveAccessibleDescription(/Reload the page to keep working/);
    expect(screen.getByText("Code: unrecorded-change")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.getByText("Under the notice").inert).toBe(true);
  });

  it("asks the user to tell their teacher when a reload didn't stop an unrecorded change", () => {
    window.sessionStorage.setItem("clue-unrecorded-change:doc-1", String(Date.now()));
    const { stop } = setup();
    stop("unrecorded-change");
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(/tell your teacher/);
    expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
  });

  it("lets the user close a notice for a document that still looks right", async () => {
    const { stop } = setup();
    stop("timed-out-entry");
    expect(screen.getByRole("alertdialog", { name: "Saving problem" }))
      .toHaveAccessibleDescription(/Changes you make from now on should still be saved/);
    expect(screen.getByText("Under the notice").inert).toBeFalsy();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("save-stopped-notice")).toBeNull();
  });

  // The workspace keeps the component when its pane changes to another document.
  it("shows a notice closed on one document again for the next document in the same place", async () => {
    const makeStoppedDocument = (key: string) => {
      const document = createDocumentModel({
        uid: "1", type: ProblemDocument, key, concurrent: true, content: DocumentContentModel.create({}) as any
      });
      const { exactness } = document.treeManagerAPI as TreeManagerType;
      exactness.startAt("e0");
      exactness.markNotExact("timed-out-entry");
      return document;
    };
    const first = makeStoppedDocument("doc-1");
    const second = makeStoppedDocument("doc-2");
    const { rerender } = render(<Harness document={first} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("save-stopped-notice")).toBeNull();

    rerender(<Harness document={second} />);
    expect(screen.getByTestId("save-stopped-notice")).toBeInTheDocument();
    rerender(<Harness document={first} />);
    expect(screen.queryByTestId("save-stopped-notice")).toBeNull();
  });
});
