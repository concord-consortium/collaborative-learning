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

// The units dropdown had no guard, so it could not be opened with the mouse (CLUE-711).
describe("NumberUnitsControl keeps pointer presses away from the node drag handler", () => {
  const kUnits = ["sec", "min", "hr"];

  function pressOn(selector: string, units = kUnits) {
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
    expect(pressOn(".type-options-back")).not.toHaveBeenCalled();
  });

  it("stops a press on the number input", () => {
    expect(pressOn("input.number-input")).not.toHaveBeenCalled();
  });

  it("leaves the rest of the control draggable", () => {
    expect(pressOn(".number-label")).toHaveBeenCalled();
  });
});
