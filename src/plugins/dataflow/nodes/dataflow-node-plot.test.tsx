import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { IBaseNodeModel } from "./base-node";
import { DataflowNodePlot } from "./dataflow-node-plot";

// chart.js needs a real canvas, which jsdom does not provide, and nothing here depends on what the
// chart draws.
jest.mock("react-chartjs-2", () => ({ Line: () => <div data-testid="line-chart" /> }));

const model = {
  type: "Generator",
  watchedValues: {},
  getTickEntries: () => [],
  dsMax: 1, dsMin: 0, tickMax: 1, tickMin: 0,
  setDsMax: jest.fn(), setDsMin: jest.fn(),
  setTickMax: jest.fn(), setTickMin: jest.fn()
} as unknown as IBaseNodeModel;

// The plot is mounted only while it is open. That is what this test guards: the stopper below is
// attached by an effect that reads the ref once, so a plot kept mounted and hidden would attach
// nothing and leave the zoom buttons unusable once it was opened (CLUE-711).
function OpenablePlot({ onNodePointerDown }: { onNodePointerDown: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div onPointerDown={onNodePointerDown}>
      <button onClick={() => setOpen(true)}>open plot</button>
      {open && <DataflowNodePlot model={model} recordedTicks={[]} />}
    </div>
  );
}

describe("DataflowNodePlot keeps pointer presses away from the node drag handler", () => {
  it("stops a press on the zoom buttons after the plot is opened", () => {
    const onNodePointerDown = jest.fn();
    render(<OpenablePlot onNodePointerDown={onNodePointerDown} />);
    fireEvent.click(screen.getByText("open plot"));

    fireEvent.pointerDown(screen.getByText("+"), { bubbles: true });
    fireEvent.pointerDown(screen.getByText("-"), { bubbles: true });
    expect(onNodePointerDown).not.toHaveBeenCalled();
  });

  it("zooms in and out from the scale buttons", () => {
    render(<OpenablePlot onNodePointerDown={jest.fn()} />);
    fireEvent.click(screen.getByText("open plot"));

    fireEvent.mouseDown(screen.getByText("+"));
    expect(model.setTickMax).toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByText("-"));
    expect(model.setTickMin).toHaveBeenCalled();
  });
});
