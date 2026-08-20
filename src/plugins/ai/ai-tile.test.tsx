// Mock the useStores hook to provide unit.code and appConfig
const mockStores = {
  unit: { code: "test-unit" },
  appConfig: {
    getSetting: jest.fn((key: string, category: string) => {
      if (key === "systemPrompt" && category === "ai") {
        return "You are a helpful AI assistant.";
      }
      return undefined;
    })
  },
  ui: {
    selectedTileIds: [] as string[],
    isSelectedTile: () => false,
  },
  documents: { getDocument: () => undefined },
  networkDocuments: { getDocument: () => undefined },
};
jest.mock("../../hooks/use-stores", () => ({
  useStores: () => mockStores,
  useUIStore: () => mockStores.ui,
  useSettingFromStores: (key: string, group?: string) => mockStores.appConfig.getSetting(key, group ?? ""),
}));

import { act, fireEvent, render } from "@testing-library/react";
import React from "react";
import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { logTileChangeEvent } from "../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../lib/logger-types";
import { defaultAIContent } from "./ai-content";
import { AIComponent } from "./ai-tile";

// The starter tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "./ai-registration";

jest.mock("../../hooks/use-firebase-function", () => ({
  useFirebaseFunction: jest.fn(() => jest.fn().mockResolvedValue({
    data: { text: "Mocked customized content" }
  }))
}));

// Mock the useUserContext hook to avoid user context errors during testing
jest.mock("../../hooks/use-user-context", () => ({
  useUserContext: jest.fn(() => ({
    user: { id: "test-user-id" },
    isAuthenticated: true,
    isTeacher: false,
    isStudent: true
  }))
}));

jest.mock("mobx-state-tree", () => ({
  ...jest.requireActual("mobx-state-tree"),
  getParentOfType: jest.fn((model: any, type: any) => {
    // Return a mock DocumentContentModel with the necessary properties
    return {
      key: "test-document-key",
      getProperty: jest.fn(),
      title: "Test Document"
    };
  })
}));

jest.mock("../../models/document/document-utils", () => ({
  getDocumentIdentifier: jest.fn(() => "test-doc-content-id")
}));

// Logger.stores is uninitialized in this component test; mock the change logger so setPrompt/setText
// don't crash when the AI content logs changes.
jest.mock("../../models/tiles/log/log-tile-change-event", () => ({ logTileChangeEvent: jest.fn() }));

describe("AIComponent", () => {
  const content = defaultAIContent();
  const model = TileModel.create({content});

  const defaultProps = {
    tileElt: null,
    context: "",
    docId: "test-doc-content-id",
    documentContent: null,
    isUserResizable: true,
    onResizeRow: (e: React.DragEvent<HTMLElement>): void => {
      throw new Error("Function not implemented.");
    },
    onSetCanAcceptDrop: (tileId?: string): void => {
      throw new Error("Function not implemented.");
    },
    onRequestRowHeight: (tileId: string, height?: number, deltaHeight?: number): void => {
      throw new Error("Function not implemented.");
    },
    onRegisterTileApi: (tileApi: ITileApi, facet?: string): void => {},
    onUnregisterTileApi: (facet?: string): void => {}
  };

  it("renders successfully with prompt showing", () => {
    content.setPrompt("Hello World");
    const {getByText} =
      render(<AIComponent  {...defaultProps} {...{model}}></AIComponent>);
    expect(getByText("Hello World")).toBeInTheDocument();
  });

  it("updates the prompt text when the model changes", async () => {
    content.setPrompt("Hello World");
    const {getByText, queryByText} =
      render(<AIComponent  {...defaultProps} {...{model}}></AIComponent>);
    expect(getByText("Hello World")).toBeInTheDocument();

    act(() => {
      content.setPrompt("New Text");
    });
    expect(getByText("New Text")).toBeInTheDocument();
    expect(queryByText("Hello World")).not.toBeInTheDocument();
  });

  // Exercises the actual focus/blur wiring (the regression risk), not just the model helper: a blur
  // logs setPrompt only when the prompt changed since focus.
  it("logs AI_TOOL_CHANGE on prompt blur, only when the prompt changed", () => {
    const aiContent = defaultAIContent();
    const aiModel = TileModel.create({ content: aiContent });
    const { container } = render(<AIComponent {...defaultProps} model={aiModel} />);
    const promptTextarea = container.querySelector(".prompt-form textarea") as HTMLTextAreaElement;
    expect(promptTextarea).toBeTruthy();

    (logTileChangeEvent as jest.Mock).mockClear();
    // Focus then blur with no edit → no log.
    fireEvent.focus(promptTextarea);
    fireEvent.blur(promptTextarea);
    expect(logTileChangeEvent).not.toHaveBeenCalled();

    // Focus, edit, blur → one log carrying the real tile id.
    fireEvent.focus(promptTextarea);
    fireEvent.change(promptTextarea, { target: { value: "ask the AI" } });
    fireEvent.blur(promptTextarea);
    expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.AI_TOOL_CHANGE, {
      tileId: aiModel.id, operation: "setPrompt", change: { prompt: "ask the AI" }
    });
  });

});
