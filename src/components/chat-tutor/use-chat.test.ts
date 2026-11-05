import { act, renderHook } from "@testing-library/react";
import { ChatStatus, ChatTransport, ChatTurn } from "./transport";
import { ChatLogContext, kReplyDeadlineMs, useChat } from "./use-chat";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";

jest.mock("../../lib/logger", () => ({ Logger: { log: jest.fn() } }));
const mockLog = Logger.log as jest.Mock;

// A transport whose emitters the test drives directly, so turns and status can be pushed in any
// order a real conversation produces them.
function stubTransport() {
  let emitTurns: (turns: ChatTurn[]) => void = () => undefined;
  let emitStatus: (status: ChatStatus) => void = () => undefined;
  const sendUserMessage = jest.fn(async () => undefined);
  const transport: ChatTransport = {
    subscribe(onTurns, onStatus) {
      emitTurns = onTurns;
      emitStatus = onStatus;
      onTurns([]);
      onStatus("idle");
      return () => undefined;
    },
    sendUserMessage,
  };
  return {
    transport,
    sendUserMessage,
    turns: (t: ChatTurn[]) => act(() => { emitTurns(t); }),
    status: (s: ChatStatus) => act(() => { emitStatus(s); }),
  };
}

const userTurn = (id: string): ChatTurn => ({ id, sender: "user", text: "help" });
const assistantTurn = (id: string): ChatTurn => ({ id, sender: "assistant", text: "here you go" });
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

const renderChat = (transport: ChatTransport, logContext?: ChatLogContext) =>
  renderHook(() => useChat({ transport, header: "Doc · 1.1", logContext }));

// Cleared for every test, not just the logging block below: the deadline tests log too, and a
// stale call from one of them would quietly satisfy an assertion added here later.
beforeEach(() => {
  jest.useFakeTimers();
  mockLog.mockClear();
});
afterEach(() => jest.useRealTimers());

describe("useChat reply deadline", () => {

  it("never times out while idle", () => {
    const t = stubTransport();
    const { result } = renderChat(t.transport);

    advance(kReplyDeadlineMs * 2);

    expect(result.current.timedOut).toBe(false);
    expect(result.current.pending).toBe(false);
  });

  it("keeps the typing indicator until the deadline, then stops it", () => {
    const t = stubTransport();
    const { result } = renderChat(t.transport);

    t.turns([userTurn("m1")]);
    t.status("generating");

    advance(kReplyDeadlineMs - 1);
    expect(result.current.pending).toBe(true);
    expect(result.current.timedOut).toBe(false);

    advance(1);
    expect(result.current.pending).toBe(false);
    expect(result.current.timedOut).toBe(true);
  });

  // The case a `waiting`-only dependency list gets wrong: the student would inherit the first
  // message's clock and be told Ada didn't answer seconds after sending the second one.
  it("starts a fresh deadline for a message sent while already waiting", () => {
    const t = stubTransport();
    const { result } = renderChat(t.transport);

    const nearlyDue = kReplyDeadlineMs - 5_000;

    t.turns([userTurn("m1")]);
    t.status("generating");
    advance(nearlyDue);

    t.turns([userTurn("m1"), userTurn("m2")]);
    advance(nearlyDue); // well past one deadline in total, but not since the second message

    expect(result.current.timedOut).toBe(false);

    advance(5_001);
    expect(result.current.timedOut).toBe(true);
  });

  it("clears the timeout and renders the turn when a late reply arrives", () => {
    const t = stubTransport();
    const { result } = renderChat(t.transport);

    t.turns([userTurn("m1")]);
    t.status("generating");
    advance(kReplyDeadlineMs);
    expect(result.current.timedOut).toBe(true);

    t.turns([userTurn("m1"), assistantTurn("a1")]);
    t.status("idle");

    expect(result.current.timedOut).toBe(false);
    expect(result.current.turns).toHaveLength(2);
  });

  it("resets when the transport swaps, and the old conversation's timer cannot fire", () => {
    const first = stubTransport();
    const second = stubTransport();
    const { result, rerender } = renderHook(
      ({ transport }) => useChat({ transport, header: "Doc · 1.1" }),
      { initialProps: { transport: first.transport } }
    );

    first.turns([userTurn("m1")]);
    first.status("generating");
    advance(kReplyDeadlineMs);
    expect(result.current.timedOut).toBe(true);

    rerender({ transport: second.transport });
    expect(result.current.timedOut).toBe(false);

    advance(kReplyDeadlineMs * 2);
    expect(result.current.timedOut).toBe(false);
  });
});


