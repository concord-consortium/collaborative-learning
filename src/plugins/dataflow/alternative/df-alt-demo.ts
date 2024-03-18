// Demo of running the engine with a simple graph
// This can be run with
//   npx tsx src/plugins/dataflow/alternative/df-alt-demo.ts

import { GNodeType } from "./df-alt-core";
import { engineFetch } from "./df-alt-engine";
import { ValueNode } from "./df-alt-num-node";
import { SumNode } from "./df-alt-sum-node";

const value1 = new ValueNode();
value1.id = "1";
const value2 = new ValueNode();
value2.id = "2";

const sum = new SumNode();
sum.id = "3";
sum.inputConnections = {};
sum.inputConnections.left = {nodeId: value1.id, nodePort: "value"};
sum.inputConnections.right = {nodeId: value2.id, nodePort: "value"};

const nodeMap: Record<string, GNodeType> = {
  1: value1,
  2: value2,
  3: sum
};

const fetchedResult = engineFetch(sum, nodeMap);

console.log("fetchedResult", fetchedResult);
