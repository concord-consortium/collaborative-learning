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

  // And when no Dataflow tile is in the document, the node is still on screen: the shared model
  // simply left no record of it. Saying nothing would report it deleted, which it is not.
  it("names a mini-node by its id when no program in the document holds it", () => {
    expect(describe_("n1", "node", {})).toBe("the n1 node in the simulation");
  });
});
