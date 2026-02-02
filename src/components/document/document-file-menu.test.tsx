import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import { DocumentFileMenu } from "./document-file-menu";
import { createDocumentModel } from "../../models/document/document";
import { DocumentContentModel } from "../../models/document/document-content";
import { specStores } from "../../models/stores/spec-stores";
import { specAppConfig } from "../../models/stores/spec-app-config";

describe("DocumentFileMenu", () => {

  const appConfig = specAppConfig({
    config: {
      appName: "Test",
      documentLabels: {
        personal: {
          labels: { "1": "Document", "n": "Documents" }
        },
        problem: {
          labels: { "1": "Document", "n": "Documents" }
        }
      }
    }
  });
  const stores = specStores({ appConfig });
  const content = DocumentContentModel.create({});
  const document = createDocumentModel({
    uid: "1",
    type: "personal",
    key: "test-doc-1",
    createdAt: 0,
    content: content as any
  });

  const onNewDocument = jest.fn();
  const onOpenDocument = jest.fn();
  const onCopyDocument = jest.fn();
  const onDeleteDocument = jest.fn();

  beforeEach(() => {
    onNewDocument.mockReset();
    onOpenDocument.mockReset();
    onCopyDocument.mockReset();
    onDeleteDocument.mockReset();
  });

  const renderFileMenu = (props = {}) => {
    const defaultProps = {
      document,
      onNewDocument,
      onOpenDocument,
      onCopyDocument,
      onDeleteDocument
    };
    return render(
      <ModalProvider>
        <Provider stores={stores}>
          <DocumentFileMenu {...defaultProps} {...props} />
        </Provider>
      </ModalProvider>
    );
  };

  it("renders the File menu with title visible", () => {
    renderFileMenu();

    expect(screen.getByTestId("document-file-menu-header")).toBeInTheDocument();
    expect(screen.getByText("File")).toBeInTheDocument();
  });

  it("shows menu items when clicked", () => {
    renderFileMenu();

    act(() => {
      userEvent.click(screen.getByTestId("document-file-menu-header"));
    });

    expect(screen.getByTestId("document-file-menu-list")).toBeInTheDocument();
    expect(screen.getByTestId("list-item-icon-new-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("list-item-icon-open-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("list-item-icon-copy-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("list-item-icon-delete-workspace")).toBeInTheDocument();
  });

  it("calls onNewDocument when New menu item is clicked", () => {
    renderFileMenu();

    act(() => {
      userEvent.click(screen.getByTestId("document-file-menu-header"));
    });

    act(() => {
      userEvent.click(screen.getByTestId("list-item-icon-new-workspace"));
    });

    expect(onNewDocument).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenDocument when Open menu item is clicked", () => {
    renderFileMenu();

    act(() => {
      userEvent.click(screen.getByTestId("document-file-menu-header"));
    });

    act(() => {
      userEvent.click(screen.getByTestId("list-item-icon-open-workspace"));
    });

    expect(onOpenDocument).toHaveBeenCalledTimes(1);
    expect(onOpenDocument).toHaveBeenCalledWith(document);
  });

  it("calls onCopyDocument when Make a copy menu item is clicked", () => {
    renderFileMenu();

    act(() => {
      userEvent.click(screen.getByTestId("document-file-menu-header"));
    });

    act(() => {
      userEvent.click(screen.getByTestId("list-item-icon-copy-workspace"));
    });

    expect(onCopyDocument).toHaveBeenCalledTimes(1);
    expect(onCopyDocument).toHaveBeenCalledWith(document);
  });

  it("calls onDeleteDocument when Delete menu item is clicked", () => {
    renderFileMenu();

    act(() => {
      userEvent.click(screen.getByTestId("document-file-menu-header"));
    });

    act(() => {
      userEvent.click(screen.getByTestId("list-item-icon-delete-workspace"));
    });

    expect(onDeleteDocument).toHaveBeenCalledTimes(1);
    expect(onDeleteDocument).toHaveBeenCalledWith(document);
  });

  it("disables New menu item when onNewDocument is not provided", () => {
    renderFileMenu({ onNewDocument: undefined });

    act(() => {
      userEvent.click(screen.getByTestId("document-file-menu-header"));
    });

    const newItem = screen.getByTestId("list-item-icon-new-workspace");
    expect(newItem).toHaveClass("disabled");
  });

  it("disables Delete menu item when isDeleteDisabled is true", () => {
    renderFileMenu({ isDeleteDisabled: true });

    act(() => {
      userEvent.click(screen.getByTestId("document-file-menu-header"));
    });

    const deleteItem = screen.getByTestId("list-item-icon-delete-workspace");
    expect(deleteItem).toHaveClass("disabled");
  });
});
