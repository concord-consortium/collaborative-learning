import React from "react";
import { render } from "@testing-library/react";
import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultExpressionContent } from "./expression-content";
import { ExpressionToolComponent } from "./expression-tile";
import "./expression-registration";

// mock Logger calls
const mockLogTileDocumentEvent = jest.fn();
jest.mock("../../models/tiles/log/log-tile-document-event", () => ({
  logTileDocumentEvent: (...args: any[]) => mockLogTileDocumentEvent()
}));

jest.mock("../../hooks/use-stores", () => ({
  useUIStore: () => ({
    selectedTileIds: []
  })
}));

// mock out mathlive to prevent attempt to render shadow dom
jest.mock("mathlive", () => jest.fn());


describe("ExpressionToolComponent", () => {
  const content = defaultExpressionContent();
  const model = TileModel.create({ content });
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
      // throw new Error("Function not implemented.");
      // () => null;
    },
    onUnregisterTileApi: (facet?: string): void => {
      // throw new Error("Function not implemented.");
    }
  };

  it("renders a math field web component", () => {
    render(<ExpressionToolComponent  {...defaultProps} {...{ model }}></ExpressionToolComponent>);
    expect(document.querySelector("math-field")).toBeInTheDocument();
  });

  it("loads default LaTeX string in the math-field value", () => {
    render(<ExpressionToolComponent  {...defaultProps} {...{ model }}></ExpressionToolComponent>);
    expect(document.querySelector("math-field")).toHaveAttribute("value", "a=\\pi r^2");
  });

  // TODO, get shadow dom to render in test context (below is a failed attempt)
  // Below is a failed attempt to load mathlive and render the shadow dom

  // it("renders the pi character in the math field", () => {
  //   import("mathlive").then((mathlive) => {
  //     const { container } = render(
  //       <ExpressionToolComponent  {...defaultProps} {...{model}}></ExpressionToolComponent>
  //     );
  //     const mathField = container.querySelector("math-field");
  //     const shadow = mathField?.shadowRoot;
  //     console.log(shadow); // null
  //   });
  // });
});
