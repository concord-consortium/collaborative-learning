import { fireEvent, render } from "@testing-library/react";
import { Provider } from "mobx-react";
import React from "react";

import { SimpleDocumentItem } from "./simple-document-item";
import { DocumentMetadataModel, IDocumentMetadataModel } from "../../models/document/document-metadata-model";
import { ProblemDocument } from "../../models/document/document-types";
import { specStores } from "../../models/stores/spec-stores";
import { UserModel } from "../../models/stores/user";

interface IRenderOptions {
  isPrivate?: boolean;
  selected?: boolean;
  onSelectDocument?: (document: IDocumentMetadataModel) => void;
}

function renderItem(options: IRenderOptions = {}) {
  const { isPrivate = false, selected = false, onSelectDocument = jest.fn() } = options;
  const ownerId = isPrivate ? "other-user" : "test-student";
  const user = UserModel.create({ id: "test-student", type: "student", name: "Test Student" });
  const stores = specStores({ user });
  const document = DocumentMetadataModel.create({
    type: ProblemDocument,
    title: "Test Document",
    uid: ownerId,
    key: "doc-key-1",
    visibility: "private",
  });
  if (selected) {
    stores.ui.setHighlightedSortWorkDocument(document.key);
  }
  const result = render(
    <Provider stores={stores}>
      <SimpleDocumentItem document={document} onSelectDocument={onSelectDocument} />
    </Provider>
  );
  const item = result.container.querySelector(".simple-document-item") as HTMLElement;
  return { ...result, item, document, onSelectDocument };
}

describe("SimpleDocumentItem", () => {
  it("calls onSelectDocument when clicked", () => {
    const { item, onSelectDocument, document } = renderItem();
    fireEvent.click(item);
    expect(onSelectDocument).toHaveBeenCalledWith(document);
  });

  it("uses the same string for aria-label as for title (so screen readers match the tooltip)", () => {
    const { item } = renderItem();
    expect(item.getAttribute("aria-label")).toBe(item.getAttribute("title"));
  });

  it("sets aria-current='true' when the document is selected", () => {
    const { item } = renderItem({ selected: true });
    expect(item).toHaveAttribute("aria-current", "true");
  });

  it("omits aria-current when the document is not selected", () => {
    const { item } = renderItem({ selected: false });
    expect(item).not.toHaveAttribute("aria-current");
  });

  it("marks the item with aria-disabled='true' when the document is private", () => {
    const { item } = renderItem({ isPrivate: true });
    expect(item).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the item in the tab order when private (so AT users can discover it)", () => {
    const { item } = renderItem({ isPrivate: true });
    expect(item).not.toHaveAttribute("tabindex", "-1");
    expect(item).not.toBeDisabled();
  });

  it("does not call onSelectDocument when clicked while private", () => {
    const { item, onSelectDocument } = renderItem({ isPrivate: true });
    fireEvent.click(item);
    expect(onSelectDocument).not.toHaveBeenCalled();
  });
});
