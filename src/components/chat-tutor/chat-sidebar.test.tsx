import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DocumentContentModel } from "../../models/document/document-content";
import { UnitModel, UnitModelType } from "../../models/curriculum/unit";
import { IUnitSummary } from "../../../shared/unit-summary-types";
import { ChatTutorSidebar } from "./chat-sidebar";
import { ChatStatus, ChatTransport, ChatTurn } from "./transport";
import { FirestoreTransport } from "./firestore-transport";

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

// A unit with one investigation/problem, optionally carrying an aiUnitSummary. buildUnitContext
// (unit-context.ts) walks from the given problem up through getParent(getParent(problem)), so the
// problem used anywhere in this file must be a node nested in a real unit tree, not a standalone
// ProblemModel.create(...): the sidebar calls this eagerly to build the conversation id's
// unit-context suffix.
function makeUnit(aiUnitSummary?: IUnitSummary): UnitModelType {
  return UnitModel.create({
    code: "u1",
    title: "Unit 1",
    config: aiUnitSummary ? { aiUnitSummary } : undefined,
    investigations: [
      { ordinal: 1, title: "Investigation 1", problems: [
        { ordinal: 1, title: "Test Problem" },
      ] },
    ],
  });
}

function summaryWithDigest(digest: string): IUnitSummary {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    sourceHash: "h",
    overview: "o",
    sourceManifest: [{ ordinal: "1.1", title: "Test Problem", problemHash: "h1" }],
    entries: [{ ordinal: "1.1", priorKnowledge: "", problemDigest: digest }],
  };
}

// One frozen stores object, not a fresh literal per call. The sidebar memoizes its transport on
// [.., appConfig, db, user, unit], so returning new identities each render would invalidate that
// memo every render, re-subscribe, deliver turns, set state, and render again — an infinite loop
// rather than a test failure. The real useStores hands back the same object from context every
// time; the unit-context tests below reassign mockStores.unit deliberately, to simulate the reload
// that is the only way a unit's config actually changes.
const mockStores = {
  appConfig: {
    chatTutorHighlights: true,
    chatTutorPrompts: undefined,
    chatTutorIntro: undefined,
    chatTutorProvider: undefined as string | undefined,
  },
  db: { firestore: {} },
  user: { id: "1", network: undefined, classHash: "class-hash" },
  unit: makeUnit(),
};
jest.mock("../../hooks/use-stores", () => ({ useStores: () => mockStores }));

