// Mock the useStores hook to provide unit.code
jest.mock("../../hooks/use-stores", () => ({
  useStores: () => ({
    unit: {
      code: "test-unit"
    }
  })
}));

import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
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


describe("AIComponent", () => {
  const content = defaultAIContent();
  const model = TileModel.create({content});

  const defaultProps = {
    tileElt: null,
    context: "",
    docId: "test-doc-content-id",
    documentContent: null,
    isUserResizable: true,
    onResizeRow: (e: React.DragEvent<HTMLDivElement>): void => {
      throw new Error("Function not implemented.");
    },
    onSetCanAcceptDrop: (tileId?: string): void => {
      throw new Error("Function not implemented.");
    },
    onRequestRowHeight: (tileId: string, height?: number, deltaHeight?: number): void => {
      throw new Error("Function not implemented.");
    },
    onRegisterTileApi: (tileApi: ITileApi, facet?: string): void => {
      throw new Error("Function not implemented.");
    },
    onUnregisterTileApi: (facet?: string): void => {
      throw new Error("Function not implemented.");
    }
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

    content.setPrompt("New Text");
    expect(getByText("New Text")).toBeInTheDocument();
    expect(queryByText("Hello World")).not.toBeInTheDocument();
  });

});
