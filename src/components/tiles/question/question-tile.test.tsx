import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionTileComponent } from "./question-tile";
import { defaultQuestionContent } from "../../../models/tiles/question/question-content";
import { TileModel } from "../../../models/tiles/tile-model";
import { TileModelContext } from "../tile-api";

// Register the tile type
import "../../../models/tiles/question/question-registration";

// Mock canvas operations since we're running in jsdom
const mockMeasureText = jest.fn().mockReturnValue(100);
jest.mock("../hooks/use-measure-text", () => ({
  measureText: () => mockMeasureText()
}));

// Mock document context
jest.mock("../../../models/tiles/log/log-tile-document-event", () => ({
  logTileDocumentEvent: jest.fn()
}));

describe("QuestionTileComponent", () => {
  const createTileProps = (content: any, title?: string) => {
    const model = TileModel.create({ content, title });
    return {
      model,
      tileElt: document.createElement("div"),
      context: "test",
      docId: "doc1",
      documentContent: document.createElement("div"),
      isUserResizable: true,
      onRegisterTileApi: () => {},
      onUnregisterTileApi: () => {},
      readOnly: false,
      scale: 1,
      onResizeRow: () => {},
      onSetCanAcceptDrop: () => {},
      onRequestRowHeight: () => {}
    };
  };

  const renderWithContext = (props: any) => {
    return render(
      <TileModelContext.Provider value={props.model}>
        <QuestionTileComponent {...props} />
      </TileModelContext.Provider>
    );
  };

  it("renders without crashing", () => {
    const props = createTileProps(defaultQuestionContent());
    renderWithContext(props);
    expect(screen.getByTestId("question-tile")).toBeInTheDocument();
    expect(screen.getByText("Question Tile")).toBeInTheDocument();
  });

  it("renders with default title", () => {
    const props = createTileProps(defaultQuestionContent());
    renderWithContext(props);
    expect(screen.getByTestId("question-tile")).toBeInTheDocument();
    const titleElement = screen.getByText("Tile Title");
    expect(titleElement).toBeInTheDocument();
    expect(titleElement.closest(".editable-tile-title-text")).toBeInTheDocument();
  });

  it("renders with custom title", () => {
    const props = createTileProps(defaultQuestionContent(), "My Custom Title");
    renderWithContext(props);
    expect(screen.getByTestId("question-tile")).toBeInTheDocument();
    const titleElement = screen.getByText("My Custom Title");
    expect(titleElement).toBeInTheDocument();
    expect(titleElement.closest(".editable-tile-title-text")).toBeInTheDocument();
  });

  it("allows title editing when not locked", () => {
    const content = defaultQuestionContent();
    const props = createTileProps(content, "Editable Title");
    renderWithContext(props);
    const titleElement = screen.getByText("Editable Title");
    fireEvent.click(titleElement);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("prevents title editing when locked", () => {
    const content = defaultQuestionContent();
    content.setLocked(true);
    const props = createTileProps(content, "Locked Title");
    renderWithContext(props);
    const titleElement = screen.getByText("Locked Title");
    fireEvent.click(titleElement);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("toggles title editing based on locked state", () => {
    const content = defaultQuestionContent();
    const props = createTileProps(content, "Toggle Test Title");
    renderWithContext(props);

    // Initially unlocked - should allow editing
    const titleElement = screen.getByText("Toggle Test Title");
    fireEvent.click(titleElement);
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    // Cancel edit
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });

    // Lock the title
    content.setLocked(true);

    // Try to edit again - should not enter edit mode
    fireEvent.click(screen.getByText("Toggle Test Title"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
