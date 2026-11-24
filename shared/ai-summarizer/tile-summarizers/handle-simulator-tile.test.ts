import { describeSimulatorObject } from "./handle-simulator-tile";

const dataflowTile = {
  id: "df1",
  content: {
    type: "Dataflow",
    program: { nodes: { n1: { id: "n1", name: "Sensor", data: { type: "Sensor", orderedDisplayName: "Sensor 1" } } } }
  }
};

function describe_(objectId: string, objectType: string, tileMap: any = { df1: dataflowTile }) {
  return describeSimulatorObject({
    tile: { id: "sim1", content: { type: "Simulator", simulation: "potentiometer_chip" } },
    objectId, objectType, dataSets: [], variables: [], tileMap
  });
}

describe("describeSimulatorObject", () => {
  it("names a board pin", () => {
    expect(describe_("L3", "pin")).toBe("pin L3");
  });

  it("reports nothing for an id that is not a pin", () => {
    expect(describe_("Z9", "pin")).toBeUndefined();
  });

  // The simulator's mini-nodes mirror a Dataflow program through a shared model whose node list is
  // volatile -- never written to the document. The ids match the program's, so the program is where
  // the name comes from.
  it("names a mini-node after the dataflow node it mirrors", () => {
    expect(describe_("n1", "node")).toBe("the Sensor 1 node, shown in the simulation");
  });

  // A mini-node exists only as a mirror of a Dataflow node. Delete the node and the mini-node goes
  // with it, so an id no program holds is an id with nothing on screen under it.
  it("reports nothing for a mini-node no program in the document holds", () => {
    expect(describe_("n1", "node", {})).toBeUndefined();
  });

  it("reports nothing when the program is present but the node has been deleted", () => {
    const program = { nodes: { n2: { name: "Sensor" } } };
    const tileMap = { df1: { id: "df1", content: { type: "Dataflow", program } } };
    expect(describe_("n1", "node", tileMap)).toBeUndefined();
  });
});
