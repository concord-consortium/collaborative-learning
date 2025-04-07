import React from "react";
import { render, screen } from "@testing-library/react";
import { QuestionTileComponent } from "./question-tile";
import { QuestionContentModel } from "../../../models/tiles/question/question-content";
import { TileModel } from "../../../models/tiles/tile-model";

// Register the tile type
import "../../../models/tiles/question/question-registration";

describe("QuestionTileComponent", () => {
  it("renders without crashing", () => {
    const content = QuestionContentModel.create({
      type: "Question"
    });
    const model = TileModel.create({ content });

    const props = {
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

    render(<QuestionTileComponent {...props} />);
    expect(screen.getByTestId("question-tile")).toBeInTheDocument();
    expect(screen.getByText("Question Tile")).toBeInTheDocument();
  });
});
