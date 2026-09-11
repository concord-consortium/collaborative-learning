import { dataflowRunValues, projectDataflowTile } from "./dataflow-tile";

// A three-node program in the shape a live CLUE document holds: nodes keyed by id, connections in
// their own map, and per-node tickEntries recording the values of each run.
const program = {
  id: "dataflow@1",
  nodes: {
    "n-sensor": {
      id: "n-sensor", name: "Sensor", x: 31.26, y: 93.92,
      data: {
        type: "Sensor", plot: false, orderedDisplayName: "Sensor 1",
        tickEntries: { "t1": { nodeValue: "37" }, "t2": { nodeValue: "39" } },
        sensorType: "emg-reading", sensor: "SIMemg_key", sensorDisplayName: "Simulated EMG",
      },
    },
    "n-logic": {
      id: "n-logic", name: "Logic", x: 241.69, y: 165.75,
      data: {
        type: "Logic", plot: true, orderedDisplayName: "Compare 1",
        tickEntries: { "t1": { nodeValue: "0" }, "t2": { nodeValue: "0" } },
        logicOperator: "Greater Than",
      },
    },
    "n-out": {
      id: "n-out", name: "Demo Output", x: 674.09, y: 84.55,
      data: {
        type: "Demo Output", plot: false, orderedDisplayName: "Demo Device 1",
        tickEntries: { "t1": { nodeValue: "0" }, "t2": { nodeValue: "1" } },
        outputType: "Grabber",
      },
    },
  },
  connections: {
    "c1": { id: "c1", source: "n-sensor", sourceOutput: "value", target: "n-logic", targetInput: "num1" },
    "c2": { id: "c2", source: "n-logic", sourceOutput: "value", target: "n-out", targetInput: "nodeValue" },
  },
  groups: {},
  recentTicks: ["t1", "t2"],
};
const content = { type: "Dataflow", program, programDataRate: 1000, programZoom: { dx: 0, dy: 0, scale: 1 } };

describe("projectDataflowTile", () => {
  it("carries the tile id, type and title", () => {
    const tile = projectDataflowTile(content, "tile-df-1", "EMG Gripper Program");
    expect(tile.tile_id).toBe("tile-df-1");
    expect(tile.type).toBe("Dataflow");
    expect(tile.title).toBe("EMG Gripper Program");
    expect(tile.content.program_id).toBe("dataflow@1");
  });

  it("projects nodes as a list carrying the real id and the student-visible name", () => {
    const { nodes } = projectDataflowTile(content, "tile-df-1").content;
    expect(nodes.map(n => n.id)).toEqual(["n-sensor", "n-logic", "n-out"]);
    expect(nodes[1]).toMatchObject({
      id: "n-logic", type: "Logic", orderedDisplayName: "Compare 1", plot: true,
      options: { logicOperator: "Greater Than" },
    });
  });

  it("flattens connections into edges naming the target input", () => {
    const { edges } = projectDataflowTile(content, "tile-df-1").content;
    expect(edges).toEqual([
      { from: "n-sensor", to: "n-logic", to_input: "num1" },
      { from: "n-logic", to: "n-out", to_input: "nodeValue" },
    ]);
  });

  // tickEntries are ~60% of a raw DataFlow tile and are near-identical run to run. The current
  // value belongs in run_state; the history is not evidence anyone asked for.
  it("drops tickEntries from the projected nodes", () => {
    const json = JSON.stringify(projectDataflowTile(content, "tile-df-1"));
    expect(json).not.toContain("tickEntries");
    expect(json).not.toContain("\"t1\"");
  });

  // Canvas position says nothing about the program's logic.
  it("drops node coordinates", () => {
    const { nodes } = projectDataflowTile(content, "tile-df-1").content;
    nodes.forEach(n => expect(n).not.toHaveProperty("x"));
    nodes.forEach(n => expect(n).not.toHaveProperty("y"));
  });

  // Live values have a dedicated home. Putting them in options was our invention, and their own
  // sample has no such field — a value in the wrong place is one the diagnostic will not read.
  it("does not put live values in node options", () => {
    const { nodes } = projectDataflowTile(content, "tile-df-1").content;
    nodes.forEach(n => expect(n.options ?? {}).not.toHaveProperty("nodeValue"));
  });

  // Sent alongside nodes/edges rather than instead of them. ForeverLearning have agreed in
  // principle to take this rendering as the payload but have not switched, and a probe confirmed
  // the extra key is accepted today — so sending both is what lets them evaluate it on live turns
  // rather than from an emailed sample.
  it("includes the summarizer's rendering of the program", () => {
    const { rendering } = projectDataflowTile(content, "tile-df-1").content;
    expect(rendering).toEqual(expect.stringContaining("digraph dataflow"));
  });

  // The rendering is only useful beside the structured form because it carries the same ids their
  // citations resolve against — which CLUE-598 put there deliberately.
  it("the rendering carries the real node ids", () => {
    const { rendering } = projectDataflowTile(content, "tile-df-1").content;
    expect(rendering).toEqual(expect.stringContaining("n-logic"));
    expect(rendering).toEqual(expect.stringContaining("n-sensor"));
  });
});

describe("dataflowRunValues", () => {
  it("reads each node's value from the most recent tick", () => {
    expect(dataflowRunValues(content)).toEqual([
      { node_id: "n-sensor", value: "39" },
      { node_id: "n-logic", value: "0" },
      { node_id: "n-out", value: "1" },
    ]);
  });

  it("yields nothing for a program that has never been run", () => {
    const unrun = { ...content, program: { ...program, recentTicks: [] } };
    expect(dataflowRunValues(unrun)).toEqual([]);
  });
});
