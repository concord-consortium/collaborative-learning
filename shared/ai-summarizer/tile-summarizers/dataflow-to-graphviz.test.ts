import { getSnapshot } from "mobx-state-tree";
import { programToGraphviz } from "./dataflow-to-graphviz";
import {
  DataflowNodeModel, DataflowProgramModel
} from "../../../src/plugins/dataflow/model/dataflow-program-model";

describe("programToGraphviz", () => {
  it("converts a dataflow program with math operation to graphviz format", () => {
    const program = {
      "id": "dataflow@1",
      "nodes": {
        "7ZRiN_2uNGilJII0": {
          "id": "7ZRiN_2uNGilJII0",
          "name": "Number",
          "x": 40.9453125,
          "y": 2.86328125,
          "data": {
            "type": "Number",
            "plot": false,
            "orderedDisplayName": "Number 1",
            "value": 2,
            "tickEntries": {
              "tick1": { "nodeValue": "2" }
            }
          }
        },
        "5TnGPjp2Cfvcwnw_": {
          "id": "5TnGPjp2Cfvcwnw_",
          "name": "Number",
          "x": 40,
          "y": 121.89453125,
          "data": {
            "type": "Number",
            "plot": false,
            "orderedDisplayName": "Number 2",
            "value": 3,
            "tickEntries": {
              "tick1": { "nodeValue": "3" }
            }
          }
        },
        "oFu_7v2unK3-Uc1s": {
          "id": "oFu_7v2unK3-Uc1s",
          "name": "Math",
          "x": 359.12109375,
          "y": 42.125,
          "data": {
            "type": "Math",
            "plot": false,
            "orderedDisplayName": "Math 1",
            "mathOperator": "Add",
            "tickEntries": {
              "tick1": { "nodeValue": "5" }
            }
          }
        },
        "node4": {
          "id": "node4",
          "name": "Logic",
          "x": 359.12109375,
          "y": 42.125,
          "data": {
            "type": "Logic",
            "plot": false,
            "orderedDisplayName": "Logic 1",
            "logicOperator": "Greater Than",
            "tickEntries": {
              "tick1": { "nodeValue": "NaN" }
            }
          }
        },
        "node5": {
          "id": "node5",
          "name": "Transform",
          "x": 500,
          "y": 100,
          "data": {
            "type": "Transform",
            "plot": false,
            "orderedDisplayName": "Transform 1",
            "transformOperator": "Absolute Value",
            "tickEntries": {
              "tick1": { "nodeValue": "NaN" }
            }
          }
        },
      },
      "connections": {
        "5addee09ce694a7d": {
          "id": "5addee09ce694a7d",
          "source": "7ZRiN_2uNGilJII0",
          "sourceOutput": "value",
          "target": "oFu_7v2unK3-Uc1s",
          "targetInput": "num1"
        },
        "ca3708c87ba29537": {
          "id": "ca3708c87ba29537",
          "source": "5TnGPjp2Cfvcwnw_",
          "sourceOutput": "value",
          "target": "oFu_7v2unK3-Uc1s",
          "targetInput": "num2"
        }
      },
      "recentTicks": ["tick1"]
    };

    const result = programToGraphviz(program);

    const expected = `digraph dataflow {
  rankdir=LR;
  node [shape=plain];

  "Number:Number 1" [label=<
    <table>
      <tr><td>plot</td><td>false</td></tr>
      <tr><td>value</td><td>2</td></tr>
      <tr><td>nodeValue</td><td>2</td></tr>
      <tr><td>id</td><td>7ZRiN_2uNGilJII0</td></tr>
      <tr><td>Output</td><td port="value">value</td></tr>
    </table>
  >];
  "Number:Number 2" [label=<
    <table>
      <tr><td>plot</td><td>false</td></tr>
      <tr><td>value</td><td>3</td></tr>
      <tr><td>nodeValue</td><td>3</td></tr>
      <tr><td>id</td><td>5TnGPjp2Cfvcwnw_</td></tr>
      <tr><td>Output</td><td port="value">value</td></tr>
    </table>
  >];
  "Math:Math 1" [label=<
    <table>
      <tr><td port="num1">Input</td><td>num1</td></tr>
      <tr><td port="num2">Input</td><td>num2</td></tr>
      <tr><td>plot</td><td>false</td></tr>
      <tr><td>mathOperator</td><td>Add</td></tr>
      <tr><td>nodeValue</td><td>5</td></tr>
      <tr><td>formula</td><td>Number:Number 1 + Number:Number 2 = nodeValue</td></tr>
      <tr><td>formulaWithValues</td><td>2 + 3 = 5</td></tr>
      <tr><td>id</td><td>oFu_7v2unK3-Uc1s</td></tr>
    </table>
  >];
  "Logic:Logic 1" [label=<
    <table>
      <tr><td>plot</td><td>false</td></tr>
      <tr><td>logicOperator</td><td>Greater Than</td></tr>
      <tr><td>nodeValue</td><td>NaN</td></tr>
      <tr><td>formula</td><td>unset_num1 &gt; unset_num2 ⇒ nodeValue</td></tr>
      <tr><td>formulaWithValues</td><td>unset_num1 &gt; unset_num2 ⇒ NaN</td></tr>
      <tr><td>id</td><td>node4</td></tr>
    </table>
  >];
  "Transform:Transform 1" [label=<
    <table>
      <tr><td>plot</td><td>false</td></tr>
      <tr><td>transformOperator</td><td>Absolute Value</td></tr>
      <tr><td>nodeValue</td><td>NaN</td></tr>
      <tr><td>formula</td><td>|unset_num1| = nodeValue</td></tr>
      <tr><td>formulaWithValues</td><td>|unset_num1| = NaN</td></tr>
      <tr><td>id</td><td>node5</td></tr>
    </table>
  >];

  "Number:Number 1":"value" -> "Math:Math 1":"num1";
  "Number:Number 2":"value" -> "Math:Math 1":"num2";
}`;

    expect(result).toBe(expected);
  });

  it("wraps grouped nodes in a labeled Graphviz cluster", () => {
    const program = {
      id: "dataflow@1",
      nodes: {
        n1: { id: "n1", name: "Number", x: 0, y: 0,
          data: { type: "Number", orderedDisplayName: "Number 1", value: 1 } },
        n2: { id: "n2", name: "Number", x: 0, y: 0,
          data: { type: "Number", orderedDisplayName: "Number 2", value: 2 } },
        n3: { id: "n3", name: "Math", x: 0, y: 0,
          data: { type: "Math", orderedDisplayName: "Math 1", mathOperator: "Add" } },
      },
      connections: {
        c1: { id: "c1", source: "n1", sourceOutput: "num", target: "n3", targetInput: "num1" },
      },
      groups: {
        g1: { id: "g1", label: "My Group", nodeIds: { n1: "n1", n2: "n2" }, collapsed: false },
      },
    };
    const dot = programToGraphviz(program as any);
    expect(dot).toContain("subgraph cluster_g1 {");
    expect(dot).toContain('label="My Group";');

    // Grouped members are declared inside the cluster; the ungrouped Math node is at the top level.
    const clusterStart = dot.indexOf("subgraph cluster_g1");
    const clusterBlock = dot.slice(clusterStart, dot.indexOf("}", clusterStart));
    expect(clusterBlock).toContain("Number:Number 1");
    expect(clusterBlock).toContain("Number:Number 2");
    expect(clusterBlock).not.toContain("Math:Math 1");
  });

  it("escapes newlines and quotes in multi-line group labels", () => {
    const program = {
      id: "dataflow@1",
      nodes: {
        n1: { id: "n1", name: "Number", x: 0, y: 0,
          data: { type: "Number", orderedDisplayName: "Number 1", value: 1 } },
        n2: { id: "n2", name: "Number", x: 0, y: 0,
          data: { type: "Number", orderedDisplayName: "Number 2", value: 2 } },
      },
      connections: {},
      groups: {
        g1: { id: "g1", label: 'Line 1\nLine "2"', nodeIds: { n1: "n1", n2: "n2" }, collapsed: false },
      },
    };
    const dot = programToGraphviz(program as any);
    // Newlines become the DOT `\n` escape and quotes are escaped, keeping label="..." on one line.
    expect(dot).toContain('label="Line 1\\nLine \\"2\\"";');
    expect(dot).not.toContain("label=\"Line 1\nLine");
  });

  // The fixtures above hand-write the program shape, so they can drift from what the model
  // actually persists. This one builds the program through the MST model and feeds the real
  // snapshot in — `GroupModel.nodeIds` is a `types.map`, so its snapshot is an object keyed by
  // node id, not an array. Treating it as an array threw `nodeIds.forEach is not a function`
  // for every grouped document, which the hand-written fixtures could not catch.
  it("handles a group from a real DataflowProgramModel snapshot", () => {
    const program = DataflowProgramModel.create();
    [["n1", 1], ["n2", 2], ["n3", 3]].forEach(([id, value]) => program.addNode(
      DataflowNodeModel.create(
        { id: id as string, name: "Number", x: 0, y: 0, data: { type: "Number", value: value as number } }
      )
    ));
    program.createGroup(["n1", "n2"], "My Group");

    const snapshot = JSON.parse(JSON.stringify(getSnapshot(program)));
    const group = Object.values(snapshot.groups)[0] as { nodeIds: Record<string, string> };
    expect(Array.isArray(group.nodeIds)).toBe(false);
    expect(Object.keys(group.nodeIds).sort()).toEqual(["n1", "n2"]);

    const dot = programToGraphviz(snapshot);
    expect(dot).toContain('label="My Group";');
    // The two members are declared inside the cluster and the third node stays at the top level.
    // Each node's `value` identifies it here, since `orderedDisplayName` is only populated for a
    // node attached to a live tile.
    const clusterStart = dot.indexOf("subgraph cluster_");
    const clusterBlock = dot.slice(clusterStart, dot.indexOf("}", clusterStart));
    expect(clusterBlock).toContain("<td>value</td><td>1</td>");
    expect(clusterBlock).toContain("<td>value</td><td>2</td>");
    expect(clusterBlock).not.toContain("<td>value</td><td>3</td>");
    expect(dot).toContain("<td>value</td><td>3</td>");
  });

  describe("node ids", () => {
    const program = {
      id: "dataflow@1",
      nodes: {
        "7ZRiN_2uNGilJII0": {
          id: "7ZRiN_2uNGilJII0",
          name: "Number",
          x: 0,
          y: 0,
          data: { type: "Number", plot: false, orderedDisplayName: "Number 1", value: 2 }
        }
      },
      connections: {}
    };

    it("emits the real node id as a property row", () => {
      const dot = programToGraphviz(program);
      expect(dot).toContain("<tr><td>id</td><td>7ZRiN_2uNGilJII0</td></tr>");
    });

    it("still uses the readable label as the graph identifier", () => {
      const dot = programToGraphviz(program);
      expect(dot).toContain('"Number:Number 1" [label=<');
      expect(dot).not.toContain('"7ZRiN_2uNGilJII0" [label=<');
    });

    // The id is spread last so it wins against anything a node's own data carries under the same
    // key. Without a conflicting case the ordering is unpinned and moving the spread to the front
    // would break nothing — while quietly making the summary name an id no document stores.
    it("takes the node's own id over an id in its data", () => {
      const dot = programToGraphviz({
        ...program,
        nodes: {
          "7ZRiN_2uNGilJII0": {
            ...program.nodes["7ZRiN_2uNGilJII0"],
            data: { ...program.nodes["7ZRiN_2uNGilJII0"].data, id: "not-the-real-id" }
          }
        }
      });
      expect(dot).toContain("<tr><td>id</td><td>7ZRiN_2uNGilJII0</td></tr>");
      expect(dot).not.toContain("not-the-real-id");
    });
  });
});
