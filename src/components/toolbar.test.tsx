import { act, fireEvent, render, screen } from "@testing-library/react";
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
import "../register-tile-types";

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

  it("has correct ARIA roles and attributes", () => {
    render(
      <ModalProvider>
        <Provider stores={stores}>
          <ToolbarComponent
            toolbarModel={ToolbarModel.create(config)}
            document={document}
            ariaLabel="Workspace toolbar"
          />
        </Provider>
      </ModalProvider>
    );
    const toolbar = screen.getByTestId("toolbar");
    expect(toolbar).toHaveAttribute("role", "toolbar");
    expect(toolbar).toHaveAttribute("aria-label", "Workspace toolbar");
    expect(toolbar).toHaveAttribute("aria-orientation", "vertical");

    const groups = toolbar.querySelectorAll("[role='group']");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveAttribute("aria-label", "Tile tools");
    expect(groups[1]).toHaveAttribute("aria-label", "Playback controls");
  });

  describe("keyboard navigation", () => {

    const renderToolbar = () => {
      render(
        <ModalProvider>
          <Provider stores={stores}>
            <ToolbarComponent toolbarModel={ToolbarModel.create(config)} document={document} />
          </Provider>
        </ModalProvider>
      );
      const toolbar = screen.getByTestId("toolbar");
      const buttons = Array.from(toolbar.querySelectorAll("button")) as HTMLElement[];
      return { toolbar, buttons };
    };

    it("sets first button to tabIndex=0 and others to tabIndex=-1", () => {
      const { buttons } = renderToolbar();
      expect(buttons.length).toBeGreaterThanOrEqual(3);
      expect(buttons[0]).toHaveAttribute("tabindex", "0");
      buttons.slice(1).forEach(btn => {
        expect(btn).toHaveAttribute("tabindex", "-1");
      });
    });

    it("arrow keys move focus between buttons", () => {
      const { toolbar, buttons } = renderToolbar();
      buttons[0].focus();
      expect(window.document.activeElement).toBe(buttons[0]);

      fireEvent.keyDown(toolbar, { key: "ArrowDown" });
      expect(window.document.activeElement).toBe(buttons[1]);
      expect(buttons[0]).toHaveAttribute("tabindex", "-1");
      expect(buttons[1]).toHaveAttribute("tabindex", "0");

      fireEvent.keyDown(toolbar, { key: "ArrowUp" });
      expect(window.document.activeElement).toBe(buttons[0]);
      expect(buttons[0]).toHaveAttribute("tabindex", "0");
      expect(buttons[1]).toHaveAttribute("tabindex", "-1");
    });

    it("Home and End move to first and last buttons", () => {
      const { toolbar, buttons } = renderToolbar();
      const lastButton = buttons[buttons.length - 1];

      buttons[0].focus();
      fireEvent.keyDown(toolbar, { key: "End" });
      expect(window.document.activeElement).toBe(lastButton);
      expect(lastButton).toHaveAttribute("tabindex", "0");

      fireEvent.keyDown(toolbar, { key: "Home" });
      expect(window.document.activeElement).toBe(buttons[0]);
      expect(buttons[0]).toHaveAttribute("tabindex", "0");
    });

    it("does not wrap around at edges", () => {
      const { toolbar, buttons } = renderToolbar();
      const lastButton = buttons[buttons.length - 1];

      // At the beginning
      buttons[0].focus();
      fireEvent.keyDown(toolbar, { key: "ArrowUp" });
      expect(window.document.activeElement).toBe(buttons[0]);

      // At the end
      fireEvent.keyDown(toolbar, { key: "End" });
      fireEvent.keyDown(toolbar, { key: "ArrowDown" });
      expect(window.document.activeElement).toBe(lastButton);
    });
  });

});
