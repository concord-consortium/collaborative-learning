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

function renderReadOnlyWrapper(overrides: Partial<React.ComponentProps<typeof GraphWrapperComponent>> = {}) {
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
    readOnly: true,
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

describe("Read-only XY Plot — focus trap wiring", () => {
  it("does not register a focus trap when readOnly is true", () => {
    const { onRegisterTileApi } = renderReadOnlyWrapper();
    expect(onRegisterTileApi).toHaveBeenCalled();
    const registeredApi: ITileApi = onRegisterTileApi.mock.calls[0][0];
    // The presence of getFocusableElements is the trap's signature — absent it,
    // useClueAccessibility took the `type: "region"` branch and did not wire a trap.
    expect(registeredApi.getFocusableElements).toBeUndefined();
  });

  it("still registers the annotation / export API in read-only mode (so sparrows + export work)", () => {
    const { onRegisterTileApi } = renderReadOnlyWrapper();
    const registeredApi: ITileApi = onRegisterTileApi.mock.calls[0][0];
    expect(registeredApi.exportContentAsTileJson).toBeInstanceOf(Function);
    expect(registeredApi.getObjectBoundingBox).toBeInstanceOf(Function);
    expect(registeredApi.getObjectButtonSVG).toBeInstanceOf(Function);
  });

  it("renders the aria-live announcer container even in read-only mode", () => {
    const { container } = renderReadOnlyWrapper();
    const announcer = container.querySelector("[data-graph-announcer]");
    expect(announcer).not.toBeNull();
    expect(announcer?.getAttribute("aria-live")).toBe("polite");
  });
});
