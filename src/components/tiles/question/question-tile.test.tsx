import React from "react";
import { render, screen } from "@testing-library/react";
import { QuestionTileComponent } from "./question-tile";
import { defaultQuestionContent } from "../../../models/tiles/question/question-content";
import { TileModel } from "../../../models/tiles/tile-model";
import { TileModelContext } from "../tile-api";

// Register the tile type
import "../../../models/tiles/question/question-registration";

// Mock canvas operations since we're running in jsdom
const mockMeasureText = jest.fn().mockReturnValue({ width: 100, height: 20 });
jest.mock("../hooks/use-measure-text", () => ({
  measureText: () => mockMeasureText()
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
});
