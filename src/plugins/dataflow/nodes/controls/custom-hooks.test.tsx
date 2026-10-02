import React, { useRef } from "react";
import { fireEvent, render } from "@testing-library/react";

import { useStopEventPropagation } from "./custom-hooks";

// The hook reads the ref once, in an effect whose dependencies never change. Anything it guards has
// to be in the DOM on the first render — a component that renders the element later (after a toggle,
// say) gets no listener at all, which is how the minigraph's zoom buttons became unusable with the
// mouse (CLUE-711).
describe("useStopEventPropagation", () => {
  function Guarded({ render: renderTarget }: { render: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    useStopEventPropagation(ref, "pointerdown");
    return renderTarget ? <div ref={ref} data-testid="target" /> : null;
  }

  function pressTarget(initiallyRendered: boolean) {
    const onOuterPointerDown = jest.fn();
    const { rerender, getByTestId } = render(
      <div onPointerDown={onOuterPointerDown}><Guarded render={initiallyRendered} /></div>
    );
    rerender(<div onPointerDown={onOuterPointerDown}><Guarded render={true} /></div>);
    fireEvent.pointerDown(getByTestId("target"), { bubbles: true });
    return onOuterPointerDown;
  }

  it("stops the event when the element is present on the first render", () => {
    expect(pressTarget(true)).not.toHaveBeenCalled();
  });

  it("does not guard an element that appears only after the first render", () => {
    expect(pressTarget(false)).toHaveBeenCalled();
  });
});
