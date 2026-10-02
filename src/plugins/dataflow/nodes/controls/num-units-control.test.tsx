import React from "react";
import { fireEvent, render } from "@testing-library/react";

import { INumberUnitsControl, NumberUnitsControlComponent } from "./num-units-control";

function makeFakeControl(units: string[]): INumberUnitsControl {
  let value = 10;
  let currentUnits = units[0];
  return {
    id: "ctl-1",
    node: { readOnly: false } as any,
    units,
    setValue: (v: number) => { value = v; },
    getValue: () => value,
    getValueForUser: () => value,
    setValueFromUser: (v: number) => { value = v; },
    getCurrentUnits: () => currentUnits,
    setCurrentUnits: (v: string) => { currentUnits = v; },
    label: "period",
    tooltip: "Set Period",
    logEvent: () => undefined
  };
}

// rete starts a node drag from any pointerdown that reaches the node element, which takes the press
// away from the control under it. Every interactive control inside a node has to stop pointerdown
// before it gets there; the units dropdown did not, so it could not be opened with the mouse
// (CLUE-711).
describe("NumberUnitsControl keeps pointer presses away from the node drag handler", () => {
  function pressOn(selector: string, units: string[]) {
    const onNodePointerDown = jest.fn();
    const { container } = render(
      <div onPointerDown={onNodePointerDown}>
        <NumberUnitsControlComponent data={makeFakeControl(units)} />
      </div>
    );
    const target = container.querySelector(selector);
    expect(target).not.toBeNull();
    fireEvent.pointerDown(target!, { bubbles: true });
    return onNodePointerDown;
  }

  it("stops a press on the units dropdown", () => {
    expect(pressOn(".type-options-back", ["sec", "min", "hr"])).not.toHaveBeenCalled();
  });

  it("stops a press on the number input", () => {
    expect(pressOn("input.number-input", ["sec", "min", "hr"])).not.toHaveBeenCalled();
  });

  it("leaves the rest of the control draggable", () => {
    expect(pressOn(".number-label", ["sec", "min", "hr"])).toHaveBeenCalled();
  });
});
