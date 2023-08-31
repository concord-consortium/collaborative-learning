import React from "react";
import { render, screen } from "@testing-library/react";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultNumberlineContent } from "./numberline-content";
import { NumberlineToolComponent } from "./numberline-tile";

// The numberline tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "./numberline-registration";

jest.mock("../../hooks/use-stores", () => ({
  useUIStore: () => ({
    selectedTileIds: []
  })
}));

// mock Logger calls
const mockLogTileDocumentEvent = jest.fn();
jest.mock("../../models/tiles/log/log-tile-document-event", () => ({
  logTileDocumentEvent: (...args: any[]) => mockLogTileDocumentEvent()
}));


describe("NumberlineToolComponent", () => {
  const content = defaultNumberlineContent();
  const model = TileModel.create({content});
  render(<div className="document-content" data-testid="document-content"/>);
  const documentContent = screen.getByTestId("document-content");

  const defaultProps = {
    tileElt: null,
    context: "",
    docId: "",
    documentContent,
    isUserResizable: true,
    readOnly: false,
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
    render(
      <ModalProvider>
        <NumberlineToolComponent  {...defaultProps} {...{model}}></NumberlineToolComponent>
      </ModalProvider>
    );
    expect(screen.getByTestId("numberline-tool")).toBeInTheDocument();
    });
});
