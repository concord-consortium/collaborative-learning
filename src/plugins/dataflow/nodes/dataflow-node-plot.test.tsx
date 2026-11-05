import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { IBaseNodeModel } from "./base-node";
import { DataflowNodePlot } from "./dataflow-node-plot";

// chart.js needs a real canvas, which jsdom does not provide, and nothing here depends on what the
// chart draws.
const mockLine = jest.fn();
jest.mock("react-chartjs-2", () => ({
  Line: (props: any) => { mockLine(props); return <div data-testid="line-chart" />; }
}));

// Fresh spies per test: every case asserts on setTickMax/setTickMin. The ds setters write
// through as the real model's do, because the axis is read from dsMin/dsMax in the same render
// that lineData updates them -- a spy that only records would make every auto-scaled axis read
// as the empty -Infinity/Infinity defaults.
function makeModel(bounds: Partial<IBaseNodeModel> = {}) {
  const model = {
    type: "Generator",
    watchedValues: {},
    getTickEntries: () => [],
    dsMax: 1, dsMin: 0, tickMax: 1, tickMin: 0,
    setDsMax: jest.fn((max: number) => { model.dsMax = max; }),
    setDsMin: jest.fn((min: number) => { model.dsMin = min; }),
    setTickMax: jest.fn(), setTickMin: jest.fn(),
    ...bounds
  };
  return model as unknown as IBaseNodeModel;
}

function OpenablePlot({ model, onNodePointerDown }:
                      { model: IBaseNodeModel; onNodePointerDown: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div onPointerDown={onNodePointerDown}>
      <button onClick={() => setOpen(true)}>open plot</button>
      {open && <DataflowNodePlot model={model} recordedTicks={[]} />}
    </div>
  );
}

