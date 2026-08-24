import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DocumentContentModel } from "../../models/document/document-content";
import { ProblemModel } from "../../models/curriculum/problem";
import { ChatTutorSidebar } from "./chat-sidebar";
import { ChatStatus, ChatTransport, ChatTurn } from "./transport";

// The sidebar builds its transport (FirestoreTransport) inside a useMemo, so the only way to hand it
// scripted turns is to replace that module. This fake immediately delivers one assistant turn with two
// highlights — enough to drive every hover/pin/unmount path below without a Firestore emulator.
const fakeTurn: ChatTurn = {
  id: "turn-1",
  sender: "assistant",
  text: "Look at these two things.",
  highlights: [
    { tileId: "tileA", objectId: "objA", label: "the first block" },
    { tileId: "tileB", objectId: "objB", label: "the second block" },
  ],
};

class FakeTransport implements ChatTransport {
  subscribe(onTurns: (turns: ChatTurn[]) => void, onStatus: (status: ChatStatus) => void): () => void {
    onTurns([fakeTurn]);
    onStatus("idle");
    return () => undefined;
  }
  async sendUserMessage(): Promise<void> {
    // never invoked by these tests
  }
}

jest.mock("./firestore-transport", () => ({
  FirestoreTransport: jest.fn().mockImplementation(() => new FakeTransport())
}));

// The drawer's focus-trap is orthogonal to highlight ownership and pulls in
// @concord-consortium/accessibility-tools, which does real DOM focus work that jsdom doesn't need to
// exercise here — a no-op keeps these tests about highlight state, not focus trapping.
jest.mock("./use-tutor-drawer-trap", () => ({
  useTutorDrawerTrap: () => undefined
}));

// One frozen stores object, not a fresh literal per call. The sidebar memoizes its transport on
// [.., appConfig, db, user], so returning new identities each render would invalidate that memo
// every render, re-subscribe, deliver turns, set state, and render again — an infinite loop rather
// than a test failure. The real useStores hands back the same object from context every time.
jest.mock("../../hooks/use-stores", () => {
  const stores = {
    appConfig: {
      chatTutorHighlights: true,
      chatTutorPrompts: undefined,
      chatTutorIntro: undefined,
    },
    db: { firestore: {} },
    user: { id: "1", network: undefined, classHash: "class-hash" },
  };
  return { useStores: () => stores };
});

describe("ChatTutorSidebar as a highlight source", () => {
  // Real MST node rather than a plain object: useRightDirty calls onPatch(content, …), which MST
  // throws on for a non-node, and asserting the model's own volatile state (pinnedHighlightRef,
  // pinnedHighlightSource) is a stronger check than spying on the setter/toggle calls it makes.
  // Empty content is fine — the "object" resolver used here is content-blind, so the tileId/objectId
  // the turn cites don't need to exist as real tiles.
  const makeContent = () => DocumentContentModel.create({});

  // problem is only dereferenced inside a closure the fake transport never calls (getLeftContext),
  // but it's cheap to build for real rather than cast a stub through the prop type.
  const problem = ProblemModel.create({ ordinal: 1, title: "Test Problem" });

  const renderSidebar = (content: ReturnType<typeof makeContent>) =>
    render(
      <ChatTutorSidebar
        documentKey="doc-1"
        documentTitle="Test Document"
        problemPath="unit/1/1"
        problem={problem}
        content={content}
        onClose={jest.fn()}
      />
    );

  it("renders one button per highlight, labelled from the model's own text", () => {
    renderSidebar(makeContent());
    expect(screen.getByRole("button", { name: /the first block/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /the second block/ })).toBeInTheDocument();
  });

  it("hovering a button sets the document's hovered highlight ref", () => {
    const content = makeContent();
    renderSidebar(content);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /the first block/ }));
    expect(content.hoveredHighlightRef).toEqual({ kind: "object", tileId: "tileA", objectId: "objA" });
  });

  it("clicking a button pins its highlight ref under this sidebar's source token", () => {
    const content = makeContent();
    renderSidebar(content);
    fireEvent.click(screen.getByRole("button", { name: /the first block/ }));
    expect(content.pinnedHighlightRef).toEqual({ kind: "object", tileId: "tileA", objectId: "objA" });
    expect(typeof content.pinnedHighlightSource).toBe("string");
  });

  // The regression this guards: the pinned button key used to live in a useRef. Re-pinning within
  // one sidebar reassigns the same content.pinnedHighlightSource (it's this sidebar's own token both
  // times), so MobX saw no change to react to and the previously pressed button never re-rendered —
  // the ring moved to the new tile while the old button stayed lit. Holding the key in useState fixed
  // it; nothing else in the component stops it from regressing.
  it("clicking a second button un-presses the first", () => {
    const content = makeContent();
    renderSidebar(content);
    const first = screen.getByRole("button", { name: /the first block/ });
    const second = screen.getByRole("button", { name: /the second block/ });

    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(second);
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "true");
  });

  it("releases the pin on unmount", () => {
    const content = makeContent();
    const { unmount } = renderSidebar(content);
    fireEvent.click(screen.getByRole("button", { name: /the first block/ }));
    expect(content.pinnedHighlightRef).toBeDefined();

    unmount();
    expect(content.pinnedHighlightRef).toBeUndefined();
  });
});
