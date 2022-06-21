import { types, Instance } from "mobx-state-tree";
import { ToolContentModel } from "../../../models/tools/tool-types";
import { ITileExportOptions } from "../../../models/tools/tool-content-info";
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
  })
  .views(self => ({
    isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions) {
      return self.program;
    }
  }))
  .actions(self => ({
    setProgram(program: any) {
      self.program = JSON.stringify(program);
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
