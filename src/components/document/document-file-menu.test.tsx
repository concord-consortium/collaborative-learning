import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "mobx-react";
import { ModalProvider } from "@concord-consortium/react-modal-hook";

import { DocumentFileMenu } from "./document-file-menu";
import { specStores } from "../../models/stores/spec-stores";
import { AppConfigModel } from "../../models/stores/app-config-model";
import { DocumentModel, DocumentModelType } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { AppConfigContext } from "../../app-config-context";
import { unitConfigDefaults } from "../../test-fixtures/sample-unit-configurations";

describe("DocumentFileMenu", () => {
  interface IRenderOptions {
    autoAssignStudentsToIndividualGroups?: boolean;
    currentGroupId?: string;
    groupDocumentsEnabled?: boolean;
    onOpenGroupDocument?: (document: DocumentModelType) => void;
  }

  const renderDocumentFileMenu = (options: IRenderOptions = {}) => {
    const {
      autoAssignStudentsToIndividualGroups = false,
      currentGroupId,
      groupDocumentsEnabled,
      onOpenGroupDocument
    } = options;

    const appConfig = AppConfigModel.create({
      config: {
        ...unitConfigDefaults,
        autoAssignStudentsToIndividualGroups,
        groupDocumentsEnabled
      }
    });
    const stores = specStores({ appConfig });
    if (currentGroupId) {
      stores.user.setCurrentGroupId(currentGroupId);
    }

    const document = DocumentModel.create({
      content: {},
      createdAt: Date.now(),
      key: "doc-1",
      type: ProblemDocument,
      uid: "user-1"
    });

    render(
      <ModalProvider>
        <Provider stores={stores}>
          <AppConfigContext.Provider value={{}}>
            <DocumentFileMenu document={document} onOpenGroupDocument={onOpenGroupDocument} />
          </AppConfigContext.Provider>
        </Provider>
      </ModalProvider>
    );

    return { stores, document };
  };

  const openMenu = async () => {
    await act(async () => {
      userEvent.click(screen.getByTestId("document-file-menu-header"));
    });
  };

  describe("Group Doc menu item visibility", () => {
    it("does not show Group Doc when groupDocumentsEnabled is false", async () => {
      renderDocumentFileMenu({
        autoAssignStudentsToIndividualGroups: false,
        groupDocumentsEnabled: false,
        currentGroupId: "group-1"
      });

      await openMenu();

      expect(screen.queryByTestId("list-item-icon-open-group-doc")).not.toBeInTheDocument();
    });

    it("does not show Group Doc when groupDocumentsEnabled is undefined", async () => {
      renderDocumentFileMenu({
        autoAssignStudentsToIndividualGroups: false,
        currentGroupId: "group-1"
      });

      await openMenu();

      expect(screen.queryByTestId("list-item-icon-open-group-doc")).not.toBeInTheDocument();
    });

    it("does not show Group Doc when groups are not permitted", async () => {
      renderDocumentFileMenu({
        autoAssignStudentsToIndividualGroups: true,
        currentGroupId: "group-1",
        groupDocumentsEnabled: true
      });

      await openMenu();

      expect(screen.queryByTestId("list-item-icon-open-group-doc")).not.toBeInTheDocument();
    });

    it("does not show Group Doc when user is not in a group", async () => {
      renderDocumentFileMenu({
        autoAssignStudentsToIndividualGroups: false,
        groupDocumentsEnabled: true
      });

      await openMenu();

      expect(screen.queryByTestId("list-item-icon-open-group-doc")).not.toBeInTheDocument();
    });

    it("shows Group Doc when all conditions are met", async () => {
      renderDocumentFileMenu({
        autoAssignStudentsToIndividualGroups: false,
        currentGroupId: "group-1",
        groupDocumentsEnabled: true
      });

      await openMenu();

      expect(screen.getByTestId("list-item-icon-open-group-doc")).toBeInTheDocument();
    });

    it("calls onOpenGroupDocument when Group Doc is clicked", async () => {
      const onOpenGroupDocument = jest.fn();
      const { document } = renderDocumentFileMenu({
        autoAssignStudentsToIndividualGroups: false,
        currentGroupId: "group-1",
        groupDocumentsEnabled: true,
        onOpenGroupDocument
      });

      await openMenu();

      await act(async () => {
        userEvent.click(screen.getByTestId("list-item-icon-open-group-doc"));
      });

      expect(onOpenGroupDocument).toHaveBeenCalledWith(document);
    });
  });
});
