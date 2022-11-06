import { Provider } from "mobx-react";
import React from "react";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { IToolApiInterface, ToolApiInterfaceContext } from "./tile-api";
import { ToolTileComponent } from "./tile-component";
import { specStores } from "../../models/stores/spec-stores";
import { ToolTileModel } from "../../models/tiles/tile-model";
import { UnknownContentModel } from "../../models/tiles/tile-types";

// required before tile creation
import "../../register-tiles";

describe("ToolTile Component", () => {

  it("renders unknown tile successfully", () => {

    const stores = specStores();
    const mockHandleTileResize = jest.fn();
    const mockToolApi: IToolApiInterface = {
      register: jest.fn(),
      unregister: jest.fn(),
      getToolApi: () => ({
        handleTileResize: mockHandleTileResize
      }),
      forEach: jest.fn()
    };
    const tileContentModel = UnknownContentModel.create();
    const toolTileModel = ToolTileModel.create({ content: tileContentModel });

    const onResizeRow = jest.fn();
    const onSetCanAcceptDrop = jest.fn();
    const onRequestTilesOfType = jest.fn();
    const onRequestUniqueTitle = jest.fn();
    const onRequestRowHeight = jest.fn();

    render(
      <Provider stores={stores}>
        <ToolApiInterfaceContext.Provider value={mockToolApi}>
          <ToolTileComponent
            context="context"
            docId="docId"
            documentContent={null}
            isUserResizable={true}
            model={toolTileModel}
            onResizeRow={onResizeRow}
            onSetCanAcceptDrop={onSetCanAcceptDrop}
            onRequestTilesOfType={onRequestTilesOfType}
            onRequestUniqueTitle={onRequestUniqueTitle}
            onRequestRowHeight={onRequestRowHeight}
            />
        </ToolApiInterfaceContext.Provider>
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
