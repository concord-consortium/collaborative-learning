import { render } from "@testing-library/react";
import React from "react";
import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultFlowchartContent } from "./flowchart-content";
import { FlowchartToolComponent } from "./flowchart-tile";

// The flowchart tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "./flowchart-registration";

describe("FlowchartToolComponent", () => {
  const content = defaultFlowchartContent();
  const model = TileModel.create({content});

  const defaultProps = {
    tileElt: null,
    context: "",
    docId: "",
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
    onRegisterTileApi: (tileApi: ITileApi, facet?: string): void => {
      throw new Error("Function not implemented.");
    },
    onUnregisterTileApi: (facet?: string): void => {
      throw new Error("Function not implemented.");
    }
  };

  it("renders a single rectangle node", () => {
    const {container, getByText} =
      render(<FlowchartToolComponent {...defaultProps} {...{model}} />);
    expect(container.querySelectorAll(".react-flow__node")).toHaveLength(1);
    expect(getByText("Step")).toBeInTheDocument();
  });

  it("does not make the static node a keyboard tab stop", () => {
    const {container} =
      render(<FlowchartToolComponent {...defaultProps} {...{model}} />);
    const node = container.querySelector(".react-flow__node");
    expect(node).not.toHaveAttribute("tabindex");
    expect(node).not.toHaveAttribute("role", "button");
  });

  it("leaves the default action of Space and Backspace alone elsewhere on the page", () => {
    render(<FlowchartToolComponent {...defaultProps} {...{model}} />);
    [" ", "Backspace"].forEach(key => {
      const event = new KeyboardEvent("keydown",
        { key, code: key === " " ? "Space" : key, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  it("gives each instance its own React Flow id", () => {
    const {container} = render(
      <>
        <FlowchartToolComponent {...defaultProps} {...{model}} />
        <FlowchartToolComponent {...defaultProps} {...{model}} />
      </>
    );
    const ids = Array.from(container.querySelectorAll("[data-testid='rf__wrapper']")).map(el => el.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("renders an editable tile title", () => {
    const {container} =
      render(<FlowchartToolComponent {...defaultProps} {...{model}} />);
    expect(container.querySelector(".title-area")).toBeInTheDocument();
  });
});
