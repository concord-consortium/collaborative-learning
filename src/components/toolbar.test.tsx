import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import React from "react";
import { ModalProvider } from "react-modal-hook";
import { Logger } from "../lib/logger";
import { SectionModel } from "../models/curriculum/section";
import { createDocumentModel } from "../models/document/document";
import { DocumentContentModel } from "../models/document/document-content";
import { ProblemDocument } from "../models/document/document-types";
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

  it("renders successfully", async () => {
    const user = userEvent.setup();
    render(
      <ModalProvider>
        <Provider stores={stores}>
          <ToolbarComponent toolbarModel={ToolbarModel.create(config)} document={document}/>
        </Provider>
      </ModalProvider>
    );
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();

    await user.click(screen.getByTestId("tool-select"));
    await user.click(screen.getByTestId("tool-text"));
    await user.click(screen.getByTestId("delete-button"));

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

  // A section toolbar has no document of its own, and the primary workspace document it copies
  // into is not available for a window after load. Buttons must report that accurately: a click
  // on a button whose action cannot run is discarded without feedback.
  describe("section toolbar button state without a primary document", () => {

    const selectedTileId = "selected-tile";

    const copyConfig: IToolbarModelSnapshot = [
      { id: "copyToWorkspace", title: "Copy to Workspace", iconId: "icon-copy-to-workspace-tool",
        isDefault: false, isTileTool: false },
      { id: "copyToDocument", title: "Copy to Document", iconId: "icon-copy-to-document-tool",
        isDefault: false, isTileTool: false },
      { id: "edit", title: "Edit", iconId: "icon-edit-tool", isDefault: false, isTileTool: false }
    ];

    // "none": no primary document key at all, as on first load.
    // "keyOnly": a key has been chosen but the document has not finished loading into the store.
    // "loaded": the document is available and can actually be copied into.
    type PrimaryState = "none" | "keyOnly" | "loaded";

    const renderSectionToolbar = (primary: PrimaryState) => {
      const testStores = specStores();
      const sectionContent = DocumentContentModel.create({
        tileMap: { [selectedTileId]: { id: selectedTileId, content: { type: "Unknown" } } }
      });
      const section = SectionModel.create({
        type: "introduction",
        content: getSnapshot(sectionContent)
      });
      testStores.ui.selectAllTiles([selectedTileId]);

      if (primary !== "none") {
        const primaryDocument = createDocumentModel({
          type: ProblemDocument, uid: "1", key: "primary-doc", createdAt: 1, content: {}
        });
        if (primary === "loaded") {
          testStores.documents.add(primaryDocument);
        }
        // setPrimaryDocument logs a document event, which needs logger context to resolve the user
        Logger.initializeLogger(testStores);
        testStores.persistentUI.problemWorkspace.setPrimaryDocument(primaryDocument);
      }

      render(
        <ModalProvider>
          <Provider stores={testStores}>
            <ToolbarComponent toolbarModel={ToolbarModel.create(copyConfig)} section={section} />
          </Provider>
        </ModalProvider>
      );
    };

    it("disables Copy to Workspace while there is no primary document key", () => {
      renderSectionToolbar("none");
      expect(screen.getByTestId("tool-copytoworkspace")).toHaveAttribute("aria-disabled", "true");
    });

    it("disables Copy to Workspace while the primary document has not finished loading", () => {
      renderSectionToolbar("keyOnly");
      expect(screen.getByTestId("tool-copytoworkspace")).toHaveAttribute("aria-disabled", "true");
    });

    it("enables Copy to Workspace once the primary document is loaded", () => {
      renderSectionToolbar("loaded");
      expect(screen.getByTestId("tool-copytoworkspace")).not.toHaveAttribute("aria-disabled");
    });

    it("leaves Copy to Document enabled, since it does not copy to the primary document", () => {
      renderSectionToolbar("none");
      expect(screen.getByTestId("tool-copytodocument")).not.toHaveAttribute("aria-disabled");
    });

    it("does not treat a section as the primary document when neither has a key", () => {
      renderSectionToolbar("none");
      expect(screen.getByTestId("tool-edit")).not.toHaveAttribute("aria-disabled");
    });
  });

});
