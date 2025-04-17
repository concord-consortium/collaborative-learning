import React from "react";
import { render, waitFor } from "@testing-library/react";
import { Provider } from "mobx-react";
import { RowListComponent } from "./row-list";
import { DocumentContentModel } from "../../models/document/document-content";
import { createSingleTileContent } from "../../utilities/test-utils";
import { specStores } from "../../models/stores/spec-stores";
import { DropRowContext } from "./drop-row-context";
import { RowRefsContext } from "./row-refs-context";
import { TileApiInterfaceContext, ITileApiInterface } from "../tiles/tile-api";
import { createDocumentModel } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";

import "../../models/tiles/text/text-registration";

describe("RowListComponent", () => {
  let emptyContent: any;
  let documentContent: any;
  let stores: any;
  let mockTileApiInterface: ITileApiInterface;
  let docModel: any;

  beforeEach(() => {
    emptyContent = DocumentContentModel.create({});

    documentContent = DocumentContentModel.create(createSingleTileContent({
      type: "Text",
      format: "html",
      text: ["<p>Test content</p>"]
    }));

    // Create a proper document model hierarchy
    docModel = createDocumentModel({
      uid: "1",
      type: ProblemDocument,
      key: "test",
      content: documentContent
    });

    // Enable the tree monitor
    docModel.treeMonitor!.enabled = true;

    stores = specStores();
    mockTileApiInterface = {
      register: () => {},
      unregister: () => {},
      getTileApi: () => ({}),
      forEach: () => {}
    };
  });

  it("renders rows correctly", async () => {
    const { container } = render(
      <Provider stores={stores}>
        <TileApiInterfaceContext.Provider value={mockTileApiInterface}>
          <DropRowContext.Provider value={undefined}>
            <RowRefsContext.Provider value={{ addRowRef: () => {} }}>
              <RowListComponent
                rowListModel={documentContent}
                documentContent={documentContent}
                context="test"
                documentId="test-doc"
                docId={documentContent.contentId}
              />
            </RowRefsContext.Provider>
          </DropRowContext.Provider>
        </TileApiInterfaceContext.Provider>
      </Provider>
    );

    // Check that we have the correct number of rows
    const rows = container.getElementsByClassName("tile-row");
    expect(rows.length).toBe(1);

    // Find the text content within the tile
    await waitFor(() => {
      const tileWrapper = container.querySelector(".text-tool-wrapper");
      expect(tileWrapper).toBeInTheDocument();
      const tileContent = tileWrapper?.querySelector(".text-tool-editor");
      expect(tileContent).toBeInTheDocument();
      expect(tileContent?.textContent).toContain("Test content");
    });
  });

  it("handles empty content", () => {
    // Create a proper document model hierarchy for empty content
    createDocumentModel({
      uid: "1",
      type: ProblemDocument,
      key: "test",
      content: emptyContent
    });

    const { container } = render(
      <Provider stores={stores}>
        <TileApiInterfaceContext.Provider value={mockTileApiInterface}>
          <DropRowContext.Provider value={undefined}>
            <RowRefsContext.Provider value={{ addRowRef: () => {} }}>
              <RowListComponent
                rowListModel={emptyContent}
                documentContent={documentContent}
                context="test"
                documentId="test-doc"
                docId={documentContent.contentId}
              />
            </RowRefsContext.Provider>
          </DropRowContext.Provider>
        </TileApiInterfaceContext.Provider>
      </Provider>
    );

    const rows = container.getElementsByClassName("tile-row");
    expect(rows.length).toBe(0);
  });

  it("applies drop highlight correctly", () => {
    const { container, rerender } = render(
      <Provider stores={stores}>
        <TileApiInterfaceContext.Provider value={mockTileApiInterface}>
          <DropRowContext.Provider value={{
            rowDropId: "row1",
            rowDropLocation: "top",
            rowInsertIndex: 0
          }}>
            <RowRefsContext.Provider value={{ addRowRef: () => {} }}>
              <RowListComponent
                rowListModel={documentContent}
                documentContent={documentContent}
                context="test"
                documentId="test-doc"
                docId={documentContent.contentId}
              />
            </RowRefsContext.Provider>
          </DropRowContext.Provider>
        </TileApiInterfaceContext.Provider>
      </Provider>
    );

    // Check for drop feedback element with correct classes
    const dropFeedback = container.querySelector(".drop-feedback.show.top");
    expect(dropFeedback).toBeInTheDocument();

    // Test bottom highlight
    rerender(
      <Provider stores={stores}>
        <TileApiInterfaceContext.Provider value={mockTileApiInterface}>
          <DropRowContext.Provider value={{
            rowDropId: "row1",
            rowDropLocation: "bottom",
            rowInsertIndex: 0
          }}>
            <RowRefsContext.Provider value={{ addRowRef: () => {} }}>
              <RowListComponent
                rowListModel={documentContent}
                documentContent={documentContent}
                context="test"
                documentId="test-doc"
                docId={documentContent.contentId}
              />
            </RowRefsContext.Provider>
          </DropRowContext.Provider>
        </TileApiInterfaceContext.Provider>
      </Provider>
    );

    const bottomDropFeedback = container.querySelector(".drop-feedback.show.bottom");
    expect(bottomDropFeedback).toBeInTheDocument();
  });

  it("handles highlightPendingDropLocation", () => {
    const { container } = render(
      <Provider stores={stores}>
        <TileApiInterfaceContext.Provider value={mockTileApiInterface}>
          <DropRowContext.Provider value={undefined}>
            <RowRefsContext.Provider value={{ addRowRef: () => {} }}>
              <RowListComponent
                rowListModel={documentContent}
                documentContent={documentContent}
                context="test"
                documentId="test-doc"
                docId={documentContent.contentId}
                highlightPendingDropLocation={0}
              />
            </RowRefsContext.Provider>
          </DropRowContext.Provider>
        </TileApiInterfaceContext.Provider>
      </Provider>
    );

    const dropFeedback = container.querySelector(".drop-feedback.show.top");
    expect(dropFeedback).toBeInTheDocument();
  });
});
