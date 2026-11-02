import { renderHook } from "@testing-library/react";
import { useFollowNewRows } from "./use-follow-new-rows";

/** A stand-in for the grid's scroll container; jsdom reports 0 for every scroll metric. */
function makeElement({ scrollHeight = 500, clientHeight = 100, scrollTop = 400 }) {
  const listeners: Array<() => void> = [];
  return {
    element: {
      scrollHeight, clientHeight, scrollTop,
      addEventListener: (_type: string, fn: () => void) => listeners.push(fn),
      removeEventListener: jest.fn()
    },
    scroll: () => listeners.forEach(fn => fn())
  };
}

function renderFollow(grid: ReturnType<typeof makeElement>, rowCount: number) {
  const ref = { current: grid as any };
  return renderHook(({ count }) => useFollowNewRows(ref, count), { initialProps: { count: rowCount } });
}

describe("useFollowNewRows", () => {
  it("scrolls to the newest row when a row arrives", () => {
    const grid = makeElement({});          // scrollTop 400 of 500 - 100: already at the bottom
    const { rerender } = renderFollow(grid, 5);

    grid.element.scrollHeight = 530;
    rerender({ count: 6 });

    expect(grid.element.scrollTop).toBe(530);
  });

  it("does not scroll when the row count has not grown", () => {
    const grid = makeElement({});
    const { rerender } = renderFollow(grid, 5);

    rerender({ count: 5 });

    expect(grid.element.scrollTop).toBe(400);
  });

  // A student reading earlier rows must not be yanked back by the next recorded point.
  it("stops following once the student scrolls away from the bottom", () => {
    const grid = makeElement({});
    const { rerender } = renderFollow(grid, 5);

    grid.element.scrollTop = 0;
    grid.scroll();
    grid.element.scrollHeight = 530;
    rerender({ count: 6 });

    expect(grid.element.scrollTop).toBe(0);
  });

  it("follows again once they scroll back to the bottom", () => {
    const grid = makeElement({});
    const { rerender } = renderFollow(grid, 5);

    grid.element.scrollTop = 0;
    grid.scroll();
    rerender({ count: 6 });

    grid.element.scrollTop = 400;
    grid.scroll();
    grid.element.scrollHeight = 560;
    rerender({ count: 7 });

    expect(grid.element.scrollTop).toBe(560);
  });
});
