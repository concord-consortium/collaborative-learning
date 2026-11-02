import { renderHook } from "@testing-library/react";
import { useFollowNewRows } from "./use-follow-new-rows";

/** A stand-in for the grid's scroll container; jsdom reports 0 for every scroll metric and has no
 *  scrollTo. The stub applies the scroll so the hook's own at-bottom reads stay consistent. */
function makeElement({ scrollHeight = 500, clientHeight = 100, scrollTop = 400 } = {}) {
  const listeners: Array<() => void> = [];
  const element = {
    scrollHeight, clientHeight, scrollTop,
    scrollTo: jest.fn((options: ScrollToOptions) => {
      element.scrollTop = Math.min(options.top ?? 0, element.scrollHeight - element.clientHeight);
    }),
    addEventListener: (_type: string, fn: () => void) => listeners.push(fn),
    removeEventListener: jest.fn()
  };
  return { element, scroll: () => listeners.forEach(fn => fn()) };
}

/** Pins Date.now so a test controls which side of kSmoothMinIntervalMs a row lands on. */
function freezeTime() {
  jest.spyOn(Date, "now").mockReturnValue(Date.now() + 10_000);
}

function renderFollow(grid: ReturnType<typeof makeElement>, rowCount: number) {
  const ref = { current: grid as any };
  return renderHook(({ count }) => useFollowNewRows(ref, count), { initialProps: { count: rowCount } });
}

describe("useFollowNewRows", () => {
  afterEach(() => jest.restoreAllMocks());

  it("scrolls to the newest row when a row arrives", () => {
    const grid = makeElement();            // scrollTop 400 of 500 - 100: already at the bottom
    const { rerender } = renderFollow(grid, 5);

    grid.element.scrollHeight = 530;
    rerender({ count: 6 });

    expect(grid.element.scrollTop).toBe(430);
  });

  it("scrolls smoothly when rows arrive slowly enough to see", () => {
    const grid = makeElement();
    const { rerender } = renderFollow(grid, 5);
    freezeTime();

    grid.element.scrollHeight = 530;
    rerender({ count: 6 });

    expect(grid.element.scrollTo).toHaveBeenCalledWith({ top: 530, behavior: "smooth" });
  });

  it("jumps when rows arrive faster than the animation", () => {
    const grid = makeElement();
    const { rerender } = renderFollow(grid, 5);
    freezeTime();

    grid.element.scrollHeight = 530;
    rerender({ count: 6 });
    grid.element.scrollHeight = 560;
    rerender({ count: 7 });

    expect(grid.element.scrollTo).toHaveBeenLastCalledWith({ top: 560, behavior: "auto" });
  });

  // The bug this closes: a row arriving mid-animation used to leave the animation finishing one
  // row short of the bottom, whose scroll event then read as "the student scrolled away" -- and
  // nothing ever scrolled again. 500ms is a shipped sampling rate, so this was reachable.
  it("keeps following when a row arrives mid-animation", () => {
    const grid = makeElement();
    const { rerender } = renderFollow(grid, 5);
    freezeTime();

    grid.element.scrollHeight = 530;
    rerender({ count: 6 });                 // smooth scroll starts

    grid.element.scrollTop = 415;           // an intermediate frame of that animation
    grid.scroll();
    grid.element.scrollHeight = 560;
    rerender({ count: 7 });

    expect(grid.element.scrollTo).toHaveBeenLastCalledWith({ top: 560, behavior: "auto" });
  });

  it("does not scroll when the row count has not grown", () => {
    const grid = makeElement();
    const { rerender } = renderFollow(grid, 5);

    rerender({ count: 5 });

    expect(grid.element.scrollTop).toBe(400);
  });

  it("stops following once the student scrolls away from the bottom", () => {
    const grid = makeElement();
    const { rerender } = renderFollow(grid, 5);

    grid.element.scrollTop = 0;
    grid.scroll();
    grid.element.scrollHeight = 530;
    rerender({ count: 6 });

    expect(grid.element.scrollTop).toBe(0);
  });

  it("follows again once they scroll back to the bottom", () => {
    const grid = makeElement();
    const { rerender } = renderFollow(grid, 5);

    grid.element.scrollTop = 0;
    grid.scroll();
    rerender({ count: 6 });

    grid.element.scrollTop = 400;
    grid.scroll();
    grid.element.scrollHeight = 560;
    rerender({ count: 7 });

    expect(grid.element.scrollTop).toBe(460);
  });
});
