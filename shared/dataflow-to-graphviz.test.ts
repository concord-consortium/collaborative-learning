import { programToGraphviz } from "./dataflow-to-graphviz";

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
      <tr><td>Output</td><td port="value">value</td></tr>
    </table>
  >];
  "Number:Number 2" [label=<
    <table>
      <tr><td>plot</td><td>false</td></tr>
      <tr><td>value</td><td>3</td></tr>
      <tr><td>nodeValue</td><td>3</td></tr>
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
    </table>
  >];
  "Logic:Logic 1" [label=<
    <table>
      <tr><td>plot</td><td>false</td></tr>
      <tr><td>logicOperator</td><td>Greater Than</td></tr>
      <tr><td>nodeValue</td><td>NaN</td></tr>
      <tr><td>formula</td><td>unset_num1 &gt; unset_num2 ⇒ nodeValue</td></tr>
      <tr><td>formulaWithValues</td><td>unset_num1 &gt; unset_num2 ⇒ NaN</td></tr>
    </table>
  >];
  "Transform:Transform 1" [label=<
    <table>
      <tr><td>plot</td><td>false</td></tr>
      <tr><td>transformOperator</td><td>Absolute Value</td></tr>
      <tr><td>nodeValue</td><td>NaN</td></tr>
      <tr><td>formula</td><td>|unset_num1| = nodeValue</td></tr>
      <tr><td>formulaWithValues</td><td>|unset_num1| = NaN</td></tr>
    </table>
  >];

  "Number:Number 1":"value" -> "Math:Math 1":"num1";
  "Number:Number 2":"value" -> "Math:Math 1":"num2";
}`;

    expect(result).toBe(expected);
  });
});
