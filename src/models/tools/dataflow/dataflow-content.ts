import { types, Instance } from "mobx-state-tree";
import { registerToolContentInfo } from "../tool-content-info";
import { DEFAULT_PROGRAM_TIME } from "./utilities/node";

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
    programRunId: "",
    programStartTime: 0,
    programEndTime: 0,
    programRunTime: DEFAULT_PROGRAM_TIME,
    programIsRunning: "",
    programZoom: types.optional(ProgramZoom, DEFAULT_PROGRAM_ZOOM),
  })
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

registerToolContentInfo({
  id: kDataflowToolID,
  tool: "dataflow",
  modelClass: DataflowContentModel,
  defaultHeight: kDataflowDefaultHeight,
  defaultContent: defaultDataflowContent,
});
