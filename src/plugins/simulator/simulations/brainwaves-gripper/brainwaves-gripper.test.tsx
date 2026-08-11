import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { Variable, VariableType } from "@concord-consortium/diagram-view";
import { LogEventName } from "../../../../lib/logger-types";
import { brainwavesGripperSimulation } from "./brainwaves-gripper";

const mockLogTileChangeEvent = jest.fn();
jest.mock("../../../../models/tiles/log/log-tile-change-event", () => ({
  logTileChangeEvent: (...args: any[]) => mockLogTileChangeEvent(...args)
}));

// tileId comes from context; variables (for the rendered EMG SimulatorSlider)
// come from useSimulatorContent.
const mockCtx: { variables: VariableType[] } = { variables: [] };
jest.mock("../../../../components/tiles/hooks/use-tile-model-context", () => ({
  useTileModelContext: () => ({ tile: { id: "sim-1" } })
}));
jest.mock("../../hooks/use-simulator-content", () => ({
  useSimulatorContent: () => ({ variables: mockCtx.variables })
}));

describe("BrainwavesGripper mode buttons", () => {
  beforeEach(() => {
    mockLogTileChangeEvent.mockReset();
    mockCtx.variables = [];
  });

  it("logs one SIMULATOR_TOOL_CHANGE when a mode button is clicked", () => {
    const variables: VariableType[] =
      brainwavesGripperSimulation.variables.map(v => Variable.create(v));
    mockCtx.variables = variables;
    const Component = brainwavesGripperSimulation.component!;

    render(<Component frame={0} variables={variables} />);
    fireEvent.click(screen.getByText("Temperature"));

    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(1);
    expect(mockLogTileChangeEvent.mock.calls[0][0]).toBe(LogEventName.SIMULATOR_TOOL_CHANGE);
    expect(mockLogTileChangeEvent.mock.calls[0][1]).toMatchObject({
      tileId: "sim-1",
      operation: "setValue"
    });
    // The change carries the mode variable name, a readable label for the new
    // mode, and a full variable snapshot.
    const change = mockLogTileChangeEvent.mock.calls[0][1].change;
    expect(typeof change.name).toBe("string");
    expect(change.valueLabel).toBe("Temperature");
    expect(change.variables).toBeDefined();
  });
});
