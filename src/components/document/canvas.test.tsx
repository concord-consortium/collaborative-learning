import { render, screen } from "@testing-library/react";
import React from "react";
import { Provider } from "mobx-react";
import { CanvasComponent } from "./canvas";
import { DocumentModel } from "../../models/document/document";
import { DocumentContentModel } from "../../models/document/document-content";
import { ProblemDocument } from "../../models/document/document-types";
import { specStores } from "../../models/stores/spec-stores";
import { createSingleTileContent } from "../../utilities/test-utils";

// This is needed so MST can deserialize snapshots referring to tools
import "../../register-tools";

var mockGetQueryState = jest.fn();
jest.mock("react-query", () => ({
  useQueryClient: () => ({
    getQueryState: mockGetQueryState
  })
}));

describe("Canvas Component", () => {

  beforeEach(() => {
    // mock getSelection for text tool
    (window as any).getSelection = () => {
      return {
      };
    };
  });

 it("can render without a document or content", () => {
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <CanvasComponent context="test" />
      </Provider>
    );
    expect(screen.queryByTestId("document-content")).toBeNull();
  });

  it("can render with a document", () => {
    const document = DocumentModel.create({
      type: ProblemDocument,
      title: "test",
      uid: "1",
      key: "test",
      createdAt: 1,
      visibility: "public",
      content: createSingleTileContent({
        type: "Text",
        text: "test"
      })
    });
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <CanvasComponent context="test" document={document} readOnly={true} />
      </Provider>
    );
    expect(screen.getByTestId("document-content")).toBeInTheDocument();
    expect(screen.getByTestId("text-tool-wrapper")).toBeInTheDocument();
  });

  it("renders spinner while loading remote document content", () => {
    mockGetQueryState.mockImplementation(() => ({ status: "loading" }));
    const document = DocumentModel.create({
      type: ProblemDocument,
      title: "test",
      uid: "1",
      key: "test",
      remoteContext: "remote-context",
      createdAt: 1,
      visibility: "public"
    });
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <CanvasComponent context="test" document={document} readOnly={true} />
      </Provider>
    );
    expect(screen.getByTestId("document-loading-spinner")).toBeInTheDocument();
  });

  it("can render with content", () => {
    const content = DocumentContentModel.create(createSingleTileContent({
      type: "Text",
      text: "test"
    }));
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <CanvasComponent context="test" content={content} readOnly={true} />
      </Provider>
    );
    expect(screen.getByTestId("document-content")).toBeInTheDocument();
    expect(screen.getByTestId("text-tool-wrapper")).toBeInTheDocument();
  });

});
