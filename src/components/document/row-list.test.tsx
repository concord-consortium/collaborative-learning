import React from "react";
import { render, waitFor } from "@testing-library/react";
import { Provider } from "mobx-react";
import { RowListComponent } from "./row-list";
import { DocumentContentModel } from "../../models/document/document-content";
import { createSingleTileContent } from "../../utilities/test-utils";
import { specStores } from "../../models/stores/spec-stores";

import "../../models/tiles/text/text-registration";

describe("RowListComponent", () => {
  let documentContent: any;
  let rowRefs: any[];
  let stores: any;

  beforeEach(() => {
    documentContent = DocumentContentModel.create(createSingleTileContent({
      type: "Text",
      format: "html",
      text: ["<p>Test content</p>"]
    }));
    rowRefs = [];
    stores = specStores();
  });

  it("renders rows correctly", async () => {
    const { container } = render(
      <Provider stores={stores}>
        <RowListComponent
          documentContentModel={documentContent}
          rowListModel={documentContent}
          documentContent={null}
          context="test"
          rowRefs={rowRefs}
        />
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
    const emptyContent = DocumentContentModel.create({});
    const { container } = render(
      <Provider stores={stores}>
        <RowListComponent
          documentContentModel={emptyContent}
          rowListModel={emptyContent}
          documentContent={null}
          context="test"
          rowRefs={rowRefs}
        />
      </Provider>
    );

    const rows = container.getElementsByClassName("tile-row");
    expect(rows.length).toBe(0);
  });

  it("applies drop highlight correctly", () => {
    const { container, rerender } = render(
      <Provider stores={stores}>
        <RowListComponent
          documentContentModel={documentContent}
          rowListModel={documentContent}
          documentContent={null}
          context="test"
          rowRefs={rowRefs}
          dropRowInfo={{
            rowDropIndex: 0,
            rowDropLocation: "top",
            rowInsertIndex: 0
          }}
        />
      </Provider>
    );

    // Check for drop feedback element with correct classes
    const dropFeedback = container.querySelector(".drop-feedback.show.top");
    expect(dropFeedback).toBeInTheDocument();

    // Test bottom highlight
    rerender(
      <Provider stores={stores}>
        <RowListComponent
          documentContentModel={documentContent}
          rowListModel={documentContent}
          documentContent={null}
          context="test"
          rowRefs={rowRefs}
          dropRowInfo={{
            rowDropIndex: 0,
            rowDropLocation: "bottom",
            rowInsertIndex: 0
          }}
        />
      </Provider>
    );

    const bottomDropFeedback = container.querySelector(".drop-feedback.show.bottom");
    expect(bottomDropFeedback).toBeInTheDocument();
  });

  it("handles highlightPendingDropLocation", () => {
    const { container } = render(
      <Provider stores={stores}>
        <RowListComponent
          documentContentModel={documentContent}
          rowListModel={documentContent}
          documentContent={null}
          context="test"
          rowRefs={rowRefs}
          highlightPendingDropLocation={0}
        />
      </Provider>
    );

    const dropFeedback = container.querySelector(".drop-feedback.show.top");
    expect(dropFeedback).toBeInTheDocument();
  });

  it("maintains row refs", () => {
    render(
      <Provider stores={stores}>
        <RowListComponent
          documentContentModel={documentContent}
          rowListModel={documentContent}
          documentContent={null}
          context="test"
          rowRefs={rowRefs}
        />
      </Provider>
    );

    expect(rowRefs.length).toBe(1);
    expect(rowRefs[0]).toBeDefined();
  });
});
