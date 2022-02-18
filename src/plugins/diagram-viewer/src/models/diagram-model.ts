import { Operation } from "./dq-node";

export const defaultDiagram = () => {
  // Default diagram
  return {
    nodes: {
        "1": {
            id: "1",
            value: 124,
            x: 100,
            y: 100
        },
        "2": {
            id: "2",
            x: 100,
            y: 200
        },
        "3": {
            id: "3",
            inputA: "1",
            inputB: "2",
            operation: Operation.Divide,
            x: 250,
            y: 150
        }
    }
  };
};
