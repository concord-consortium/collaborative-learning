import { fireEvent, render } from "@testing-library/react";
import { Provider } from "mobx-react";
import React from "react";

import { SimpleDocumentItem } from "./simple-document-item";
import { DocumentMetadataModel, IDocumentMetadataModel } from "../../models/document/document-metadata-model";
import { ProblemDocument } from "../../models/document/document-types";
import { ClassModel } from "../../models/stores/class";
import { specStores } from "../../models/stores/spec-stores";
import { UserModel } from "../../models/stores/user";

interface IRenderOptions {
  isPrivate?: boolean;
  selected?: boolean;
  /** Overrides the document's owner, for owners who are not members of the class. */
  uid?: string;
  onSelectDocument?: (document: IDocumentMetadataModel) => void;
}

function renderItem(options: IRenderOptions = {}) {
  const { isPrivate = false, selected = false, onSelectDocument = jest.fn() } = options;
  const ownerId = options.uid ?? (isPrivate ? "other-user" : "test-student");
  const user = UserModel.create({ id: "test-student", type: "student", name: "Test Student" });
  const clazz = ClassModel.create({
    name: "Test Class",
    classHash: "test-class-hash",
    users: {
      "test-student": { type: "student", id: "test-student", firstName: "Test", lastName: "Student",
                        fullName: "Test Student", initials: "TS" }
    }
  });
  const stores = specStores({ user, class: clazz });
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

  it("names a document by its owner and title, and one whose owner is not in the class by title alone", () => {
    // Group and class-wide documents are owned by a synthetic uid (`group_<offeringId>_<groupId>`,
    // `class_<classHash>`) that belongs to no class member, and their titles already say whose they are.
    const memberLabel = renderItem().item.getAttribute("aria-label");
    const syntheticOwnerItem = renderItem({ uid: "class_test-class-hash" }).item;
    const syntheticLabel = syntheticOwnerItem.getAttribute("aria-label");

    expect(memberLabel).toBe(`Test Student: ${syntheticLabel}`);
    expect(syntheticLabel).not.toContain("undefined");
    expect(syntheticOwnerItem.getAttribute("title")).toBe(syntheticLabel);
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
