import { types, Instance, applySnapshot } from "mobx-state-tree";
import { cloneDeep } from "lodash";
import { ToolContentModel } from "../../../models/tools/tool-types";
import { DataflowNodeModel } from "./dataflow-node-model";
import { DEFAULT_DATA_RATE } from "./utilities/node";

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

export const DataflowContentModel = ToolContentModel
  .named("DataflowTool")
  .props({
    type: types.optional(types.literal(kDataflowToolID), kDataflowToolID),
    program: "",
    programRunId: "",
    programStartTime: 0,
    programEndTime: 0,
    programDataRate: DEFAULT_DATA_RATE,
    programIsRunning: "",
    programZoom: types.optional(ProgramZoom, DEFAULT_PROGRAM_ZOOM),
    nodes: types.map(DataflowNodeModel),
  })
  .views(self => ({
    isUserResizable() {
      return true;
    }
  }))
  .actions(self => ({
    setProgram(program: any) {
      self.program = JSON.stringify(program);

      applySnapshot(self.nodes, cloneDeep(program.nodes));
      /*
      // Update nodes in MST
      for (const id in program.nodes) {
        const node = program.nodes[id];
        const modelNode = self.nodes.get(id);
        if (modelNode) {
          modelNode.setName(node.name);
          modelNode.setPosition(node.position);
          modelNode.setData(JSON.stringify(node.data));
          modelNode.setInputs(node.inputs);
          modelNode.setOutputs(node.outputs);
        } else {
          const newNode = DataflowNodeModel.create({
            id: node.id.toString(),
            name: node.name,
            data: JSON.stringify(node.data)
          });
          newNode.setPosition(node.position);
          newNode.setInputs(node.inputs);
          newNode.setOutputs(node.outputs);
        }
        // self.nodes.set(id, JSON.stringify(node));
      }
      // Remove deleted nodes from MST
      const missingIds: string[] = [];
      self.nodes.forEach((node, id) => {
        if (!(id in program.nodes)) {
          missingIds.push(id);
        }
      });
      missingIds.forEach(id => self.nodes.delete(id));
      */
    },
    setProgramDataRate(dataRate: number) {
      self.programDataRate = dataRate;
    },
    setProgramRunId(id: string) {
      self.programRunId = id;
    },
    setProgramStartEndTime(startTime: number, endTime: number) {
      self.programStartTime = startTime;
      self.programEndTime = endTime;
    },
    setProgramStartTime(startTime: number) {
      self.programStartTime = startTime;
    },
    setProgramEndTime(endTime: number) {
      self.programEndTime = endTime;
    },
    setProgramZoom(dx: number, dy: number, scale: number) {
      self.programZoom.dx = dx;
      self.programZoom.dy = dy;
      self.programZoom.scale = scale;
    },
    setRunningStatus(endTime: number) {
      if (endTime > Date.now()) {
        self.programIsRunning = "true";
      } else {
        self.programIsRunning = "";
      }
    }
  }));

export type DataflowContentModelType = Instance<typeof DataflowContentModel>;
