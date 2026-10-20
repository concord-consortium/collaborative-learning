import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react";

import { useStopEventPropagation } from "./custom-hooks";

describe("useStopEventPropagation", () => {
  function Guarded({ render: renderTarget }: { render: boolean }) {
    const [el, setEl] = useState<HTMLDivElement | null>(null);
    useStopEventPropagation(el, "pointerdown");
    return renderTarget ? <div ref={setEl} data-testid="target" /> : null;
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

  // The minigraph is mounted hidden and its content rendered when it opens, so the element the
  // guard is for does not exist on the first render. Taking a ref instead of the element, the
  // effect ran once with nothing to attach to and the zoom buttons were guarded by nothing.
  it("guards an element that appears only after the first render", () => {
    expect(pressTarget(false)).not.toHaveBeenCalled();
  });
});
