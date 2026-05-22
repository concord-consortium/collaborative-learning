import React from "react";
import { render } from "@testing-library/react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import GeometryToolComponent from "./geometry-tile";
import { ITileApi, TileModelContext } from "../tile-api";
import { TileModel } from "../../../models/tiles/tile-model";
import { specStores } from "../../../models/stores/spec-stores";
import { defaultGeometryContent } from "../../../models/tiles/geometry/geometry-content";

import "../../../models/tiles/geometry/geometry-registration";

// GeometryContentWrapper renders the real JSXGraph board on mount and pulls in
// many heavy dependencies we don't need to exercise here. Stub it so the
// accessibility-focused tests stay fast and deterministic.
jest.mock("./geometry-content-wrapper", () => ({
  GeometryContentWrapper: () => <div data-testid="geometry-content-stub" />,
}));

// TileToolbar registers floating portals we don't need for these tests; stub it.
jest.mock("../../toolbar/tile-toolbar", () => ({
  TileToolbar: () => <div data-testid="tile-toolbar-stub" />,
}));

// TileNavigator pulls in the bar-graph/graph navigator chain; not needed here.
jest.mock("../tile-navigator", () => ({
  TileNavigator: () => null,
}));

function renderGeometryTile(overrides: Partial<React.ComponentProps<typeof GeometryToolComponent>> = {}) {
  const stores = specStores();
  const content = defaultGeometryContent();
  const model = TileModel.create({ content });
  const onRegisterTileApi = jest.fn();
  const onUnregisterTileApi = jest.fn();

  const defaultProps = {
    model,
    tileElt: null,
    context: "",
    docId: "",
    documentContent: null as any as HTMLElement,
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
          <GeometryToolComponent {...defaultProps} {...overrides} />
        </TileModelContext.Provider>
      </Provider>
    </ModalProvider>
  );

  return { ...utils, onRegisterTileApi, onUnregisterTileApi, model };
}

describe("GeometryToolComponent — accessibility scaffolding", () => {
  it("renders an aria-live announcer with data-grid-announcer as a child of the .geometry-tool wrapper", () => {
    const { container } = renderGeometryTile();
    const wrapper = container.querySelector(".geometry-tool");
    expect(wrapper).not.toBeNull();
    const announcer = wrapper?.querySelector(":scope > [data-grid-announcer]");
    expect(announcer).not.toBeNull();
    expect(announcer?.getAttribute("aria-live")).toBe("polite");
    expect(announcer?.classList.contains("visually-hidden")).toBe(true);
  });

  it("registers a tile API with getFocusableElements (focus-trap wired)", () => {
    const { onRegisterTileApi } = renderGeometryTile();
    expect(onRegisterTileApi).toHaveBeenCalled();
    const registeredApi: ITileApi = onRegisterTileApi.mock.calls[0][0];
    expect(registeredApi.getFocusableElements).toBeDefined();
  });

  it("getFocusableElements exposes title and content slot getters", () => {
    const { onRegisterTileApi } = renderGeometryTile();
    const registeredApi: ITileApi = onRegisterTileApi.mock.calls[0][0];
    const elements = registeredApi.getFocusableElements?.();
    expect(elements).toHaveProperty("titleElement");
    expect(elements).toHaveProperty("contentElement");
  });

  it("registered tile API includes the annotation / export proxy methods", () => {
    // Even though GeometryContentWrapper is mocked (so no real implementations
    // are wired into the ref), the proxy still has to expose the key set —
    // that's the contract the hook captures at mount.
    const { onRegisterTileApi } = renderGeometryTile();
    const registeredApi: ITileApi = onRegisterTileApi.mock.calls[0][0];
    expect(registeredApi.exportContentAsTileJson).toBeInstanceOf(Function);
    expect(registeredApi.getObjectBoundingBox).toBeInstanceOf(Function);
    expect(registeredApi.getObjectButtonSVG).toBeInstanceOf(Function);
    expect(registeredApi.isLinked).toBeInstanceOf(Function);
    expect(registeredApi.getLinkedTiles).toBeInstanceOf(Function);
  });

  it("does not register a focus trap in read-only mode (no getFocusableElements)", () => {
    const { onRegisterTileApi } = renderGeometryTile({ readOnly: true });
    expect(onRegisterTileApi).toHaveBeenCalled();
    const registeredApi: ITileApi = onRegisterTileApi.mock.calls[0][0];
    expect(registeredApi.getFocusableElements).toBeUndefined();
    // Annotation/export API still present so sparrows and export keep working.
    expect(registeredApi.exportContentAsTileJson).toBeInstanceOf(Function);
    expect(registeredApi.getObjectBoundingBox).toBeInstanceOf(Function);
  });

  it("still renders the aria-live announcer in read-only mode (screen-reader focus narration)", () => {
    const { container } = renderGeometryTile({ readOnly: true });
    const wrapper = container.querySelector(".geometry-tool");
    const announcer = wrapper?.querySelector(":scope > [data-grid-announcer]");
    expect(announcer).not.toBeNull();
    expect(announcer?.getAttribute("aria-live")).toBe("polite");
  });
});
