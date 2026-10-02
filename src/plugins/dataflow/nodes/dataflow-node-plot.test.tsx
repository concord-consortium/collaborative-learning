import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { IBaseNodeModel } from "./base-node";
import { DataflowNodePlot } from "./dataflow-node-plot";

// chart.js needs a real canvas, which jsdom does not provide, and nothing here depends on what the
// chart draws.
jest.mock("react-chartjs-2", () => ({ Line: () => <div data-testid="line-chart" /> }));

// Fresh spies per test: every case asserts on setTickMax/setTickMin.
function makeModel(bounds: Partial<IBaseNodeModel> = {}) {
  return {
    type: "Generator",
    watchedValues: {},
    getTickEntries: () => [],
    dsMax: 1, dsMin: 0, tickMax: 1, tickMin: 0,
    setDsMax: jest.fn(), setDsMin: jest.fn(),
    setTickMax: jest.fn(), setTickMin: jest.fn(),
    ...bounds
  } as unknown as IBaseNodeModel;
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
});
