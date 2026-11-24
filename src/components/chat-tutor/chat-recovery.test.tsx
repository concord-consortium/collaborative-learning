import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Chat, buildChatTranscript } from "./chat";
import { UseChatResult } from "./use-chat";
import { ChatDelivery } from "../../../shared/chat-delivery";
import { turnFromDoc } from "./turn-from-doc";

const makeChat = (state: ChatDelivery["state"], overrides: Partial<UseChatResult> = {}): UseChatResult => ({
  turns: [{ id: "user", sender: "user", text: "My saved question" }], status: "error", error: null,
  pending: false, timedOut: false, sendMessage: jest.fn(), recover: jest.fn(async () => undefined), header: "Lesson",
  delivery: { id: "outcome", messageId: "user", code: "TEST", state }, ...overrides,
});

it.each([
  ["failed", "Continue conversation", "continue"], ["retryable", "Retry saved message", "retry"],
  ["unknown", "Check for reply", "retry"], ["closed", "Start a new conversation", "new_session"],
] as const)("offers the appropriate %s recovery without submitting a learner prompt", async (state, label, action) => {
  const chat = makeChat(state); render(<Chat chat={chat} />);
  expect(screen.getByRole("textbox")).toBeDisabled();
  expect(screen.queryByTestId("chat-typing")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: label }));
  await waitFor(() => expect(chat.recover).toHaveBeenCalledWith(action));
  expect(chat.sendMessage).not.toHaveBeenCalled();
});

it("keeps uncertain work fenced and requires support for a request conflict", () => {
  const { rerender } = render(<Chat chat={makeChat("unknown")} />);
  expect(screen.queryByRole("button", { name: "Continue conversation" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Start a new conversation" })).not.toBeInTheDocument();
  rerender(<Chat chat={makeChat("blocked")} />);
  expect(screen.getByTestId("chat-recovery")).toHaveTextContent("needs support");
  expect(screen.queryByRole("button", { name: "Check for reply" })).not.toBeInTheDocument();
});

it("waits while a request runs, then releases the spinner and exposes a check at the deadline", () => {
  const { rerender } = render(<Chat chat={makeChat("unknown", { pending: true, status: "generating" })} />);
  expect(screen.getByTestId("chat-typing")).toBeInTheDocument();
  expect(screen.queryByTestId("chat-recovery")).not.toBeInTheDocument();
  rerender(<Chat chat={makeChat("unknown", { pending: false, timedOut: true, status: "generating" })} />);
  expect(screen.queryByTestId("chat-typing")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check for reply" })).toBeEnabled();
});

it("preserves failed exchanges and recovery notices without attributing them to Ada", () => {
  const notice = turnFromDoc("delivery-user", {kind: "delivery", text: "The reply was not completed.",
    resolved: true, resolution: "continued"}, false)!;
  const chat = makeChat("failed", {turns: [{id: "user", sender: "user", text: "Question"}, notice]});
  render(<Chat chat={chat} />);
  expect(screen.getByTestId("chat-row-system")).toHaveTextContent("You chose to continue.");
  expect(screen.getByTestId("chat-live")).toHaveTextContent("");
  expect(buildChatTranscript(chat.turns)).toContain("**Delivery notice:**");
  expect(buildChatTranscript(chat.turns)).not.toContain("**Ada:**");
});
