import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Chat } from "./chat";
import { ChatTurn } from "./transport";
import { kReplyDeadlineMs, kTimeoutMessage, UseChatResult } from "./use-chat";

const chatResult = (over: Partial<UseChatResult> = {}): UseChatResult => ({
  turns: [], status: "idle", error: null, pending: false, timedOut: false,
  sendMessage: jest.fn(async () => undefined), header: "Doc · 1.1", ...over
});

const reply: ChatTurn = { id: "a1", sender: "assistant", text: "Try the sensor block." };

describe("Chat reply timeout", () => {
  it("shows the timeout message when the deadline has passed", () => {
    render(<Chat chat={chatResult({ timedOut: true })} />);
    expect(screen.getByTestId("chat-error")).toHaveTextContent(kTimeoutMessage);
  });

  // A real send failure must not be masked by the deadline that follows it.
  it("prefers a send error over the timeout message", () => {
    render(<Chat chat={chatResult({ timedOut: true, error: "Failed to send your message." })} />);
    expect(screen.getByTestId("chat-error")).toHaveTextContent("Failed to send your message.");
  });

  // The live region keys on `pending` going false to announce a completed reply, and the deadline
  // flips `pending` false too — so without a guard a timeout announces the PREVIOUS reply as if it
  // had just arrived, telling a screen-reader user Ada answered at the moment Ada failed to.
  it("does not announce the previous reply when the deadline fires", () => {
    render(<Chat chat={chatResult({ timedOut: true, turns: [reply] })} />);
    expect(screen.getByTestId("chat-live")).toHaveTextContent("");
  });

  it("announces a reply normally when nothing has timed out", () => {
    render(<Chat chat={chatResult({ turns: [reply] })} />);
    expect(screen.getByTestId("chat-live")).toHaveTextContent("Ada said: Try the sensor block.");
  });

  it("shows no message row when there is neither an error nor a timeout", () => {
    render(<Chat chat={chatResult()} />);
    expect(screen.queryByTestId("chat-error")).not.toBeInTheDocument();
  });
});

// Firestore resolves add() only once the backend acknowledges it, so an offline write stays
// pending indefinitely. The deadline therefore has to bound the composer's own sending state, not
// just the wait for a reply, or the dots run on past it with the input disabled.
describe("Chat with a send that never resolves", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("releases the composer and stops the dots on the deadline", () => {
    const chat = chatResult({ sendMessage: jest.fn(() => new Promise<void>(() => undefined)) });
    render(<Chat chat={chat} />);

    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "how do I start?" } });
    fireEvent.submit(screen.getByTestId("chat-composer"));

    expect(screen.getByTestId("chat-typing")).toBeInTheDocument();
    expect(screen.getByTestId("chat-input")).toBeDisabled();

    act(() => { jest.advanceTimersByTime(kReplyDeadlineMs); });

    expect(screen.queryByTestId("chat-typing")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-input")).not.toBeDisabled();
  });

  // Once the composer is released the student can send again, and the first send may still settle.
  it("does not let a superseded send re-disable the composer or overwrite the new draft", () => {
    let failFirst: (e: Error) => void = () => undefined;
    const sendMessage = jest.fn()
      .mockImplementationOnce(() => new Promise<void>((_r, rej) => { failFirst = rej; }))
      .mockImplementationOnce(() => new Promise<void>(() => undefined));
    render(<Chat chat={chatResult({ sendMessage })} />);
    const input = () => screen.getByTestId("chat-input") as HTMLInputElement;

    fireEvent.change(input(), { target: { value: "first message" } });
    fireEvent.submit(screen.getByTestId("chat-composer"));
    act(() => { jest.advanceTimersByTime(kReplyDeadlineMs); });

    fireEvent.change(input(), { target: { value: "second message" } });
    fireEvent.submit(screen.getByTestId("chat-composer"));
    expect(input()).toBeDisabled();

    act(() => { failFirst(new Error("offline")); });

    expect(input()).toBeDisabled();          // the second send is still in flight
    expect(input().value).toBe("");          // and the student's composer is not stuffed with the first
  });
});
