import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Instance } from "mobx-state-tree";
import { createDocumentModel } from "../../models/document/document";
import { DocumentContentModel } from "../../models/document/document-content";
import { ProblemDocument } from "../../models/document/document-types";
import { CDocument, TreeManager } from "../../models/history/tree-manager";
import { PlaybackControlComponent } from "./playback-control";

// The slider is the subject of these tests, so everything the component pulls
// from stores and Firestore hooks is stubbed; only the TreeManager is real.
jest.mock("../../hooks/use-stores", () => ({
  useStores: () => ({
    user: { id: "1" },
    displayedActiveNavTab: "my-work",
    // Read by the ChatAvatar inside each comment marker.
    class: { getUserById: () => undefined }
  }),
  usePersistentUIStore: () => ({ focusDocument: "test" })
}));

let mockComments: any[] = [];
jest.mock("../../hooks/document-comment-hooks", () => ({
  useDocumentComments: () => ({ isLoading: false, isError: false, data: mockComments, error: undefined }),
  useDocumentCommentsAtSimplifiedPath: () =>
    ({ isLoading: false, isError: false, data: [], error: undefined })
}));

jest.mock("../../hooks/use-nav-tab-panel-info", () => ({
  useNavTabPanelInfo: () => ({ setPlaybackTime: jest.fn() })
}));

// Entry N is created N minutes after this, so entries stay in a known time order.
const historyStart = new Date("2026-02-25T09:00:00").getTime();
const entryCreated = (index: number) => new Date(historyStart + index * 60 * 1000);

function setupTreeManager(entryCount: number) {
  const docModel = createDocumentModel({
    uid: "1",
    type: ProblemDocument,
    key: "test",
    content: DocumentContentModel.create({ tileMap: {} }) as any
  });
  const treeManager = docModel.treeManagerAPI as Instance<typeof TreeManager>;

  // Entries carry no patch records, so seeking between them moves the history
  // position without needing tile content to replay against.
  const history = Array.from({ length: entryCount }, (_, index) => ({
    id: `entry-${index}`,
    tree: "test",
    model: "TestTile",
    action: "/setText",
    undoable: true,
    state: "complete" as const,
    created: entryCreated(index),
    records: []
  }));
  treeManager.setChangeDocument(CDocument.create({ history }));
  treeManager.setNumHistoryEntriesApplied(entryCount);

  return treeManager;
}

const sliderValue = () => screen.getByRole("slider").getAttribute("aria-valuenow");

describe("PlaybackControlComponent", () => {
  beforeEach(() => {
    mockComments = [];
  });

  it("moves the thumb when the document is seeked programmatically", async () => {
    const treeManager = setupTreeManager(5);
    render(<PlaybackControlComponent treeManager={treeManager} />);

    // A deep link into history seeks the document without touching the slider.
    await act(async () => { await treeManager.goToHistoryEntry(2); });

    expect(sliderValue()).toBe("2");
  });

  it("leaves the thumb on a comment when its marker is clicked", async () => {
    const treeManager = setupTreeManager(3);
    // Between entries 1 and 2, so the slider entries are [h0, h1, comment, h2].
    mockComments = [{
      id: "c1", uid: "2", name: "Teacher 1", content: "Nice work",
      createdAt: new Date(historyStart + 90 * 1000)
    }];
    render(<PlaybackControlComponent treeManager={treeManager} />);

    const marker = screen.getByTestId("comment-markers").querySelector(".comment-marker");
    assertIsDefined(marker);
    await act(async () => { fireEvent.click(marker); });

    // The document goes back to entry 1, the last entry before the comment, but
    // the thumb belongs on the comment the user clicked.
    expect(treeManager.numHistoryEventsApplied).toBe(1);
    expect(sliderValue()).toBe("2");
  });
});
