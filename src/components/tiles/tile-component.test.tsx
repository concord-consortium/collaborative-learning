import { Provider } from "mobx-react";
import React from "react";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { ITileApiInterface, TileApiInterfaceContext } from "./tile-api";
import { TileComponent } from "./tile-component";
import { specStores } from "../../models/stores/spec-stores";
import { TileModel } from "../../models/tiles/tile-model";
import { UnknownContentModel } from "../../models/tiles/unknown-content";

// required before tile creation
import "../../register-tile-types";

describe("TileComponent", () => {

  it("renders unknown tile successfully", () => {

    const stores = specStores();
    const mockHandleTileResize = jest.fn();
    const mockToolApi: ITileApiInterface = {
      register: jest.fn(),
      unregister: jest.fn(),
      getTileApi: () => ({
        handleTileResize: mockHandleTileResize
      }),
      forEach: jest.fn()
    };
    const tileContentModel = UnknownContentModel.create();
    const toolTileModel = TileModel.create({ content: tileContentModel });

    const onResizeRow = jest.fn();
    const onSetCanAcceptDrop = jest.fn();
    const onRequestRowHeight = jest.fn();

    render(
      <Provider stores={stores}>
        <TileApiInterfaceContext.Provider value={mockToolApi}>
          <TileComponent
            context="context"
            docId="docId"
            documentContent={null}
            isUserResizable={true}
            model={toolTileModel}
            onResizeRow={onResizeRow}
            onSetCanAcceptDrop={onSetCanAcceptDrop}
            onRequestRowHeight={onRequestRowHeight}
            />
        </TileApiInterfaceContext.Provider>
      </Provider>
    );
    expect(screen.getByTestId("tool-tile")).toBeInTheDocument();

    const dragStartEvent = createEvent.dragStart(screen.getByTestId("tool-tile"));
    dragStartEvent.preventDefault = jest.fn();
    act(() => {
      fireEvent.dragStart(screen.getByTestId("tool-tile"), dragStartEvent);
      fireEvent.dragEnd(screen.getByTestId("tool-tile"));
    });
    // TODO: figure out why this doesn't work
    // expect(dragStartEvent.preventDefault).toHaveBeenCalled();
    expect(mockHandleTileResize).toHaveBeenCalled();
  });
});
