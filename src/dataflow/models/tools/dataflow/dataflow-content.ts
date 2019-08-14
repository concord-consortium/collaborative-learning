import { types, Instance } from "mobx-state-tree";
import { each } from "lodash";
import { DEFAULT_PROGRAM_TIME } from "../../../../dataflow/utilities/node";

export const kDataflowToolID = "Dataflow";

export function defaultDataflowContent(): DataflowContentModelType {
  return DataflowContentModel.create();
}

export const kDataflowDefaultHeight = 480;

const ProgramZoom = types.model({
  dx: types.number,
  dy: types.number,
  scale: types.number,
});
export type ProgramZoomType = typeof ProgramZoom.Type;
const DEFAULT_PROGRAM_ZOOM = { dx: 0, dy: 0, scale: 1 };

export const DataflowContentModel = types
  .model("DataflowTool", {
    type: types.optional(types.literal(kDataflowToolID), kDataflowToolID),
    program: "",
    programRunTime: DEFAULT_PROGRAM_TIME,
    programZoom: types.optional(ProgramZoom, DEFAULT_PROGRAM_ZOOM),
  })
  .preProcessSnapshot(snapshot => processImport(snapshot))
  .views(self => ({
    isUserResizable() {
      return true;
    }
  }))
  .actions(self => ({
    setProgram(program: any) {
      self.program = JSON.stringify(program);
    },
    setProgramRunTime(runTime: number) {
      self.programRunTime = runTime;
    },
    setProgramZoom(dx: number, dy: number, scale: number) {
      self.programZoom.dx = dx;
      self.programZoom.dy = dy;
      self.programZoom.scale = scale;
    }
  }));

export type DataflowContentModelType = Instance<typeof DataflowContentModel>;

// converts authoring/import format to Rete JSON format
function processImport(snapshot: any) {
  if (!snapshot.program) return snapshot;
  if (!Array.isArray(snapshot.program)) return snapshot;

  const { program, ...contentOthers } = snapshot;
  const nodes: any = {};
  program.forEach((inNode: any) => {
    const { id, outputs: _outputs, ...nodeOthers } = inNode;
    const inputs = {};
    const outputs = _outputs || [];
    const node: any = { id, inputs, outputs, ...nodeOthers };
    nodes[id] = node;
  });

  function addInputConnection(connection: any) {
    const toNode = nodes[connection.to.id];
    const toInputs = toNode.inputs;
    const toConnections = toInputs.connections || [];
    toConnections.push({ node: connection.from.id, output: connection.from.name });
    toInputs.connections = toConnections;
  }

  each(nodes, node => {
    const srcInputs = node.inputs || [];
    const srcOutputs = node.outputs || [];
    node.inputs = {};
    node.outputs = {};

    // process outputs
    const outputs: any = {};
    each(srcOutputs, output => {
      each(output, (targets, outName) => {
        const connections: any = [];
        each(targets || [], target => {
          each(target, (inName, nodeId) => {
            connections.push({ node: nodeId, input: inName });
            // map this output to the destination node's input
            addInputConnection({ from: { id: node.id, name: outName },
                                to: { id: nodeId, name: inName } });
          });
        });
        outputs[outName] = { connections };
      });
    });
    node.outputs = outputs;

    // process inputs
    const inputs: any = {};
    each(srcInputs, input => {
      each(input, (value, inName) => {
        node.data[inName] = value;
        node.inputs[inName] = { connections: [] };
      });
    });
  });

  const newProgram = { id: "dataflow@0.1.0", nodes };
  return { program: JSON.stringify(newProgram), ...contentOthers };
}
