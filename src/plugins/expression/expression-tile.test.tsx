import React from "react";
import { queryByText, render, screen } from "@testing-library/react";
import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultExpressionContent } from "./expression-content";
import { ExpressionToolComponent } from "./expression-tile";
import "./expression-registration";

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
      return tileId;
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

  it("renders a math field web component", () => {
    render(<ExpressionToolComponent  {...defaultProps} {...{model}}></ExpressionToolComponent>);
    expect(document.querySelector("math-field")).toBeInTheDocument();
    expect(screen.getByRole("math")).toBeInTheDocument();
  });

  it("renders with a LaTeX string in the math-field value", () => {
    render(<ExpressionToolComponent  {...defaultProps} {...{model}}></ExpressionToolComponent>);
    expect(document.querySelector("math-field")).toHaveAttribute("value", "a=\\pi r^2");
  });

  it("the math field renders content in a shadow dom", () => {
    render(<ExpressionToolComponent  {...defaultProps} {...{model}}></ExpressionToolComponent>);
    const shadowElement = document.querySelector("math-field")?.shadowRoot;
    expect(shadowElement).toBeTruthy();
    expect(shadowElement?.querySelector("span")).toBeInTheDocument();
  });

  // it("renders the pi character in the math field", () => {
  //   const { getByText, container, queryByText } = render(<ExpressionToolComponent  {...defaultProps} {...{model}}></ExpressionToolComponent>);
  //   const mathShadow = document.querySelector("math-field")?.shadowRoot;
  //   const mathEl = container.querySelector("math-field");
  //   const mathSpan = mathEl?.shadowRoot?.querySelector("span.ML__content");
  //   expect(mathSpan).toBeInTheDocument();
  // });
});
