import { DataflowNodeModel } from "./dataflow-program-model";

describe("DataflowProgramModel", () => {
  it("should handle nodes with explicit x and y", () => {
    const node = {
      id: 0,
      name: 'node',
      x: 1,
      y: 2,
      inputs: {},
      outputs: {},
      data: {}
    };
    const mstNode = DataflowNodeModel.create(node);
    expect(mstNode.x).toBe(1);
    expect(mstNode.y).toBe(2);
  });
});
