import React from "react";
import { getParentOfType, getParent } from "mobx-state-tree";
import { Provider } from "mobx-react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionTileComponent } from "./question-tile";
import { TileModelContext } from "../tile-api";
import { DocumentContentModel, DocumentContentModelType } from "../../../models/document/document-content";
import { registerTileTypes } from "../../../register-tile-types";
import { ITileModel } from "../../../models/tiles/tile-model";
import { QuestionContentModelType } from "../../../models/tiles/question/question-content";
import { specStores } from "../../../models/stores/spec-stores";

registerTileTypes(["Question", "Text"]);

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
  let documentContent: DocumentContentModelType;
  let model: ITileModel;
  let stores: ReturnType<typeof specStores>;

  beforeEach(() => {
    stores = specStores();
    documentContent = DocumentContentModel.create({});
  });

  const createQuestionTile = (title: string) => {
    const newRowTile = documentContent.addTile("Question", { title })!;
    model = documentContent.getTile(newRowTile.tileId)!;
    documentContent = getParentOfType(model, DocumentContentModel) as DocumentContentModelType;
  };

  const createTileProps = () => {
    return {
      model,
      context: "test",
      docId: "doc1",
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
      <Provider stores={stores}>
        <TileModelContext.Provider value={props.model}>
          <QuestionTileComponent {...props} />
        </TileModelContext.Provider>
      </Provider>
    );
  };

  it("renders without crashing", () => {
    createQuestionTile("Test Question");
    assertIsDefined(getParent(model));
    const props = createTileProps();
    renderWithContext(props);
    expect(screen.getByTestId("question-tile")).toBeInTheDocument();
    expect(screen.getByText("Test Question")).toBeInTheDocument();
  });

  it("renders with default title", () => {
    createQuestionTile("Test Question");
    const props = createTileProps();
    renderWithContext(props);
    expect(screen.getByTestId("question-tile")).toBeInTheDocument();
    const titleElement = screen.getByText("Test Question");
    expect(titleElement).toBeInTheDocument();
    expect(titleElement.closest(".editable-tile-title-text")).toBeInTheDocument();
  });

  it("renders with custom title", () => {
    createQuestionTile("My Custom Title");
    const props = createTileProps();
    renderWithContext(props);
    expect(screen.getByTestId("question-tile")).toBeInTheDocument();
    const titleElement = screen.getByText("My Custom Title");
    expect(titleElement).toBeInTheDocument();
    expect(titleElement.closest(".editable-tile-title-text")).toBeInTheDocument();
  });

  it("allows title editing when not locked", () => {
    createQuestionTile("Editable Title");
    const props = createTileProps();
    renderWithContext(props);
    const titleElement = screen.getByText("Editable Title");
    fireEvent.click(titleElement);
    expect(screen.getByDisplayValue("Editable Title")).toBeInTheDocument();
  });

  it("prevents title editing when locked", () => {
    createQuestionTile("Locked Title");
    (model.content as QuestionContentModelType).setLocked(true);
    const props = createTileProps();
    renderWithContext(props);
    const titleElement = screen.getByText("Locked Title");
    fireEvent.click(titleElement);
    expect(screen.queryByDisplayValue("Locked Title")).not.toBeInTheDocument();
  });

  it("toggles title editing based on locked state", () => {
    createQuestionTile("Question Title");
    const props = createTileProps();
    renderWithContext(props);

    // Initially unlocked - should allow editing
    const titleElement = screen.getByText("Question Title");
    fireEvent.click(titleElement);
    expect(screen.getByDisplayValue("Question Title")).toBeInTheDocument();

    // Cancel edit
    fireEvent.keyDown(screen.getByDisplayValue("Question Title"), { key: "Escape" });

    // Lock the title
    (model.content as QuestionContentModelType).setLocked(true);

    // Try to edit again - should not enter edit mode
    fireEvent.click(screen.getByText("Question Title"));
    expect(screen.queryByDisplayValue("Question Title")).not.toBeInTheDocument();
  });
});
