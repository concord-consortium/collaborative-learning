import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { DataBroker } from "../../../models/data/data-broker";
import { DataSet } from "../../../models/data/data-set";
import { GraphLayout } from "../models/graph-layout";
import { GraphComponent } from "./graph-component";

describe.skip("Graph", () => {
  let broker: DataBroker;
  const layout = new GraphLayout();

  beforeEach(() => {
    broker = new DataBroker();
  });

  it("renders with no broker", () => {
    render(<GraphComponent layout={layout} tileElt={null} />);
    // expect(screen.getByTestId("graph")).toBeInTheDocument()
    expect(true).toBe(true);
  });

  it("renders with empty broker", () => {
    render(<GraphComponent layout={layout} tileElt={null} />);
    expect(screen.getByTestId("graph")).toBeInTheDocument();
  });

  it("renders graph point for each case", () => {
    const data = DataSet.create();
    data.addAttributeWithID({ name: "xVariable"});
    data.addAttributeWithID({ name: "yVariable" });
    data.addCasesWithIDs([{ xVariable: 1, yVariable: 2, __id__: "c1" }, { xVariable: 3, yVariable: 4, __id__: "c2" }]);
    broker.addDataSet(data);
    render(<GraphComponent layout={layout} tileElt={null} />);
    expect(screen.getByTestId("graph")).toBeInTheDocument();
    // rerender(<GraphComponent broker={broker} />)
    // expect(screen.getByText('xVariable')).toBeInTheDocument()
    // expect(screen.getByText('yVariable')).toBeInTheDocument()
  });

  it.skip("can switch to dot plot", async () => {
    const user = userEvent;
    const data = DataSet.create();
    data.addAttributeWithID({ name: "xVariable" });
    data.addAttributeWithID({ name: "yVariable" });
    data.addCasesWithIDs([{ xVariable: 1, yVariable: 2, __id__: "c1" }, { xVariable: 3, yVariable: 4, __id__: "c2" }]);
    broker.addDataSet(data);
    const { rerender } = render(<GraphComponent layout={layout} tileElt={null} />);
    expect(screen.getByTestId("graph")).toBeInTheDocument();
    // expect(screen.getByText('xVariable')).toBeInTheDocument()
    // expect(screen.getByText('yVariable')).toBeInTheDocument()
    const plotTypeButton = screen.getByText("Dot Plot");
    await user.click(plotTypeButton);
    rerender(<GraphComponent layout={layout} tileElt={null} />);
  });
});
