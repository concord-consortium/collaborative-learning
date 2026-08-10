import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { Variable, VariableType } from "@concord-consortium/diagram-view";
import { LogEventName } from "../../../../lib/logger-types";
import { brainwavesGripperSimulation } from "./brainwaves-gripper";

const mockLogTileChangeEvent = jest.fn();
jest.mock("../../../../models/tiles/log/log-tile-change-event", () => ({
  logTileChangeEvent: (...args: any[]) => mockLogTileChangeEvent(...args)
}));

describe("BrainwavesGripper mode buttons", () => {
  beforeEach(() => mockLogTileChangeEvent.mockReset());

  it("logs one SIMULATOR_TOOL_CHANGE when a mode button is clicked", () => {
    const variables: VariableType[] =
      brainwavesGripperSimulation.variables.map(v => Variable.create(v));
    const Component = brainwavesGripperSimulation.component!;

    render(<Component frame={0} variables={variables} tileId="sim-1" />);
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
