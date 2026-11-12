import { applyPatch, getSnapshot, IJsonPatch, Instance, resolvePath, types } from "mobx-state-tree";
import { DataflowContentModel } from "../model/dataflow-content";
import { ConnectionModel, DataflowNodeModel } from "../model/dataflow-program-model";
import { specStores } from "../../../models/stores/spec-stores";
import { IBaseNode } from "../nodes/base-node";
import { ReteManager } from "./rete-manager";

// Playback applies patches to the whole document, as here, not to the tile's content.
const Document = types.model("Document", { content: DataflowContentModel });

const kViewEvents = ["nodecreated", "noderemoved", "connectioncreated", "connectionremoved"];

async function openReadOnlyProgram() {
  const doc = Document.create({ content: {} });
  const { content } = doc;
  const { program } = content;
  program.addNode(DataflowNodeModel.create({
    id: "num", name: "Number", x: 0, y: 0, data: { type: "Number", value: 1 }
  }));
  program.addNode(DataflowNodeModel.create({
    id: "math", name: "Math", x: 200, y: 0, data: { type: "Math" }
  }));
  program.addConnection(ConnectionModel.create({
    id: "c1", source: "num", sourceOutput: "value", target: "math", targetInput: "num1"
  }));
  const manager = new ReteManager(
    program, "tile1", document.createElement("div"), content, specStores(), true
  );
  await manager.setupComplete;

  // The view events the manager emits from now on, and the model each one carries.
  const events: Array<{ event: string, model?: unknown }> = [];
  manager.editor.addPipe(context => {
    if (kViewEvents.includes(context.type)) {
      const data = (context as any).data;
      events.push({ event: `${context.type} ${data.id}`, model: data.model });
    }
    return context;
  });
  return { doc, program, manager, events };
}

// Replaces each model with a new instance that has the same id and snapshot, in one action.
function replaceInOneAction(doc: Instance<typeof Document>, paths: string[]) {
  const values = paths.map(path => getSnapshot(resolvePath(doc, path)));
  const patches: IJsonPatch[] = [
    ...paths.map(path => ({ op: "remove" as const, path })),
    ...paths.map((path, i) => ({ op: "add" as const, path, value: values[i] })).reverse()
  ];
  applyPatch(doc, patches);
}

// Waits for the manager's onSnapshot handler, which awaits each event it emits.
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe("ReteManager read-only view", () => {
  const managers: ReteManager[] = [];
  afterEach(() => managers.splice(0).forEach(m => m.dispose()));

  // A playback seek applies all of its entries' patches in one action, so a node or connection
  // removed by one entry and put back with the same id by another changes in one snapshot.
  it("redraws a node and a connection whose models were replaced with the same ids", async () => {
    const { doc, program, manager, events } = await openReadOnlyProgram();
    managers.push(manager);
    const disposeSpy = jest.spyOn(manager.editor.reteNodesMap.num as IBaseNode, "dispose");

    replaceInOneAction(doc, ["/content/program/connections/c1", "/content/program/nodes/num"]);
    await settle();

    expect(disposeSpy).toHaveBeenCalled();
    expect(events.map(({ event }) => event)).toEqual([
      "connectionremoved c1", "noderemoved num", "nodecreated num", "connectioncreated c1"
    ]);
    expect(events[2].model).toBe(program.nodes.get("num")!.data);
    expect(events[3].model).toBe(program.connections.get("c1"));
  });

  it("redraws a connection whose model was replaced with the same id", async () => {
    const { doc, program, manager, events } = await openReadOnlyProgram();
    managers.push(manager);

    replaceInOneAction(doc, ["/content/program/connections/c1"]);
    await settle();

    expect(events.map(({ event }) => event)).toEqual(["connectionremoved c1", "connectioncreated c1"]);
    expect(events[1].model).toBe(program.connections.get("c1"));
  });

  it("redraws a connection to a node whose model was replaced", async () => {
    const { doc, manager, events } = await openReadOnlyProgram();
    managers.push(manager);

    replaceInOneAction(doc, ["/content/program/nodes/math"]);
    await settle();

    expect(events.map(({ event }) => event)).toEqual([
      "connectionremoved c1", "noderemoved math", "nodecreated math", "connectioncreated c1"
    ]);
  });

  it("leaves views alone when a change keeps the same models", async () => {
    const { doc, manager, events } = await openReadOnlyProgram();
    managers.push(manager);

    applyPatch(doc, { op: "replace", path: "/content/program/nodes/num/x", value: 50 });
    await settle();

    expect(events).toEqual([]);
  });
});