describe("ChatTutorSidebar as a highlight source", () => {
  // Real MST node rather than a plain object: useRightDirty calls onPatch(content, …), which MST
  // throws on for a non-node, and asserting the model's own volatile state (pinnedHighlightRef,
  // pinnedHighlightSource) is a stronger check than spying on the setter/toggle calls it makes.
  // Empty content is fine — the "object" resolver used here is content-blind, so the tileId/objectId
  // the turn cites don't need to exist as real tiles.
  const makeContent = () => DocumentContentModel.create({});

  // Nested inside mockStores.unit (see the comment above makeUnit) rather than a standalone
  // ProblemModel.create(...).
  const problem = mockStores.unit.investigations[0].problems[0];

  const sidebar = (content: ReturnType<typeof makeContent>, documentKey = "doc-1") => (
    <ChatTutorSidebar
      documentKey={documentKey}
      documentTitle="Test Document"
      problemPath="unit/1/1"
      problem={problem}
      content={content}
      onClose={jest.fn()}
    />
  );

  const renderSidebar = (content: ReturnType<typeof makeContent>) => render(sidebar(content));

  // The flag is read per render, so a test that changes it must put it back.
  beforeEach(() => {
    mockStores.appConfig.chatTutorHighlights = true;
  });

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

  // Clicking a button that is not pressed always pins it, even when it cites the object already
  // pinned by another button — the two share this sidebar's single source token, which a bare
  // togglePinnedHighlightRef would read as the same source releasing the same reference.
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

  // The other half: re-clicking the pressed button is still the way to release it.
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

  // Changing documentKey or problemPath swaps the conversation without unmounting the sidebar, so a
  // highlight owned by the old conversation must not survive into the new one. Those two deps on the
  // release effect are the only thing doing that, and they look removable to anyone tidying a
  // dependency array — nothing else in the component fails if they go.
  it("releases both refs when the conversation swaps without an unmount", () => {
    const content = makeContent();
    const { rerender } = render(sidebar(content, "doc-1"));
    fireEvent.mouseEnter(screen.getByRole("button", { name: /the first block/ }));
    fireEvent.click(screen.getByRole("button", { name: /the first block/ }));
    expect(content.pinnedHighlightRef).toBeDefined();

    rerender(sidebar(content, "doc-2"));

    expect(content.pinnedHighlightRef).toBeUndefined();
    expect(content.hoveredHighlightRef).toBeUndefined();
  });

  // The sidebar shows a button as pressed only while the model still says this sidebar owns the pin.
  // Both halves of that matter: the observer wrapper, and deferring to pinnedHighlightSource rather
  // than trusting the local key. docs/highlights.md points at this component as the one to copy, so
  // the deference is part of what it is demonstrating.
  it("un-presses its button when another source takes the pin", () => {
    const content = makeContent();
    renderSidebar(content);
    const first = screen.getByRole("button", { name: /the first block/ });

    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "true");

    // act() because this re-render comes from MobX rather than from a React event, so without it the
    // DOM has not flushed by the time the assertion runs.
    act(() => {
      content.setPinnedHighlightRef(
        { kind: "object", tileId: "tileB", objectId: "objB" }, "some-other-source");
    });

    expect(first).toHaveAttribute("aria-pressed", "false");
  });

  // enableHighlights={!!appConfig.chatTutorHighlights} is the entire unit-config gate, and this is
  // the only test that fails if the prop stops reading the flag — hardcode it true and nothing else
  // in the file notices. Deleting the prop outright is caught by the other tests instead, since
  // Chat's default is false and they all expect buttons.
  it("renders no highlight buttons when the unit does not enable them", () => {
    mockStores.appConfig.chatTutorHighlights = false;
    renderSidebar(makeContent());
    expect(screen.queryByTestId("chat-highlights")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /the first block/ })).not.toBeInTheDocument();
  });

  // FirestoreTransport is mocked, so the only way to see what conversation id the sidebar built is
  // to read the constructor call it made -- there is no real Firestore write to inspect. A reload
  // is the only way a unit's config actually changes (see chat-sidebar.tsx's own comment), so each
  // render below swaps in a freshly built unit/problem pair rather than mutating one in place: MST
  // nodes belong to exactly one tree, so a changed unit means a new problem instance too, matching
  // what a real reload would produce.
  describe("conversation id forking on the unit's summary", () => {
    // A dedicated builder rather than the outer sidebar() helper: that one always passes the
    // describe block's original fixed problem, which would silently mismatch a freshly built unit
    // below (harmless here, since ordinals happen to coincide by construction, but not what a real
    // reload produces). This derives problem from whichever unit is under test, same as production.
    const sidebarWithUnit = (unit: UnitModelType, content: ReturnType<typeof makeContent>) => (
      <ChatTutorSidebar
        documentKey="doc-1"
        documentTitle="Test Document"
        problemPath="unit/1/1"
        problem={unit.investigations[0].problems[0]}
        content={content}
        onClose={jest.fn()}
      />
    );

    const lastConversationId = () => {
      const calls = (FirestoreTransport as unknown as jest.Mock).mock.calls;
      return calls[calls.length - 1][0].conversationId;
    };

    afterEach(() => {
      mockStores.unit = makeUnit();
      mockStores.appConfig.chatTutorProvider = undefined;
    });

    it("uses the same conversation id across renders when neither unit has a summary", () => {
      mockStores.unit = makeUnit();
      const { rerender } = render(sidebarWithUnit(mockStores.unit, makeContent()));
      const firstId = lastConversationId();

      mockStores.unit = makeUnit(); // a different instance, still no summary
      rerender(sidebarWithUnit(mockStores.unit, makeContent()));
      expect(lastConversationId()).toBe(firstId);
    });

    it("uses a different conversation id when the unit's summary changes between renders", () => {
      mockStores.unit = makeUnit(summaryWithDigest("digest one"));
      const { rerender } = render(sidebarWithUnit(mockStores.unit, makeContent()));
      const firstId = lastConversationId();

      mockStores.unit = makeUnit(summaryWithDigest("digest two"));
      rerender(sidebarWithUnit(mockStores.unit, makeContent()));
      expect(lastConversationId()).not.toBe(firstId);
    });

    // ForeverLearning never attaches unitContext (see firestore-transport.test.ts), so its
    // conversation id must not fork on a summary change either.
    it("uses the same conversation id across a summary change under ForeverLearning", () => {
      mockStores.appConfig.chatTutorProvider = "foreverlearning";
      mockStores.unit = makeUnit(summaryWithDigest("digest one"));
      const { rerender } = render(sidebarWithUnit(mockStores.unit, makeContent()));
      const firstId = lastConversationId();

      mockStores.unit = makeUnit(summaryWithDigest("digest two"));
      rerender(sidebarWithUnit(mockStores.unit, makeContent()));
      expect(lastConversationId()).toBe(firstId);
    });
  });
});
