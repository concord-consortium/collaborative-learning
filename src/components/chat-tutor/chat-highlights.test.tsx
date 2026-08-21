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
    render(<Chat chat={chatResult([turn])} />);
    expect(screen.getByRole("button", { name: /the block that reads the sensor/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /the live output/ })).toBeInTheDocument();
  });

  it("renders no buttons for a turn without highlights", () => {
    render(<Chat chat={chatResult([{ id: "t2", sender: "assistant", text: "Just words." }])} />);
    expect(screen.queryByTestId("chat-highlights")).not.toBeInTheDocument();
  });

  it("reports toggle with the turn id and index", () => {
    const onHighlightToggle = jest.fn();
    render(<Chat chat={chatResult([turn])} onHighlightToggle={onHighlightToggle} />);
    fireEvent.click(screen.getByRole("button", { name: /the live output/ }));
    expect(onHighlightToggle).toHaveBeenCalledWith("t1", 1);
  });

  it("reports hover enter and leave", () => {
    const onHighlightHover = jest.fn();
    render(<Chat chat={chatResult([turn])} onHighlightHover={onHighlightHover} />);
    const button = screen.getByRole("button", { name: /the live output/ });
    fireEvent.mouseEnter(button);
    expect(onHighlightHover).toHaveBeenCalledWith("t1", 1, true);
    fireEvent.mouseLeave(button);
    expect(onHighlightHover).toHaveBeenCalledWith("t1", 1, false);
  });

  it("reports focus as hover, so the preview reaches keyboard users", () => {
    const onHighlightHover = jest.fn();
    render(<Chat chat={chatResult([turn])} onHighlightHover={onHighlightHover} />);
    const button = screen.getByRole("button", { name: /the live output/ });
    fireEvent.focus(button);
    expect(onHighlightHover).toHaveBeenCalledWith("t1", 1, true);
  });

  it("reports blur as hover-off", () => {
    const onHighlightHover = jest.fn();
    render(<Chat chat={chatResult([turn])} onHighlightHover={onHighlightHover} />);
    const button = screen.getByRole("button", { name: /the live output/ });
    fireEvent.blur(button);
    expect(onHighlightHover).toHaveBeenCalledWith("t1", 1, false);
  });

  it("marks the active button pressed", () => {
    render(<Chat chat={chatResult([turn])} activeHighlightKey="t1:1" />);
    expect(screen.getByRole("button", { name: /the live output/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /the block that reads/ })).toHaveAttribute("aria-pressed", "false");
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