describe("DataflowNodePlot", () => {
  // Opening the plot, rather than rendering it open, is the case that used to fail: the guard is
  // attached from a ref read on the first render, so a plot kept mounted and hidden guarded nothing.
  it("keeps a press on the zoom buttons away from the node drag handler", () => {
    const onNodePointerDown = jest.fn();
    render(<OpenablePlot model={makeModel()} onNodePointerDown={onNodePointerDown} />);
    fireEvent.click(screen.getByText("open plot"));

    fireEvent.pointerDown(screen.getByText("+"), { bubbles: true });
    fireEvent.pointerDown(screen.getByText("-"), { bubbles: true });
    expect(onNodePointerDown).not.toHaveBeenCalled();
  });

  it("zooms in and out from the scale buttons", () => {
    const model = makeModel();
    render(<OpenablePlot model={model} onNodePointerDown={jest.fn()} />);
    fireEvent.click(screen.getByText("open plot"));

    fireEvent.mouseDown(screen.getByText("+"));
    expect(model.setTickMax).toHaveBeenCalledWith(0.9);
    fireEvent.mouseDown(screen.getByText("-"));
    expect(model.setTickMin).toHaveBeenCalledWith(-0.125);
  });

  it("zooms a block whose value never moves, instead of leaving it stuck", () => {
    const flat = makeModel({ dsMax: 0, dsMin: 0, tickMax: 0, tickMin: 0 });
    render(<div><DataflowNodePlot model={flat} recordedTicks={[]} /></div>);

    fireEvent.mouseDown(screen.getByText("-"));
    expect(flat.setTickMax).toHaveBeenCalledWith(0.625);
    expect(flat.setTickMin).toHaveBeenCalledWith(-0.625);
  });

  it("zooms a block that has no plotted values yet", () => {
    const empty = makeModel({ dsMax: -Infinity, dsMin: Infinity,
                              tickMax: undefined, tickMin: undefined });
    render(<div><DataflowNodePlot model={empty} recordedTicks={[]} /></div>);

    fireEvent.mouseDown(screen.getByText("+"));
    expect(empty.setTickMax).toHaveBeenCalledWith(0.4);
    expect(empty.setTickMin).toHaveBeenCalledWith(-0.4);
  });

  const servoModel = (entries: any[]) => makeModel({
    watchedValues: { nodeValue: {} },
    getTickEntries: () => entries,
    dsMax: -Infinity, dsMin: Infinity, tickMax: undefined, tickMin: undefined
  } as any);
  const percentScale = { toPlot: (v: number) => v / 180 * 100, min: 0, max: 100 };
  const axisOfLastChart = () => {
    const y = mockLine.mock.lastCall[0].options.scales.y;
    return { min: y.min, max: y.max };
  };

  it("plots through the declared scale, so the trace is in the node's display units", () => {
    const model = servoModel([{ nodeValue: 90 }, { nodeValue: 180 }]);
    render(<DataflowNodePlot model={model} recordedTicks={["a", "b"]} plotScale={() => percentScale} />);

    expect(mockLine.mock.lastCall[0].data.datasets[0].data).toEqual([50, 100]);
  });

  // The point of CLUE-789: the axis is the range the unit configured, not the range the student
  // happened to drive the block through.
  it("uses the declared range as the axis even when the values never reach it", () => {
    const model = servoModel([{ nodeValue: 18 }, { nodeValue: 36 }]);
    render(<DataflowNodePlot model={model} recordedTicks={["a", "b"]} plotScale={() => percentScale} />);

    expect(axisOfLastChart()).toEqual({ min: 0, max: 100 });
  });

  it("scales to the data when the node declares no range", () => {
    const model = servoModel([{ nodeValue: 18 }, { nodeValue: 36 }]);
    render(<DataflowNodePlot model={model} recordedTicks={["a", "b"]} />);

    expect(axisOfLastChart()).toEqual({ min: 18, max: 36 });
  });

  // The Advanced Gripper's shape: a position the field reads out, and a tilt series beside it.
  // The axis belongs to the first series, so the block is readable in its own units.
  const twoSeriesModel = () => makeModel({
    watchedValues: { nodeValue: {}, tilt: {} },
    getTickEntries: () => [{ nodeValue: 18, tilt: -1 }, { nodeValue: 36, tilt: 1 }],
    dsMax: -Infinity, dsMin: Infinity, tickMax: undefined, tickMin: undefined
  } as any);

  it("takes the axis from the first series that declares one, not from the others", () => {
    const model = twoSeriesModel();
    render(<DataflowNodePlot model={model} recordedTicks={["a", "b"]}
      plotScale={key => key === "nodeValue" ? percentScale : undefined} />);

    expect(axisOfLastChart()).toEqual({ min: 0, max: 100 });
  });

  // With only one series declaring a range, first and last are the same thing: this is the case
  // that actually pins the order.
  it("prefers the first series' axis when more than one declares one", () => {
    const model = twoSeriesModel();
    const tiltScale = { min: -1, max: 1 };
    render(<DataflowNodePlot model={model} recordedTicks={["a", "b"]}
      plotScale={key => key === "nodeValue" ? percentScale : tiltScale} />);

    expect(axisOfLastChart()).toEqual({ min: 0, max: 100 });
  });

  it("still plots the undeclared series, unconverted, on that axis", () => {
    const model = twoSeriesModel();
    render(<DataflowNodePlot model={model} recordedTicks={["a", "b"]}
      plotScale={key => key === "nodeValue" ? percentScale : undefined} />);

    const [position, tilt] = mockLine.mock.lastCall[0].data.datasets;
    expect(position.data).toEqual([10, 20]);
    expect(tilt.data).toEqual([-1, 1]);
  });

  it("lets a zoom override the declared range", () => {
    const model = servoModel([{ nodeValue: 90 }]);
    model.tickMax = 60;
    model.tickMin = 20;
    render(<DataflowNodePlot model={model} recordedTicks={["a"]} plotScale={() => percentScale} />);

    expect(axisOfLastChart()).toEqual({ min: 20, max: 60 });
  });
});
