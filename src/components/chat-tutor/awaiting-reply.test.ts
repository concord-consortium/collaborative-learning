import { isAwaitingReply } from "./awaiting-reply";

describe("isAwaitingReply", () => {
  it("clears typing indicator for a silent assistant reply that produces no turn", () => {
    // A user message followed by an assistant message means the tutor has replied, whether or
    // not that reply produced a visible turn, so we are NOT awaiting a reply.
    expect(isAwaitingReply(["user", "assistant"])).toBe(false);
  });

  it("awaits reply when an assistant reply is followed by a user message", () => {
    expect(isAwaitingReply(["assistant", "user"])).toBe(true);
  });

  it("awaits reply when there is only a user message", () => {
    expect(isAwaitingReply(["user"])).toBe(true);
  });

  it("does not await a reply when the list is empty", () => {
    expect(isAwaitingReply([])).toBe(false);
  });

  it("ignores unknown and undefined kinds", () => {
    // Unknown kinds are neither "user" nor "assistant", so they don't affect the indices
    expect(isAwaitingReply(["user", "system", undefined, "assistant"])).toBe(false);
    expect(isAwaitingReply(["user", "unknown"])).toBe(true);
  });
});
