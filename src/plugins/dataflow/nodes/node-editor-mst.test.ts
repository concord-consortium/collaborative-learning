import { applyPatch } from "mobx-state-tree";
import { DataflowProgramModel } from "../model/dataflow-program-model";
import { NodeEditorMST } from "./node-editor-mst";
import { IBaseNode, IBaseNodeModel } from "./base-node";

const nodeSnapshot = { id: "n1", name: "Number", x: 0, y: 0, data: { type: "Number" } };

function makeEditor() {
  const program = DataflowProgramModel.create();
  const createReteNode = jest.fn((id: string, model: IBaseNodeModel) =>
    ({ id, model, dispose: jest.fn() }) as unknown as IBaseNode);
  const editor = new NodeEditorMST(program, createReteNode);
  return { program, editor, createReteNode };
}

describe("NodeEditorMST.getNode", () => {
  it("returns the same Rete node while its MST node is unchanged", () => {
    const { program, editor, createReteNode } = makeEditor();
    program.addNodeSnapshot(nodeSnapshot);
    const first = editor.getNode("n1");
    expect(editor.getNode("n1")).toBe(first);
    expect(createReteNode).toHaveBeenCalledTimes(1);
  });

  // Undo and history playback remove a node and put it back by applying patches, so the node that
  // comes back is a new MST instance with the same id.
  it("makes a new Rete node when the MST node with its id is replaced", () => {
    const { program, editor } = makeEditor();
    program.addNodeSnapshot(nodeSnapshot);
    const first = editor.getNode("n1") as unknown as IBaseNode;

    applyPatch(program, { op: "remove", path: "/nodes/n1" });
    applyPatch(program, { op: "add", path: "/nodes/n1", value: nodeSnapshot });

    const second = editor.getNode("n1") as unknown as IBaseNode;
    expect(second).not.toBe(first);
    expect(second.model).toBe(program.nodes.get("n1")!.data);
    expect(first.dispose).toHaveBeenCalled();
  });
});
