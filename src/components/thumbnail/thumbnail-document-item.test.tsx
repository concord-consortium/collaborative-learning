import { act, fireEvent, render } from "@testing-library/react";
import { Provider } from "mobx-react";
import { runInAction } from "mobx";
import { unprotect } from "mobx-state-tree";
import React from "react";
import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { createDocumentModel, DocumentModelType } from "../../models/document/document";
import { DocumentMetadataModel } from "../../models/document/document-metadata-model";
import { PersonalDocument, ProblemDocument } from "../../models/document/document-types";
import { specStores } from "../../models/stores/spec-stores";
import { UserModel } from "../../models/stores/user";
import { Bookmark } from "../../models/stores/bookmarks";

jest.mock("../document/canvas", () => ({
  CanvasComponent: () => <div data-testid="mock-canvas" />,
}));

const captionText = "My Document Caption";

interface IRenderOptions {
  isPrivate?: boolean;
  isSelected?: boolean;
  isStarred?: boolean;
  userType?: "student" | "teacher" | "researcher";
  onDocumentClick?: (document: DocumentModelType) => void;
  onDocumentDragStart?: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
  scrollable?: boolean;
}

function renderItem(options: IRenderOptions = {}) {
  const {
    isPrivate = false,
    isSelected = false,
    isStarred = false,
    userType = "student",
    onDocumentClick = jest.fn(),
    onDocumentDragStart,
    onDocumentStarClick,
    scrollable,
  } = options;
  const ownerId = isPrivate ? "other-user" : "test-student";
  const user = UserModel.create({ id: "test-student", type: userType, name: "Test Student" });
  const stores = specStores({ user });
  const document = createDocumentModel({
    type: ProblemDocument,
    title: "Test Document",
    uid: ownerId,
    key: "doc-key-1",
    createdAt: 1,
    visibility: "private"
  });
  if (isStarred) {
    // Bypass `toggleUserBookmark`, which would hit the DB; seed the bookmark directly.
    stores.bookmarks.updateDocumentBookmark(document.key, new Bookmark(user.id, "bookmark-1", true));
  }
  const result = render(
    <Provider stores={stores}>
      <ThumbnailDocumentItem
        canvasContext="test"
        captionText={captionText}
        dataTestName="my-work-list-items"
        document={document}
        isSelected={isSelected}
        onDocumentClick={onDocumentClick}
        onDocumentDragStart={onDocumentDragStart}
        onDocumentStarClick={onDocumentStarClick}
        scale={0.1}
        scrollable={scrollable}
      />
    </Provider>
  );
  const listItem = result.container.querySelector(".list-item") as HTMLElement;
  return { ...result, listItem, document, onDocumentClick, onDocumentStarClick };
}

