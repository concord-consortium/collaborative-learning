import { VariableType } from "@concord-consortium/diagram-view";
import { LogEventName } from "../../lib/logger-types";
import { logSimulatorVariableChange } from "./simulator-logging";

const mockLogTileChangeEvent = jest.fn();
jest.mock("../../models/tiles/log/log-tile-change-event", () => ({
  logTileChangeEvent: (...args: any[]) => mockLogTileChangeEvent(...args)
}));

// Minimal stand-in for a shared-variables Variable — the helper only reads
// `name` and `currentValue`.
function fakeVariable(name: string, currentValue: number | undefined): VariableType {
  return { name, currentValue } as unknown as VariableType;
}

describe("logSimulatorVariableChange", () => {
  beforeEach(() => mockLogTileChangeEvent.mockReset());

  it("emits SIMULATOR_TOOL_CHANGE with the changed variable and a full variable snapshot", () => {
    const mode = fakeVariable("mode", 1);
    const pressure = fakeVariable("pressure", 42);
    const emg = fakeVariable("emg", undefined);

    logSimulatorVariableChange("sim-1", mode, 1, [mode, pressure, emg]);

    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(1);
    expect(mockLogTileChangeEvent).toHaveBeenCalledWith(LogEventName.SIMULATOR_TOOL_CHANGE, {
      tileId: "sim-1",
      operation: "setValue",
      change: {
        name: "mode",
        value: 1,
        // Snapshot captures the current output/derived values (incl. undefined).
        variables: { mode: 1, pressure: 42, emg: undefined }
      }
    });
  });

  it("includes a valueLabel when one is supplied (discrete controls like mode buttons)", () => {
    const mode = fakeVariable("simulation_mode_key", 1);
    logSimulatorVariableChange("sim-1", mode, 1, [mode], "Temperature");
    expect(mockLogTileChangeEvent.mock.calls[0][1].change).toEqual({
      name: "simulation_mode_key",
      value: 1,
      valueLabel: "Temperature",
      variables: { simulation_mode_key: 1 }
    });
  });

  it("omits valueLabel when none is supplied (continuous controls like sliders)", () => {
    const emg = fakeVariable("targetEMG", 280);
    logSimulatorVariableChange("sim-1", emg, 280, [emg]);
    expect(mockLogTileChangeEvent.mock.calls[0][1].change).not.toHaveProperty("valueLabel");
  });

  it("skips variables without a name in the snapshot", () => {
    const named = fakeVariable("a", 3);
    const unnamed = fakeVariable(undefined as unknown as string, 9);

    logSimulatorVariableChange("sim-2", named, 3, [named, unnamed]);

    const change = mockLogTileChangeEvent.mock.calls[0][1].change;
    expect(change.variables).toEqual({ a: 3 });
  });
});
