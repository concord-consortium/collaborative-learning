import { kHistoryStart, SessionExactness } from "./session-exactness";

describe("SessionExactness", () => {
  it("is not exact until the load sets where the guarantee starts", () => {
    const e = new SessionExactness();
    expect(e.isExact).toBe(false);
    e.startAt("entry-5");
    expect(e.isExact).toBe(true);
    expect(e.exactSince).toBe("entry-5");
  });

  it("stays not exact once marked, keeping the first reason", () => {
    const e = new SessionExactness();
    e.startAt(kHistoryStart);
    e.markNotExact("timed-out-entry");
    e.markNotExact("unrecorded-change");
    e.startAt("entry-9");
    expect(e.isExact).toBe(false);
    expect(e.notExactReason).toBe("timed-out-entry");
  });

  it("keeps the first starting point", () => {
    const e = new SessionExactness();
    e.startAt("entry-5");
    e.startAt("entry-9");
    expect(e.exactSince).toBe("entry-5");
  });

  it("starts over when restarted, whatever the earlier session decided", () => {
    const e = new SessionExactness();
    e.startAt("entry-5");
    e.markNotExact("timed-out-entry");
    e.restart();
    expect(e.exactSince).toBeUndefined();
    expect(e.notExactReason).toBeUndefined();
    e.startAt("entry-9");
    expect(e.isExact).toBe(true);
    expect(e.exactSince).toBe("entry-9");
  });
});
