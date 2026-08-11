import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { VariableType } from "@concord-consortium/diagram-view";
import { LogEventName } from "../../../../lib/logger-types";
import { SimulatorSlider } from "./simulator-slider";

const mockLogTileChangeEvent = jest.fn();
jest.mock("../../../../models/tiles/log/log-tile-change-event", () => ({
  logTileChangeEvent: (...args: any[]) => mockLogTileChangeEvent(...args)
}));

// tileId + variables now come from context, not props.
const mockCtx: { tileId?: string; variables: VariableType[] } = { tileId: "sim-1", variables: [] };
jest.mock("../../../../components/tiles/hooks/use-tile-model-context", () => ({
  useTileModelContext: () => ({ tile: mockCtx.tileId ? { id: mockCtx.tileId } : undefined })
}));
jest.mock("../../hooks/use-simulator-content", () => ({
  useSimulatorContent: () => ({ variables: mockCtx.variables })
}));

// Stub rc-slider so its onChange (drag) and onChangeComplete (release) can be
// fired deterministically without simulating a pointer drag in jsdom.
jest.mock("rc-slider", () => {
  const ReactMod = require("react");
  const Stub = (props: any) =>
    ReactMod.createElement("div", null,
      ReactMod.createElement("button",
        { "data-testid": "drag", onClick: () => props.onChange(200) }, "drag"),
      ReactMod.createElement("button",
        { "data-testid": "release", onClick: () => props.onChangeComplete(200) }, "release")
    );
  return { __esModule: true, default: Stub };
});

function makeVariable(): VariableType {
  return {
    name: "targetEMG",
    currentValue: 200,
    setTemporaryValue: jest.fn(),
    commitTemporaryValue: jest.fn(),
  } as unknown as VariableType;
}

describe("SimulatorSlider", () => {
  beforeEach(() => {
    mockLogTileChangeEvent.mockReset();
    mockCtx.tileId = "sim-1";
    mockCtx.variables = [];
  });

  it("commits and logs one SIMULATOR_TOOL_CHANGE on release", () => {
    const variable = makeVariable();
    mockCtx.variables = [variable];
    render(<SimulatorSlider min={40} max={440} step={40} variable={variable} />);
    fireEvent.click(screen.getByTestId("release"));
    expect(variable.commitTemporaryValue).toHaveBeenCalledTimes(1);
    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(1);
    expect(mockLogTileChangeEvent.mock.calls[0][0]).toBe(LogEventName.SIMULATOR_TOOL_CHANGE);
    expect(mockLogTileChangeEvent.mock.calls[0][1]).toMatchObject({
      tileId: "sim-1",
      operation: "setValue",
      // value is read from variable.currentValue; snapshot from context variables.
      change: { name: "targetEMG", value: 200, variables: { targetEMG: 200 } }
    });
  });

  it("sets the temporary value but does NOT log while dragging", () => {
    const variable = makeVariable();
    mockCtx.variables = [variable];
    render(<SimulatorSlider min={40} max={440} step={40} variable={variable} />);
    fireEvent.click(screen.getByTestId("drag"));
    expect(variable.setTemporaryValue).toHaveBeenCalledWith(200);
    expect(mockLogTileChangeEvent).not.toHaveBeenCalled();
  });

  it("commits but does not log when there is no tile id", () => {
    const variable = makeVariable();
    mockCtx.tileId = undefined;
    mockCtx.variables = [variable];
    render(<SimulatorSlider min={40} max={440} step={40} variable={variable} />);
    fireEvent.click(screen.getByTestId("release"));
    expect(variable.commitTemporaryValue).toHaveBeenCalledTimes(1);
    expect(mockLogTileChangeEvent).not.toHaveBeenCalled();
  });
});
