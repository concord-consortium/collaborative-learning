import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "mobx-react";
import React from "react";

import { SortedSection } from "./sorted-section";
import { DocumentScroller } from "./document-scroller";
import { specStores } from "../../models/stores/spec-stores";
import { DocumentGroup } from "../../models/stores/document-group";
import { createDocumentModel } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { ENavTab } from "../../models/view/nav-tabs";
import { kDividerHalf } from "../../models/stores/ui-types";

jest.mock("../../assets/icons/arrow/arrow.svg", () => function ArrowIconMock(props: object) {
  return <svg data-testid="arrow-icon" {...props} />;
});

// Expose the click handler the real thumbnail wires up, so the open path is actually exercised.
jest.mock("../thumbnail/decorated-document-thumbnail-item", () => ({
  DecoratedDocumentThumbnailItem: ({ document, onSelectDocument }: any) =>
    <button data-testid={`thumb-${document.key}`} onClick={() => onSelectDocument(document)}/>
}));

jest.mock("../../lib/logger", () => ({ Logger: { log: jest.fn() } }));
jest.mock("../../models/document/log-document-event", () => ({ logDocumentViewEvent: jest.fn() }));
jest.mock("./document-scroller-header", () => ({ DocumentScrollerHeader: () => null }));

// jsdom implements neither of these, and the scroller calls both on mount.
beforeAll(() => {
  Element.prototype.scrollTo = jest.fn();
  global.ResizeObserver = class {
    observe() { /* noop */ }
    unobserve() { /* noop */ }
    disconnect() { /* noop */ }
  } as any;
});

function setupSortWork() {
  const stores = specStores();
  stores.documents.add(createDocumentModel({
    type: ProblemDocument, title: "test", uid: "1", key: "doc-1", createdAt: 1, content: {}
  }));
  stores.persistentUI.applyFixedStartView(ENavTab.kSortWork, kDividerHalf);
  const documentGroup = new DocumentGroup({
    label: "Group A",
    sortType: "Group",
    documents: [{ key: "doc-1", uid: "1", type: ProblemDocument } as any],
    stores: {
      groups: stores.groups, class: stores.class, appConfig: stores.appConfig,
      bookmarks: stores.bookmarks, commentTags: stores.commentTags
    }
  });
  return { stores, documentGroup };
}

function expectDocumentOpened(stores: ReturnType<typeof specStores>) {
  expect(stores.persistentUI.isStartViewOverrideActiveFor(ENavTab.kSortWork)).toBe(false);
  expect(stores.persistentUI.activeNavTab).toBe(ENavTab.kSortWork);
  expect(stores.persistentUI.tabs.get(ENavTab.kSortWork)?.currentDocumentGroup?.primaryDocumentKey)
    .toBe("doc-1");
}

describe("Sort Work document selection under the author's fixed start view", () => {

  it("opens the clicked thumbnail from the sorted list and ends the forced view", async () => {
    // Sort Work opens documents through its own path; if that path does not end the forced view, the
    // tab keeps suppressing the document and every thumbnail click is a no-op.
    const { stores, documentGroup } = setupSortWork();
    stores.ui.setExpandedSortWorkSections("Group A", true);

    render(
      <Provider stores={stores}>
        <SortedSection docFilter="Problem" documentGroup={documentGroup} idx={0}
          secondarySort="None" primarySortBy="Group" secondarySortBy="None"/>
      </Provider>
    );

    await userEvent.click(screen.getByTestId("thumb-doc-1"));
    expectDocumentOpened(stores);
  });

  it("opens the clicked thumbnail from the scroller through the store action", async () => {
    // The scroller opens documents by its own path too. It cannot actually be on screen while the
    // forced view holds Sort Work (it renders only once a document is open, which the override
    // suppresses), so this guards the store action staying consistent if that ever changes.
    const { stores, documentGroup } = setupSortWork();
    stores.persistentUI.setCurrentDocumentGroupId(ENavTab.kSortWork, "Group A");

    render(
      <Provider stores={stores}>
        <DocumentScroller documentGroup={documentGroup}/>
      </Provider>
    );

    await userEvent.click(screen.getByTestId("thumb-doc-1"));
    expectDocumentOpened(stores);
  });
});