// MESSAGE_SENT is the denominator the failure events are a rate of, so what does and does not
// count as a send decides whether that rate means anything.
describe("useChat logging", () => {
  const logContext = { conversationId: "conv-1", documentKey: "doc-1" };

  const renderWithContext = (transport: ChatTransport) => renderChat(transport, logContext);

  const eventsNamed = (event: LogEventName) =>
    mockLog.mock.calls.filter(([e]) => e === event);

  it("logs the timeout exactly once, however many renders follow", async () => {
    const t = stubTransport();
    const { result, rerender } = renderWithContext(t.transport);

    await act(async () => { await result.current.sendMessage("how do I start?"); });
    t.turns([userTurn("m1")]);
    t.status("generating");
    advance(kReplyDeadlineMs);
    rerender();
    rerender();

    expect(eventsNamed(LogEventName.AI_CHAT_TIMEOUT)).toEqual([
      [LogEventName.AI_CHAT_TIMEOUT, logContext]
    ]);
  });

  // The transport re-emits its status on every snapshot, so a log keyed on anything but the
  // transition would fire repeatedly for one failure.
  it("logs an unavailable backend once per transition, not once per snapshot", async () => {
    const t = stubTransport();
    const { result } = renderWithContext(t.transport);

    await act(async () => { await result.current.sendMessage("how do I start?"); });
    t.status("error");
    t.status("error");

    expect(eventsNamed(LogEventName.AI_CHAT_UNAVAILABLE)).toHaveLength(1);
  });

  // The parent doc's "error" persists in Firestore, so reopening a failed conversation transitions
  // idle -> error again. Counting those would inflate the failure rate with repeat views.
  it("does not log an unavailable backend for a conversation that was already failed on open", () => {
    const t = stubTransport();
    renderChat(t.transport, logContext);

    t.status("error");

    expect(eventsNamed(LogEventName.AI_CHAT_UNAVAILABLE)).toHaveLength(0);
  });

  it("logs a send that landed", async () => {
    const t = stubTransport();
    const { result } = renderWithContext(t.transport);

    await act(async () => { await result.current.sendMessage("how do I start?"); });

    expect(eventsNamed(LogEventName.AI_CHAT_MESSAGE_SENT)).toEqual([
      [LogEventName.AI_CHAT_MESSAGE_SENT, logContext]
    ]);
  });

  // The denominator counts messages the backend could have answered, so a write that never
  // landed is not one of them.
  it("does not log a send whose write failed", async () => {
    const t = stubTransport();
    t.sendUserMessage.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderWithContext(t.transport);

    await act(async () => {
      await expect(result.current.sendMessage("how do I start?")).rejects.toThrow("offline");
    });

    expect(eventsNamed(LogEventName.AI_CHAT_MESSAGE_SENT)).toHaveLength(0);
  });

  // A wedged conversation re-arms the deadline every time the sidebar is reopened, because
  // isAwaitingReply is computed over rehydrated history. The message must still appear — the
  // conversation really is unanswered — but counting it again would inflate the timeout rate
  // against a denominator that counted the send once.
  it("shows the timeout for a conversation already waiting on open, but does not log it", () => {
    const t = stubTransport();
    const { result } = renderChat(t.transport, logContext);

    // No send in this session: this is rehydrated history for a turn sent earlier.
    t.turns([userTurn("m1")]);
    t.status("generating");
    advance(kReplyDeadlineMs);

    expect(result.current.timedOut).toBe(true);
    expect(eventsNamed(LogEventName.AI_CHAT_TIMEOUT)).toHaveLength(0);
  });

  it("logs the timeout for a message sent in this session", async () => {
    const t = stubTransport();
    const { result } = renderChat(t.transport, logContext);

    await act(async () => { await result.current.sendMessage("how do I start?"); });
    t.turns([userTurn("m1")]);
    t.status("generating");
    advance(kReplyDeadlineMs);

    expect(eventsNamed(LogEventName.AI_CHAT_TIMEOUT)).toHaveLength(1);
  });

  // These logs reach a research database and Rollbar. Student writing belongs in neither, and a
  // failure rate does not need it.
  it("never puts the student's message into a log payload", async () => {
    const t = stubTransport();
    const { result } = renderWithContext(t.transport);

    await act(async () => { await result.current.sendMessage("my secret answer"); });
    t.turns([userTurn("m1")]);
    t.status("generating");
    advance(kReplyDeadlineMs);
    t.status("error");

    expect(mockLog).toHaveBeenCalled();
    expect(JSON.stringify(mockLog.mock.calls)).not.toContain("my secret answer");
  });
});
