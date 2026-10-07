import { act, render } from "@testing-library/react";
import React from "react";
import { kAnnounceDelayMs, useLiveAnnouncer } from "./use-live-announcer";

describe("useLiveAnnouncer", () => {
  let announce: (text: string) => void;

  function Harness() {
    const announcer = useLiveAnnouncer();
    announce = announcer.announce;
    return <div ref={announcer.announcerRef} aria-live="polite" />;
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("sets the text after a short delay", () => {
    const { container } = render(<Harness />);
    const region = container.querySelector("[aria-live]")!;
    act(() => announce("Hello"));
    expect(region.textContent).toBe("");
    act(() => { jest.advanceTimersByTime(kAnnounceDelayMs); });
    expect(region.textContent).toBe("Hello");
  });

  it("clears the region before repeating an identical message", () => {
    const { container } = render(<Harness />);
    const region = container.querySelector("[aria-live]")!;
    act(() => announce("Hello"));
    act(() => { jest.advanceTimersByTime(kAnnounceDelayMs); });
    act(() => announce("Hello"));
    expect(region.textContent).toBe("");
    act(() => { jest.advanceTimersByTime(kAnnounceDelayMs); });
    expect(region.textContent).toBe("Hello");
  });

  it("announces only the latest of several rapid messages", () => {
    const { container } = render(<Harness />);
    const region = container.querySelector("[aria-live]")!;
    act(() => announce("First"));
    act(() => announce("Second"));
    act(() => { jest.advanceTimersByTime(kAnnounceDelayMs); });
    expect(region.textContent).toBe("Second");
  });

  it("doesn't touch the region after unmounting", () => {
    const { unmount } = render(<Harness />);
    act(() => announce("Hello"));
    unmount();
    expect(() => act(() => { jest.advanceTimersByTime(kAnnounceDelayMs); })).not.toThrow();
  });
});
