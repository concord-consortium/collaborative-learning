import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Chat, buildChatTranscript } from "./chat";
import { UseChatResult } from "./use-chat";
import { ChatDelivery, deliveryMessage, kContinuedMessage, kNewSessionMessage } from "../../../shared/chat-delivery";
import { turnFromDoc } from "./turn-from-doc";
import { kMaxChatMessageChars } from "../../../shared/chat-message";

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
  const input = screen.getByRole("textbox");
  expect(input).toHaveAttribute("readonly");
  expect(input).toHaveAttribute("aria-disabled", "true");
  expect(input).not.toBeDisabled();
  expect(screen.queryByTestId("chat-typing")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: label }));
  await waitFor(() => expect(chat.recover).toHaveBeenCalledWith(action));
  expect(chat.sendMessage).not.toHaveBeenCalled();
});

it("keeps focus in the composer and refuses to submit while a reply is pending", () => {
  const chat = makeChat("unknown", { delivery: undefined, status: "idle" });
  const { rerender } = render(<Chat chat={chat} />);
  const input = screen.getByRole("textbox");
  input.focus();
  fireEvent.change(input, { target: { value: "Another question" } });
  rerender(<Chat chat={{ ...chat, pending: true, status: "generating",
    delivery: { id: "pending", messageId: "user", code: "FL_REQUEST_PENDING", state: "unknown" } }} />);
  expect(document.activeElement).toBe(input);
  fireEvent.submit(screen.getByTestId("chat-composer"));
  expect(chat.sendMessage).not.toHaveBeenCalled();
});

it("moves focus to the composer when a recovery button is clicked", async () => {
  const chat = makeChat("retryable");
  const { rerender } = render(<Chat chat={chat} />);
  const retry = screen.getByRole("button", { name: "Retry saved message" });
  retry.focus();
  fireEvent.click(retry);
  await waitFor(() => expect(chat.recover).toHaveBeenCalledWith("retry"));
  rerender(<Chat chat={{ ...chat, pending: true, status: "generating" }} />);
  expect(screen.queryByRole("button", { name: "Retry saved message" })).not.toBeInTheDocument();
  expect(document.activeElement).toBe(screen.getByRole("textbox"));
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

it("limits the composer to the longest message the rules accept", () => {
  render(<Chat chat={makeChat("unknown", { delivery: undefined, status: "idle" })} />);
  expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", String(kMaxChatMessageChars));
});

describe("delivery failure announcements", () => {
  const idle = () => makeChat("failed", { delivery: undefined, status: "idle" });

  it("mounts the announcement region empty before any failure, then writes the notice into it", () => {
    const { rerender } = render(<Chat chat={idle()} />);
    const region = screen.getByTestId("chat-delivery-live");
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveTextContent("");
    rerender(<Chat chat={makeChat("failed")} />);
    expect(screen.getByTestId("chat-delivery-live")).toBe(region);
    expect(region).toHaveTextContent(deliveryMessage("failed"));
  });

  it("keeps the recovery button outside the announcement region", () => {
    render(<Chat chat={makeChat("retryable")} />);
    const button = screen.getByRole("button", { name: "Retry saved message" });
    expect(screen.getByTestId("chat-delivery-live")).not.toContainElement(button);
    expect(screen.getByTestId("chat-recovery").getAttribute("role")).toBeNull();
  });

  it("describes the fenced composer by the notice", () => {
    render(<Chat chat={makeChat("blocked")} />);
    const describedBy = screen.getByRole("textbox").getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(deliveryMessage("blocked"));
  });

  it.each([["failed", "Continue conversation", kContinuedMessage],
    ["closed", "Start a new conversation", kNewSessionMessage]] as const)(
    "announces the outcome after a %s delivery is resolved", async (state, label, announced) => {
      const chat = makeChat(state);
      const { rerender } = render(<Chat chat={chat} />);
      fireEvent.click(screen.getByRole("button", { name: label }));
      await waitFor(() => expect(chat.recover).toHaveBeenCalled());
      rerender(<Chat chat={{ ...chat, delivery: undefined, status: "idle" }} />);
      expect(screen.getByTestId("chat-delivery-live")).toHaveTextContent(announced);
    });
});

describe("delivery notices in the transcript", () => {
  it("leaves an unresolved notice to the recovery panel and shows it once resolved", () => {
    const notice = { kind: "delivery", text: deliveryMessage("failed"), resolved: false };
    expect(turnFromDoc("delivery-m", notice, false)).toBeUndefined();
    expect(turnFromDoc("delivery-m", { ...notice, resolved: true, resolution: "continued" }, false))
      .toMatchObject({ sender: "system", text: `${deliveryMessage("failed")} You chose to continue.` });
  });
});

describe("a recovery still running when the conversation changes", () => {
  const deferredRecover = () => {
    let settle!: () => void;
    const recover = jest.fn(() => new Promise<void>(resolve => { settle = resolve; }));
    return { recover, settle: () => settle() };
  };

  it("does not disable the new conversation's recovery button", async () => {
    const first = deferredRecover();
    const { rerender } = render(<Chat chat={makeChat("retryable", { recover: first.recover })} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry saved message" }));
    expect(screen.getByRole("button", { name: "Retry saved message" })).toBeDisabled();

    const second = deferredRecover();
    rerender(<Chat chat={makeChat("retryable", { recover: second.recover })} />);
    expect(screen.getByRole("button", { name: "Retry saved message" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Retry saved message" }));
    expect(screen.getByRole("button", { name: "Retry saved message" })).toBeDisabled();
    first.settle();
    await waitFor(() => expect(first.recover).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.getByRole("button", { name: "Retry saved message" })).toBeDisabled();
    second.settle();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry saved message" })).toBeEnabled());
  });

  it("does not announce its outcome in the new conversation", () => {
    const first = deferredRecover();
    const { rerender } = render(<Chat chat={makeChat("failed", { recover: first.recover })} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue conversation" }));
    rerender(<Chat chat={makeChat("failed", { recover: jest.fn(), delivery: undefined, status: "idle" })} />);
    expect(screen.getByTestId("chat-delivery-live")).toHaveTextContent("");
  });
});
