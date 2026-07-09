import { fireEvent, render } from "@testing-library/react";
import { Provider } from "mobx-react";
import React from "react";

import { DecoratedDocumentThumbnailItem } from "./decorated-document-thumbnail-item";
import { createDocumentModel } from "../../models/document/document";
import { ProblemDocument, DocumentDragKey } from "../../models/document/document-types";
import { specStores } from "../../models/stores/spec-stores";
import { UserModel } from "../../models/stores/user";
import { kDragTiles } from "../tiles/tile-component";

jest.mock("../document/canvas", () => ({
  CanvasComponent: () => <div data-testid="mock-canvas" />,
}));
// Isolate the drag logic from firebase sync + caption lookups.
jest.mock("../../hooks/use-document-sync-to-firebase", () => ({
  useDocumentSyncToFirebase: () => undefined,
}));
jest.mock("../../hooks/use-document-caption", () => ({
  useDocumentCaption: () => "Caption",
}));

// Minimal DataTransfer stand-in that tracks set data and exposes `types`.
function makeDataTransfer(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    setData: (type: string, value: string) => { store[type] = value; },
    getData: (type: string) => store[type] ?? "",
    get types() { return Object.keys(store); },
  } as unknown as DataTransfer;
}

function renderItem() {
  const user = UserModel.create({ id: "test-student", type: "student", name: "Test Student" });
  const stores = specStores({ user });
  const document = createDocumentModel({
    type: ProblemDocument,
    title: "Test Document",
    uid: "test-student",
    key: "doc-key-1",
    createdAt: 1,
    visibility: "private",
  });
  const result = render(
    <Provider stores={stores}>
      <DecoratedDocumentThumbnailItem
        document={document}
        tab="My Work"
        scale={0.1}
        allowDelete={false}
        shouldHandleStarClick={false}
        scrollable={true}
      />
    </Provider>
  );
  const listItem = result.container.querySelector(".list-item") as HTMLElement;
  return { ...result, listItem, document };
}

describe("DecoratedDocumentThumbnailItem drag distinction", () => {
  it("tags a plain thumbnail drag as a document drag", () => {
    const { listItem, document } = renderItem();
    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(listItem, { dataTransfer });
    expect(dataTransfer.getData(DocumentDragKey)).toBe(document.key);
  });

  it("does not tag a bubbled tile drag as a document drag", () => {
    const { listItem } = renderItem();
    // Simulate a tile drag already in progress: its dragstart (fired first, in the bubble
    // phase) has populated kDragTiles before reaching the draggable list item.
    const dataTransfer = makeDataTransfer({
      [kDragTiles]: JSON.stringify({ sourceDocId: "doc-key-1", tiles: [{ tileId: "t1" }] }),
    });
    fireEvent.dragStart(listItem, { dataTransfer });
    expect(dataTransfer.getData(DocumentDragKey)).toBe("");
  });
});