describe("ThumbnailDocumentItem", () => {
  describe("when the document is accessible", () => {
    it("renders the list item with role='button'", () => {
      const { listItem } = renderItem();
      expect(listItem).toHaveAttribute("role", "button");
    });

    it("renders the list item with tabIndex 0", () => {
      const { listItem } = renderItem();
      expect(listItem).toHaveAttribute("tabindex", "0");
    });

    it("uses captionText as the list item's aria-label", () => {
      const { listItem } = renderItem();
      expect(listItem).toHaveAttribute("aria-label", captionText);
    });

    it("calls onDocumentClick when Enter is pressed on the list item", () => {
      const { listItem, onDocumentClick, document } = renderItem();
      fireEvent.keyDown(listItem, { key: "Enter" });
      expect(onDocumentClick).toHaveBeenCalledWith(document);
    });

    it("calls onDocumentClick when Space is pressed on the list item", () => {
      const { listItem, onDocumentClick, document } = renderItem();
      fireEvent.keyDown(listItem, { key: " " });
      expect(onDocumentClick).toHaveBeenCalledWith(document);
    });

    it("marks the canvas container with aria-hidden='true'", () => {
      const { container } = renderItem();
      const canvasContainer = container.querySelector(".scaled-list-item-container");
      expect(canvasContainer).toHaveAttribute("aria-hidden", "true");
    });

    it("marks the canvas container with the inert attribute", () => {
      const { container } = renderItem();
      const canvasContainer = container.querySelector(".scaled-list-item-container");
      expect(canvasContainer).toHaveAttribute("inert");
    });

    // CLUE-564: scrollable (large/"big") thumbnails are the 4-up replacement and must stay
    // interactive so tiles can be selected and borrowed/copied. They are therefore NOT made
    // inert/aria-hidden (unlike the small preview thumbnails tested above).
    it("does not make the canvas container inert/aria-hidden when scrollable", () => {
      const { container } = renderItem({ scrollable: true });
      const canvasContainer = container.querySelector(".scaled-list-item-container");
      expect(canvasContainer).not.toHaveAttribute("inert");
      expect(canvasContainer).not.toHaveAttribute("aria-hidden");
    });

    it("sets aria-current='true' when the document is selected", () => {
      const { listItem } = renderItem({ isSelected: true });
      expect(listItem).toHaveAttribute("aria-current", "true");
    });

    it("omits aria-current when the document is not selected", () => {
      const { listItem } = renderItem({ isSelected: false });
      expect(listItem).not.toHaveAttribute("aria-current");
    });
  });

  describe("when the document is private", () => {
    it("keeps the list item in the tab order (so AT users can discover it)", () => {
      const { listItem } = renderItem({ isPrivate: true });
      expect(listItem).toHaveAttribute("tabindex", "0");
    });

    it("renders the list item with aria-disabled='true'", () => {
      const { listItem } = renderItem({ isPrivate: true });
      expect(listItem).toHaveAttribute("aria-disabled", "true");
    });

    it("does not call onDocumentClick when Enter is pressed", () => {
      const { listItem, onDocumentClick } = renderItem({ isPrivate: true });
      fireEvent.keyDown(listItem, { key: "Enter" });
      expect(onDocumentClick).not.toHaveBeenCalled();
    });
  });

  describe("DocumentBookmark", () => {
    it("sets aria-pressed='true' when the document is bookmarked", () => {
      const { container } = renderItem({ isStarred: true, onDocumentStarClick: jest.fn() });
      const bookmark = container.querySelector(".icon-holder");
      expect(bookmark).toHaveAttribute("aria-pressed", "true");
    });

    it("sets aria-pressed='false' when the document is not bookmarked", () => {
      const { container } = renderItem({ isStarred: false, onDocumentStarClick: jest.fn() });
      const bookmark = container.querySelector(".icon-holder");
      expect(bookmark).toHaveAttribute("aria-pressed", "false");
    });

    it("uses 'Bookmark document' as aria-label when not bookmarked", () => {
      const { container } = renderItem({ isStarred: false, onDocumentStarClick: jest.fn() });
      const bookmark = container.querySelector(".icon-holder");
      expect(bookmark).toHaveAttribute("aria-label", "Bookmark document");
    });

    it("uses 'Remove bookmark' as aria-label when bookmarked", () => {
      const { container } = renderItem({ isStarred: true, onDocumentStarClick: jest.fn() });
      const bookmark = container.querySelector(".icon-holder");
      expect(bookmark).toHaveAttribute("aria-label", "Remove bookmark");
    });

    it("calls onDocumentStarClick when the bookmark button is clicked", () => {
      const onDocumentStarClick = jest.fn();
      const { container, document } = renderItem({ onDocumentStarClick });
      const bookmark = container.querySelector(".icon-holder") as HTMLElement;
      fireEvent.click(bookmark);
      expect(onDocumentStarClick).toHaveBeenCalledWith(document);
    });

    it("does not activate the parent list item when Enter is pressed on the bookmark", () => {
      const onDocumentClick = jest.fn();
      const onDocumentStarClick = jest.fn();
      const { container } = renderItem({ onDocumentClick, onDocumentStarClick });
      const bookmark = container.querySelector(".icon-holder") as HTMLElement;
      fireEvent.keyDown(bookmark, { key: "Enter" });
      expect(onDocumentClick).not.toHaveBeenCalled();
    });

    it("marks the bookmark button with aria-disabled='true' for researchers", () => {
      const { container } = renderItem({ userType: "researcher", onDocumentStarClick: jest.fn() });
      const bookmark = container.querySelector(".icon-holder");
      expect(bookmark).toHaveAttribute("aria-disabled", "true");
    });

    it("keeps the bookmark button in the tab order for researchers (so AT users can hear its state)", () => {
      const { container } = renderItem({ userType: "researcher", onDocumentStarClick: jest.fn() });
      const bookmark = container.querySelector(".icon-holder");
      expect(bookmark).not.toBeDisabled();
      expect(bookmark).not.toHaveAttribute("tabindex", "-1");
    });

    it("does not call onDocumentStarClick when researchers click the bookmark", () => {
      const onDocumentStarClick = jest.fn();
      const { container } = renderItem({ userType: "researcher", onDocumentStarClick });
      const bookmark = container.querySelector(".icon-holder") as HTMLElement;
      fireEvent.click(bookmark);
      expect(onDocumentStarClick).not.toHaveBeenCalled();
    });
  });

  describe("documentMetadata prop (reactive shared status)", () => {
    function renderWithMetadata(
      metadataVisibility: "public" | "private" | null,
      docVisibility: "public" | "private" = "private"
    ) {
      const user = UserModel.create({ id: "test-student", type: "student", name: "Test Student" });
      const stores = specStores({ user });
      // A peer-owned doc; `docVisibility` is the loaded document's (authoritative) visibility
      // and `metadataVisibility` is the (possibly stale/missing) Firestore metadata visibility.
      const document = createDocumentModel({
        type: PersonalDocument, title: "Peer Doc", uid: "other-user",
        key: "peer-doc-1", createdAt: 1, visibility: docVisibility
      });
      const metadata = DocumentMetadataModel.create({
        uid: "other-user", type: PersonalDocument, key: "peer-doc-1", visibility: metadataVisibility
      });
      unprotect(metadata);
      const result = render(
        <Provider stores={stores}>
          <ThumbnailDocumentItem
            canvasContext="test"
            captionText={captionText}
            dataTestName="sort-work-list-items"
            document={document}
            documentMetadata={metadata}
            onDocumentClick={jest.fn()}
            scale={0.1}
          />
        </Provider>
      );
      const listItem = () => result.container.querySelector(".list-item") as HTMLElement;
      return { ...result, listItem, metadata };
    }

    it("renders private when metadata.visibility is private", () => {
      const { listItem } = renderWithMetadata("private");
      expect(listItem()).toHaveAttribute("aria-disabled", "true");
    });

    it("renders accessible when metadata.visibility is public, despite the document's own private visibility", () => {
      const { listItem } = renderWithMetadata("public");
      expect(listItem()).not.toHaveAttribute("aria-disabled");
      expect(listItem()).toHaveAttribute("role", "button");
    });

    it("reactively flips from private to accessible when metadata.visibility changes", () => {
      const { listItem, metadata } = renderWithMetadata("private");
      expect(listItem()).toHaveAttribute("aria-disabled", "true");

      act(() => { runInAction(() => { metadata.visibility = "public"; }); });

      expect(listItem()).not.toHaveAttribute("aria-disabled");
      expect(listItem()).toHaveAttribute("role", "button");
    });

    it("stays accessible when the loaded document is public even if the metadata visibility is stale/missing", () => {
      // Reported regression: a shared problem doc whose Firestore metadata visibility is null
      // while the loaded document's visibility is "public". The document is authoritative here.
      const { listItem } = renderWithMetadata(null, "public");
      expect(listItem()).not.toHaveAttribute("aria-disabled");
      expect(listItem()).toHaveAttribute("role", "button");
    });
  });

  describe("drag handlers", () => {
    it("places draggable='true' on the list item when onDocumentDragStart is provided", () => {
      const onDocumentDragStart = jest.fn();
      const { listItem } = renderItem({ onDocumentDragStart });
      expect(listItem).toHaveAttribute("draggable", "true");
    });

    it("does not set draggable on the inner .scaled-list-item-container", () => {
      const onDocumentDragStart = jest.fn();
      const { container } = renderItem({ onDocumentDragStart });
      const canvasContainer = container.querySelector(".scaled-list-item-container");
      expect(canvasContainer).not.toHaveAttribute("draggable");
    });
  });
});
