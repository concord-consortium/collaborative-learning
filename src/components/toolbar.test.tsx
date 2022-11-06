import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "mobx-react";
import React from "react";
import { ModalProvider } from "react-modal-hook";
import { createDocumentModel } from "../models/document/document";
import { DocumentContentModel } from "../models/document/document-content";
import { ToolbarModel, IToolbarModelSnapshot } from "../models/stores/problem-configuration";
import { specStores } from "../models/stores/spec-stores";
import { ToolbarComponent } from "./toolbar";

// This is needed so MST can deserialize snapshots referring to tools
import "../register-tiles";

describe("ToolbarComponent", () => {

  const stores = specStores();
  const content = DocumentContentModel.create({});
  const document = createDocumentModel({
                    uid: "1",
                    type: "problem",
                    key: "1",
                    createdAt: 0,
                    content: content as any
                  });

  const config: IToolbarModelSnapshot = [
    {
      id: "select",
      title: "Select",
      iconId: "icon-select-tool",
      isDefault: true,
      isTileTool: false
    },
    {
      id: "Text",
      title: "Text",
      isDefault: false,
      isTileTool: true
    },
    {
      id: "delete",
      title: "Delete",
      iconId: "icon-delete-tool",
      isDefault: false,
      isTileTool: false
    }
  ];

  it("renders successfully", () => {
    render(
      <ModalProvider>
        <Provider stores={stores}>
          <ToolbarComponent toolbarModel={ToolbarModel.create(config)} document={document}/>
        </Provider>
      </ModalProvider>
    );
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();

    act(() => {
      userEvent.click(screen.getByTestId("tool-select"));
      userEvent.click(screen.getByTestId("tool-text"));
      userEvent.click(screen.getByTestId("delete-button"));
    });

    // act(() => {
    //   fireEvent.dragStart(screen.getByTestId("tool-text"), new DragEvent('dragstart'));
    //   fireEvent.dragEnd(screen.getByTestId("tool-text"), new DragEvent('dragend'));
    // });
  });

});
