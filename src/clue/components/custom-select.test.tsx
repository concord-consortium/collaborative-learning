import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { CustomSelect, ICustomDropdownItem } from "./custom-select";

// useDropdown's open effect re-queries the list inside a requestAnimationFrame, so tests that
// open the list have to let that frame (jsdom polyfills it with a ~16ms setTimeout) run before
// asserting on focus.
async function flushOpenEffect() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
  });
}

function makeItems(selectedText: string): ICustomDropdownItem[] {
  return ["January", "February", "March", "April"].map(text => ({
    text,
    selected: text === selectedText,
    onClick: jest.fn()
  }));
}

function openList() {
  fireEvent.click(screen.getByTestId("custom-select-header"));
}

describe("CustomSelect accessibility", () => {

  // Bug A (part 1): useDropdown's own getItemProps stamps aria-selected onto whichever item has
  // the keyboard cursor, not onto the item the student actually chose, so a screen reader
  // announces every option it arrows past as "selected". CustomSelect now overrides aria-selected
  // after spreading the hook's itemProps so it reflects the real selection instead.
  it("marks only the chosen item with aria-selected, regardless of keyboard cursor", async () => {
    render(<CustomSelect items={makeItems("March")} />);
    openList();
    await flushOpenEffect();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(4);
    const marchOption = options.find(o => o.textContent === "March");
    expect(marchOption).toHaveAttribute("aria-selected", "true");
    options.filter(o => o !== marchOption).forEach(o => {
      expect(o).not.toHaveAttribute("aria-selected", "true");
    });

    // Moving the keyboard cursor with ArrowDown must not relabel some other item as "selected" -
    // that was the whole bug: the hook used to stamp aria-selected onto the cursor position.
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
    const optionsAfterMove = screen.getAllByRole("option");
    const marchAfterMove = optionsAfterMove.find(o => o.textContent === "March");
    expect(marchAfterMove).toHaveAttribute("aria-selected", "true");
    optionsAfterMove.filter(o => o !== marchAfterMove).forEach(o => {
      expect(o).not.toHaveAttribute("aria-selected", "true");
    });
  });

  // Bug A (part 2): useDropdown's open effect looks in the DOM for `[aria-selected="true"]` to
  // decide where to focus when the list opens, falling back to item 0 if nothing matches. Before
  // this fix nothing ever carried that attribute at open time, so opening always focused the
  // first item (e.g. the WaveRunner month list silently landing on a month 12 back). Now that the
  // chosen item itself carries aria-selected="true", the hook's own effect finds and focuses it.
  it("focuses the chosen item when the list opens, not the first item", async () => {
    render(<CustomSelect items={makeItems("March")} />);
    openList();
    await flushOpenEffect();

    const options = screen.getAllByRole("option");
    const marchOption = options.find(o => o.textContent === "March");
    const januaryOption = options.find(o => o.textContent === "January");
    expect(document.activeElement).toBe(marchOption);
    expect(document.activeElement).not.toBe(januaryOption);
  });

  // Bug B: useDropdown's handleListKeyDown calls preventDefault()+close() on Escape but never
  // stopPropagation(), so in a real page the key keeps bubbling into whatever wraps the list (in
  // the WaveRunner date picker, a React Aria Popover that dismisses itself on Escape, discarding
  // the pending pick along with the month list). CustomSelect's onKeyDown now runs the hook's
  // handler first, then stops Escape specifically from propagating further.
  it("stops Escape from propagating past the list, without swallowing other keys", async () => {
    const onAncestorKeyDown = jest.fn();
    render(
      <div onKeyDown={onAncestorKeyDown}>
        <CustomSelect items={makeItems("March")} />
      </div>
    );
    openList();
    await flushOpenEffect();

    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "Escape" });
    expect(onAncestorKeyDown).not.toHaveBeenCalled();
    // The hook's own Escape behavior (closing the list) must still happen.
    expect(screen.getByTestId("custom-select-header")).not.toHaveClass("show-list");

    // Re-open and confirm a key CustomSelect does not special-case (ArrowDown) still reaches
    // ancestors normally - the wrapper must not swallow everything indiscriminately.
    openList();
    await flushOpenEffect();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
    expect(onAncestorKeyDown).toHaveBeenCalledTimes(1);
  });
});
