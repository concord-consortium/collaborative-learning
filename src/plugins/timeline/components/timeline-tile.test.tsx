import { render } from "@testing-library/react";
import React from "react";
import { ITileApi } from "../../../components/tiles/tile-api";
import { TileModel } from "../../../models/tiles/tile-model";
import { defaultTimelineContent } from "../models/timeline-content";
import { TimelineComponent } from "./timeline-tile";

// The timeline tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../timeline-registration";

describe("TimelineComponent", () => {
  const content = defaultTimelineContent();
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
    const {container} = render(<TimelineComponent  {...defaultProps} {...{model}}></TimelineComponent>);
    expect(container.querySelector(".timeline-tile")).toBeInTheDocument();
  });

  it("renders an editable tile title", () => {
    const {container} = render(<TimelineComponent  {...defaultProps} {...{model}}></TimelineComponent>);
    expect(container.querySelector(".title-area")).toBeInTheDocument();
  });
});