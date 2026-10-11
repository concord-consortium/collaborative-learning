import React, { useRef } from "react";
import { fireEvent, render } from "@testing-library/react";

import { useStopEventPropagation } from "./custom-hooks";

// Pins the first-render requirement documented on the hook. The minigraph was mounted and hidden,
// so its zoom buttons were guarded by nothing and the mouse could not reach them (CLUE-711).
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
