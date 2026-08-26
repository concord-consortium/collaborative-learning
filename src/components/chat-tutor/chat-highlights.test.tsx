import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Chat } from "./chat";
import { ChatTurn } from "./transport";
import { UseChatResult } from "./use-chat";

const turn: ChatTurn = {
  id: "t1", sender: "assistant", text: "Try the block that reads the sensor.",
  highlights: [
    { tileId: "tileA", objectId: "nodeA", label: "the block that reads the sensor" },
    { tileId: "tileA", objectId: "nodeB", label: "the live output" }
  ]
};

const chatResult = (turns: ChatTurn[]): UseChatResult => ({
  turns, status: "idle", error: null, pending: false,
  sendMessage: jest.fn(async () => undefined), header: "Doc · 1.1"
});

describe("Chat highlight buttons", () => {
  it("renders one button per highlight, labelled by the model's words", () => {
    render(<Chat enableHighlights chat={chatResult([turn])} />);
    expect(screen.getByRole("button", { name: /the block that reads the sensor/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /the live output/ })).toBeInTheDocument();
  });

  it("renders no buttons for a turn without highlights", () => {
    render(<Chat enableHighlights chat={chatResult([{ id: "t2", sender: "assistant", text: "Just words." }])} />);
    expect(screen.queryByTestId("chat-highlights")).not.toBeInTheDocument();
  });

  it("reports toggle with the turn id and index", () => {
    const onHighlightToggle = jest.fn();
    render(<Chat enableHighlights chat={chatResult([turn])} onHighlightToggle={onHighlightToggle} />);
    fireEvent.click(screen.getByRole("button", { name: /the live output/ }));
    expect(onHighlightToggle).toHaveBeenCalledWith("t1", 1);
  });

  it("reports hover enter and leave", () => {
    const onHighlightHover = jest.fn();
    render(<Chat enableHighlights chat={chatResult([turn])} onHighlightHover={onHighlightHover} />);
    const button = screen.getByRole("button", { name: /the live output/ });
    fireEvent.mouseEnter(button);
    expect(onHighlightHover).toHaveBeenCalledWith("t1", 1, true);
    fireEvent.mouseLeave(button);
    expect(onHighlightHover).toHaveBeenCalledWith("t1", 1, false);
  });

  it("reports focus as hover, so the preview reaches keyboard users", () => {
    const onHighlightHover = jest.fn();
    render(<Chat enableHighlights chat={chatResult([turn])} onHighlightHover={onHighlightHover} />);
    const button = screen.getByRole("button", { name: /the live output/ });
    fireEvent.focus(button);
    expect(onHighlightHover).toHaveBeenCalledWith("t1", 1, true);
  });

  it("reports blur as hover-off, once the focus it withdraws was actually claimed", () => {
    const onHighlightHover = jest.fn();
    render(<Chat enableHighlights chat={chatResult([turn])} onHighlightHover={onHighlightHover} />);
    const button = screen.getByRole("button", { name: /the live output/ });
    fireEvent.focus(button);
    fireEvent.blur(button);
    expect(onHighlightHover).toHaveBeenCalledWith("t1", 1, false);
  });

  // A button withdrawing a claim it never made would cancel whatever another button is holding,
  // since the preview belongs to the sidebar rather than to any one button.
  it("ignores a blur on a button that never held focus", () => {
    const onHighlightHover = jest.fn();
    render(<Chat enableHighlights chat={chatResult([turn])} onHighlightHover={onHighlightHover} />);
    fireEvent.blur(screen.getByRole("button", { name: /the live output/ }));
    expect(onHighlightHover).not.toHaveBeenCalled();
  });

  it("marks the active button pressed", () => {
    render(<Chat enableHighlights chat={chatResult([turn])} activeHighlightKey="t1:1" />);
    expect(screen.getByRole("button", { name: /the live output/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /the block that reads/ })).toHaveAttribute("aria-pressed", "false");
  });

  // Pinning moves a ring onto an object elsewhere in the document. aria-pressed reports the button;
  // nothing reports the target, so without this a screen reader hears a control with no effect.
  //
  // Releasing clears the region rather than announcing anything: a polite region's default
  // aria-relevant is "additions text", so a removal is silent. See the region in chat.tsx for why
  // that is deliberate. The empty-string assertion is real — jest-dom special-cases "" and fails if
  // the label persists.
  it("announces the pinned highlight, and clears on release", () => {
    const { rerender } = render(<Chat enableHighlights chat={chatResult([turn])} activeHighlightKey="t1:1" />);
    expect(screen.getByTestId("chat-highlight-live")).toHaveTextContent("Highlighting the live output");

    rerender(<Chat enableHighlights chat={chatResult([turn])} />);
    expect(screen.getByTestId("chat-highlight-live")).toHaveTextContent("");
  });

  it("has no highlight live region when the unit has not enabled highlights", () => {
    render(<Chat chat={chatResult([turn])} enableHighlights={false} activeHighlightKey="t1:1" />);
    expect(screen.queryByTestId("chat-highlight-live")).not.toBeInTheDocument();
  });

  // A press that drags off the button and releases elsewhere fires neither onMouseUp on the button
  // nor onFocus, so a pointer-focus flag left standing would swallow the next keyboard focus of any
  // button — silently costing a keyboard user their preview.
  it("does not let a dragged-off press swallow the next keyboard focus", () => {
    const onHighlightHover = jest.fn();
    render(<Chat enableHighlights chat={chatResult([turn])} onHighlightHover={onHighlightHover} />);
    const first = screen.getByRole("button", { name: /the block that reads the sensor/ });
    const second = screen.getByRole("button", { name: /the live output/ });

    fireEvent.mouseEnter(first);
    fireEvent.mouseDown(first);
    fireEvent.mouseLeave(first);   // dragged off; no mouseup, no focus event
    onHighlightHover.mockClear();

    fireEvent.focus(second);
    expect(onHighlightHover).toHaveBeenCalledWith("t1", 1, true);
  });

  it("renders nothing when the unit has not enabled highlights", () => {
    render(<Chat chat={chatResult([turn])} enableHighlights={false} />);
    expect(screen.queryByTestId("chat-highlights")).not.toBeInTheDocument();
    // Scoped to the bubble: the same text also appears in the polite live-region
    // announcement, which would otherwise make this an ambiguous match.
    expect(within(screen.getByTestId("chat-row-assistant")).getByText(/Try the block that reads the sensor/))
      .toBeInTheDocument();
  });
});
