import React from "react";
import { Provider } from "mobx-react";
import { render } from "@testing-library/react";
import { TileComponent } from "./tile-component";
import { TileApiInterface, TileApiInterfaceContext } from "./tile-api";
import { getContainingTileNode, getTileIdFromNode, getTileNode, getTileNodes } from "./tile-dom";
import { DocumentContentModel } from "../../models/document/document-content";
import { specStores } from "../../models/stores/spec-stores";
import { registerTileTypes } from "../../register-tile-types";

registerTileTypes(["Question", "Text"]);

// jsdom has no canvas, and tile creation would otherwise log through the document event helpers
const mockMeasureText = jest.fn().mockReturnValue(100);
jest.mock("./hooks/use-measure-text", () => ({ measureText: () => mockMeasureText() }));
jest.mock("../../models/tiles/log/log-tile-document-event", () => ({ logTileDocumentEvent: jest.fn() }));

// Keyboard navigation, drag/pick-up targeting, and visibility logging all find tiles by querying the
// DOM for what TileComponent renders. These tests hold the two sides of that contract together: if
// the class or id attribute in tile-dom.ts stops matching the markup, they fail here rather than
// silently disabling those features. See tile-dom.ts.
describe("the rendered tile DOM contract", () => {
  const renderTile = (tileType: string) => {
    (window as any).getSelection = () => ({});
    const content = DocumentContentModel.create({});
    const rowTile = content.addTile(tileType)!;
    const model = content.getTile(rowTile.tileId)!;
    const { container } = render(
      <Provider stores={specStores()}>
        <TileApiInterfaceContext.Provider value={new TileApiInterface()}>
          <div className="document-content">
            <TileComponent
              context="test"
              docId="doc1"
              documentContent={null}
              isUserResizable={false}
              model={model}
              onResizeRow={jest.fn()}
              onSetCanAcceptDrop={jest.fn()}
              onRequestRowHeight={jest.fn()}
            />
          </div>
        </TileApiInterfaceContext.Provider>
      </Provider>
    );
    return { container, model };
  };

  it("renders a tile that the shared queries find, carrying its model id", () => {
    const { container, model } = renderTile("Text");
    const nodes = getTileNodes(container);
    expect(nodes).toHaveLength(1);
    expect(getTileIdFromNode(nodes[0])).toBe(model.id);
    expect(getTileNode(container, model.id)).toBe(nodes[0]);
  });

  it("resolves a tile nested in a container tile to that container", () => {
    // A Question tile renders its contents as tiles in their own right, so the query matches the
    // container and its contents; visibility logging tells them apart by their container.
    const { container, model } = renderTile("Question");
    const [containerNode, ...nestedNodes] = getTileNodes(container);
    expect(getTileIdFromNode(containerNode)).toBe(model.id);
    expect(getContainingTileNode(containerNode)).toBeUndefined();
    expect(nestedNodes.length).toBeGreaterThan(0);
    nestedNodes.forEach(node => {
      expect(getContainingTileNode(node)).toBe(containerNode);
    });
  });
});
