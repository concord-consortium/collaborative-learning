import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultExpressionContent } from "./expression-content";
import { ExpressionToolComponent } from "./expression-tile";
import "./expression-registration";
import("mathlive");

// jest.mock("mathlive", () => {
//   const mathlive = jest.requireActual("mathlive");
//   return {
//     mathlive: jest.fn(),
//   };
// });

describe("ExpressionToolComponent", () => {
  const content = defaultExpressionContent();
  const model = TileModel.create({content});

  const defaultProps = {
    tileElt: null,
    context: "",
    docId: "",
    documentContent: null,
    isUserResizable: true,
    onResizeRow: (e: React.DragEvent<HTMLDivElement>): void => {
      throw new Error("Function not implemented.");
    },
    onSetCanAcceptDrop: (tileId?: string): void => {
      throw new Error("Function not implemented.");
    },
    onRequestTilesOfType: (tileType: string): { id: string; title?: string | undefined; }[] => {
      throw new Error("Function not implemented.");
    },
    onRequestUniqueTitle: (tileId: string): string | undefined => {
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

  it("renders successfully", () => {
    const {getByText} =
      render(<ExpressionToolComponent  {...defaultProps} {...{model}}></ExpressionToolComponent>);
    expect(getByText("Math Expression")).toBeInTheDocument();
  });

  it("updates the text when the model changes", async () => {
    const {getByText, findByText} =
      render(<ExpressionToolComponent  {...defaultProps} {...{model}}></ExpressionToolComponent>);
    expect(getByText("Math Expression")).toBeInTheDocument();

    content.setLatexStr("New Text");

    expect(await findByText("New Text")).toBeInTheDocument();
  });

  it("updates the model when the user types", () => {
    const {getByRole, getByText} =
      render(<ExpressionToolComponent  {...defaultProps} {...{model}}></ExpressionToolComponent>);
    expect(getByText("New Text")).toBeInTheDocument();

    const textBox = getByRole("textbox");
    userEvent.type(textBox, "{selectall}{del}Typed Text");

    expect(textBox).toHaveValue("Typed Text");
    expect(content.latexStr).toBe("Typed Text");
  });
});
