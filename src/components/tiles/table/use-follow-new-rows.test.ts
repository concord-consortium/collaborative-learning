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

const kInputRowId = "input-row";

interface IFollowProps { count: number, caseIds?: string[], readOnly?: boolean }

/** The grid's rows, shaped as the table builds them: one per case, then the input row unless the
 *  table is read-only. The cases are case-1..case-count unless a test gives its own, so growing the
 *  count reads as an append. */
function rowsFor({ count, caseIds, readOnly }: IFollowProps) {
  const ids = caseIds ?? Array.from({ length: count }, (_, i) => `case-${i + 1}`);
  const rows = ids.map(id => ({ __id__: id }));
  return readOnly ? rows : [...rows, { __id__: kInputRowId }];
}

function renderFollow(grid: ReturnType<typeof makeElement>, rowCount: number, readOnly = false) {
  const ref = { current: grid as any };
  return renderHook(
    (props: IFollowProps) => useFollowNewRows(ref, rowsFor(props), kInputRowId),
    { initialProps: { count: rowCount, readOnly } as IFollowProps }
  );
}

describe("useFollowNewRows", () => {
  afterEach(() => jest.restoreAllMocks());

  // The input row is always last in an editable table, so the hook has to look past it to see a
  // new case arrive.
  it("scrolls to the newest row when a row arrives", () => {
    const grid = makeElement();            // scrollTop 400 of 500 - 100: already at the bottom
    const { rerender } = renderFollow(grid, 5);

    grid.element.scrollHeight = 530;
    rerender({ count: 6 });

    expect(grid.element.scrollTop).toBe(430);
  });

  it("scrolls to the newest row in a read-only table, which has no input row", () => {
    const grid = makeElement();
    const { rerender } = renderFollow(grid, 5, true);

    grid.element.scrollHeight = 530;
    rerender({ count: 6, readOnly: true });

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

  it("does not scroll when a row is inserted mid-table", () => {
    const grid = makeElement();
    const { rerender } = renderFollow(grid, 5);

    grid.element.scrollHeight = 530;
    // grew, but the same case is still last
    rerender({ count: 6, caseIds: ["case-1", "case-2", "new", "case-3", "case-4", "case-5"] });

    expect(grid.element.scrollTop).toBe(400);
  });

  it("does not scroll when a sort or reorder puts a different row last", () => {
    const grid = makeElement();
    const { rerender } = renderFollow(grid, 5);

    rerender({ count: 5, caseIds: ["case-5", "case-4", "case-3", "case-2", "case-1"] });

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
