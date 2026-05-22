import React from "react";
import { render } from "@testing-library/react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import { GraphWrapperComponent } from "../graph-wrapper-component";
import { ITileApi, TileModelContext } from "../../../../components/tiles/tile-api";
import { TileModel } from "../../../../models/tiles/tile-model";
import { specStores } from "../../../../models/stores/spec-stores";
import { createGraphModel } from "../../models/graph-model";

import "../../graph-registration";

jest.mock("../graph-component", () => ({
  GraphComponent: () => <div data-testid="graph-component-stub" />,
}));

function renderWrapper(overrides: Partial<React.ComponentProps<typeof GraphWrapperComponent>> = {}) {
  const stores = specStores();
  const content = createGraphModel();
  const model = TileModel.create({ content });
  const onRegisterTileApi = jest.fn();
  const onUnregisterTileApi = jest.fn();

  const defaultProps = {
    model,
    tileElt: null as HTMLElement | null,
    context: "",
    docId: "",
    documentContent: null as unknown as HTMLElement,
    isUserResizable: true,
    navigatorAllowed: false,
    readOnly: false,
    onResizeRow: jest.fn(),
    onSetCanAcceptDrop: jest.fn(),
    onRequestRowHeight: jest.fn(),
    onRegisterTileApi,
    onUnregisterTileApi,
  };

  const utils = render(
    <ModalProvider>
      <Provider stores={stores}>
        <TileModelContext.Provider value={model}>
          <GraphWrapperComponent {...defaultProps} {...overrides} />
        </TileModelContext.Provider>
      </Provider>
    </ModalProvider>
  );

  return { ...utils, onRegisterTileApi, onUnregisterTileApi, model };
}

describe("GraphWrapperComponent — focus trap wiring", () => {
  it("registers a tile API with getFocusableElements", () => {
    const { onRegisterTileApi } = renderWrapper();
    expect(onRegisterTileApi).toHaveBeenCalled();
    const registeredApi: ITileApi = onRegisterTileApi.mock.calls[0][0];
    expect(registeredApi.getFocusableElements).toBeDefined();
  });

  it("getFocusableElements exposes title and content slot getters", () => {
    const { onRegisterTileApi } = renderWrapper();
    const registeredApi: ITileApi = onRegisterTileApi.mock.calls[0][0];
    const elements = registeredApi.getFocusableElements?.();
    expect(elements).toHaveProperty("titleElement");
    expect(elements).toHaveProperty("contentElement");
    expect(elements).toHaveProperty("paletteElement");
    expect(elements?.focusContent).toBeInstanceOf(Function);
  });

  it("registered tile API includes exportContentAsTileJson and annotation methods", () => {
    const { onRegisterTileApi } = renderWrapper();
    const registeredApi: ITileApi = onRegisterTileApi.mock.calls[0][0];
    expect(registeredApi.exportContentAsTileJson).toBeInstanceOf(Function);
    expect(registeredApi.getObjectBoundingBox).toBeInstanceOf(Function);
    expect(registeredApi.getObjectButtonSVG).toBeInstanceOf(Function);
    expect(registeredApi.getObjectDefaultOffsets).toBeInstanceOf(Function);
    expect(registeredApi.getObjectNodeRadii).toBeInstanceOf(Function);
  });

  it("does not register a focus trap in read-only mode", () => {
    const { onRegisterTileApi } = renderWrapper({ readOnly: true });
    // Read-only graphs still register the annotation / export API directly,
    // but the registered tile API must NOT carry getFocusableElements — that's
    // the signal that no focus trap is wired.
    expect(onRegisterTileApi).toHaveBeenCalled();
    const registeredApi: ITileApi = onRegisterTileApi.mock.calls[0][0];
    expect(registeredApi.getFocusableElements).toBeUndefined();
    // Annotation/export API still present so sparrows and export keep working.
    expect(registeredApi.exportContentAsTileJson).toBeInstanceOf(Function);
    expect(registeredApi.getObjectBoundingBox).toBeInstanceOf(Function);
  });

  it("getFocusableElements paletteElement resolves to the .multi-legend container when present", () => {
    // GraphComponent is mocked in this file, so MultiLegend doesn't render. We
    // simulate the legend's presence by passing a tileElt with a child div carrying
    // the .multi-legend class — the same DOM contract `getPaletteElement` queries.
    const tileElt = document.createElement("div");
    const legendDiv = document.createElement("div");
    legendDiv.className = "multi-legend";
    tileElt.appendChild(legendDiv);

    const { onRegisterTileApi } = renderWrapper({ tileElt });
    const registeredApi: ITileApi = onRegisterTileApi.mock.calls[0][0];
    const elements = registeredApi.getFocusableElements?.();
    expect(elements?.paletteElement).toBe(legendDiv);
  });

  it("getFocusableElements paletteElement is undefined when the legend is absent", () => {
    // No tileElt → no .multi-legend ancestor for the palette getter to query.
    const { onRegisterTileApi } = renderWrapper();
    const registeredApi: ITileApi = onRegisterTileApi.mock.calls[0][0];
    const elements = registeredApi.getFocusableElements?.();
    expect(elements?.paletteElement).toBeUndefined();
  });
});
