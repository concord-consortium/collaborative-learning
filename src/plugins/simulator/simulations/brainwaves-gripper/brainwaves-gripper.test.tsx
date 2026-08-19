import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { Variable, VariableType } from "@concord-consortium/diagram-view";
import { LogEventName } from "../../../../lib/logger-types";
import { brainwavesGripperSimulation } from "./brainwaves-gripper";

const mockLogTileChangeEvent = jest.fn();
jest.mock("../../../../models/tiles/log/log-tile-change-event", () => ({
  logTileChangeEvent: (...args: any[]) => mockLogTileChangeEvent(...args)
}));

// tileId comes from context; variables come from the simulation's own props.
jest.mock("../../../../components/tiles/hooks/use-tile-model-context", () => ({
  useTileModelContext: () => ({ tile: { id: "sim-1" } })
}));

// Stub diagram-view's VariableSlider so its release callback (onChangeComplete) can be fired
// deterministically without simulating a pointer drag in jsdom. Keep the real Variable model.
jest.mock("@concord-consortium/diagram-view", () => {
  const actual = jest.requireActual("@concord-consortium/diagram-view");
  const ReactMod = jest.requireActual("react") as typeof import("react");
  return {
    ...actual,
    VariableSlider: (props: any) =>
      ReactMod.createElement("button",
        { "data-testid": "emg-release", onClick: () => props.onChangeComplete?.(props.variable) },
        "emg release")
  };
});

function makeVariables(): VariableType[] {
  return brainwavesGripperSimulation.variables.map(v => Variable.create(v));
}

describe("BrainwavesGripper logging", () => {
  beforeEach(() => {
    mockLogTileChangeEvent.mockReset();
  });

  it("logs one SIMULATOR_TOOL_CHANGE with a mode label when a mode button is clicked", () => {
    const variables = makeVariables();
    const Component = brainwavesGripperSimulation.component!;
    render(<Component frame={0} variables={variables} />);
    fireEvent.click(screen.getByText("Temperature"));

    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(1);
    expect(mockLogTileChangeEvent.mock.calls[0][0]).toBe(LogEventName.SIMULATOR_TOOL_CHANGE);
    const [, params] = mockLogTileChangeEvent.mock.calls[0];
    expect(params).toMatchObject({ tileId: "sim-1", operation: "setValue" });
    expect(typeof params.change.name).toBe("string");
    expect(params.change.valueLabel).toBe("Temperature");
    expect(params.change.variables).toBeDefined();
  });

  it("logs one SIMULATOR_TOOL_CHANGE (no label) when the EMG slider change completes", () => {
    const variables = makeVariables();
    const Component = brainwavesGripperSimulation.component!;
    render(<Component frame={0} variables={variables} />);
    fireEvent.click(screen.getByTestId("emg-release"));

    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(1);
    expect(mockLogTileChangeEvent.mock.calls[0][0]).toBe(LogEventName.SIMULATOR_TOOL_CHANGE);
    // A slider is a continuous control, so there's no valueLabel — the number is the meaning.
    const change = mockLogTileChangeEvent.mock.calls[0][1].change;
    expect(change.valueLabel).toBeUndefined();
    expect(change.variables).toBeDefined();
  });
});
