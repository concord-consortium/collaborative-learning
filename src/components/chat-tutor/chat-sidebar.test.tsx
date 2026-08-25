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
    // Deliberately the same object as the first, under a different label. Two turns naming one node
    // is the ordinary way this arises, and every turn's buttons stay in the transcript together.
    { tileId: "tileA", objectId: "objA", label: "that same block once more" },
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

  // Asserts the pressed state follows the pin. Two independent things in the sidebar keep that
  // true — the pinned key lives in React state, and handleHighlightToggle clears this sidebar's pin
  // before moving it — and either alone satisfies this test, so it does not discriminate between
  // them. Breaking both is what fails here.
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

  // Two buttons citing one object share this sidebar's single source token, so a bare
  // togglePinnedHighlightRef sees its own source on a matching reference and reads the second click
  // as a release: no button pressed, no ring, and nothing to say why. Moving the pin is the only
  // sensible reading of clicking a button that is not currently pressed.
  it("moves the pin between two buttons that cite the same object", () => {
    const content = makeContent();
    renderSidebar(content);
    const first = screen.getByRole("button", { name: /the first block/ });
    const sameObject = screen.getByRole("button", { name: /that same block once more/ });

    fireEvent.click(first);
    fireEvent.click(sameObject);

    expect(content.pinnedHighlightRef).toEqual({ kind: "object", tileId: "tileA", objectId: "objA" });
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(sameObject).toHaveAttribute("aria-pressed", "true");
  });

  // The other half of that guard: it must not cost the pinned button its own release.
  it("clicking the pinned button again releases it", () => {
    const content = makeContent();
    renderSidebar(content);
    const first = screen.getByRole("button", { name: /the first block/ });

    fireEvent.click(first);
    fireEvent.click(first);

    expect(content.pinnedHighlightRef).toBeUndefined();
    expect(first).toHaveAttribute("aria-pressed", "false");
  });

  // Hover and focus are separate claims that can rest on two different buttons, and the preview
  // they compete for is shared by the whole sidebar. Each of the three below fails if a button is
  // allowed to withdraw that shared preview based on a check about itself.
  describe("hover and focus arbitration", () => {
    // Browsers focus a button on mousedown. Counting that as a preview claim left a ring on screen
    // after a click released the pin, with no `:focus-visible` outline to explain it.
    //
    // This one calls first.focus() rather than fireEvent.focus(): only a real focus moves
    // document.activeElement, and the guard this replaced consulted activeElement. Swap it back to
    // fireEvent and the test still passes against the broken code, proving nothing. Do not also
    // fireEvent.focus() afterwards — that is a second focus event, arriving after the pointer flag
    // has been consumed, and it registers as keyboard focus.
    it("does not treat pointer-originated focus as a preview", () => {
      const content = makeContent();
      renderSidebar(content);
      const first = screen.getByRole("button", { name: /the first block/ });

      fireEvent.mouseEnter(first);
      fireEvent.mouseDown(first);
      first.focus();               // a real focus, as a browser does on mousedown
      fireEvent.mouseUp(first);
      fireEvent.click(first);
      expect(content.highlightState).toBe("pinned");

      fireEvent.mouseLeave(first);
      fireEvent.click(first);

      expect(content.pinnedHighlightRef).toBeUndefined();
      expect(content.hoveredHighlightRef).toBeUndefined();
      expect(content.highlightState).toBeUndefined();
    });

    it("keeps a focused button's preview when the pointer crosses another button", () => {
      const content = makeContent();
      renderSidebar(content);
      const first = screen.getByRole("button", { name: /the first block/ });
      const second = screen.getByRole("button", { name: /the second block/ });

      fireEvent.focus(first);
      expect(content.hoveredHighlightRef).toEqual({ kind: "object", tileId: "tileA", objectId: "objA" });

      fireEvent.mouseEnter(second);
      expect(content.hoveredHighlightRef).toEqual({ kind: "object", tileId: "tileB", objectId: "objB" });

      fireEvent.mouseLeave(second);
      expect(content.hoveredHighlightRef).toEqual({ kind: "object", tileId: "tileA", objectId: "objA" });
    });

    it("keeps a hovered button's preview when focus leaves another button", () => {
      const content = makeContent();
      renderSidebar(content);
      const first = screen.getByRole("button", { name: /the first block/ });
      const second = screen.getByRole("button", { name: /the second block/ });

      fireEvent.focus(first);
      fireEvent.mouseEnter(second);

      fireEvent.blur(first);

      expect(content.hoveredHighlightRef).toEqual({ kind: "object", tileId: "tileB", objectId: "objB" });
    });
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
