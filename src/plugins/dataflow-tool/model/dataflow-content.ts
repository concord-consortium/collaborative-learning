import { types, Instance, applySnapshot, getSnapshot } from "mobx-state-tree";
import { cloneDeep } from "lodash";
import stringify from "json-stringify-pretty-compact";
import { toolContentModelHooks } from "../../../models/tools/tool-types";
import { ToolContentModel, ToolMetadataModelType } from "../../../models/tools/tool-types";
import { DataflowProgramModel } from "./dataflow-program-model";
import { ITileExportOptions } from "../../../models/tools/tool-content-info";
import { DEFAULT_DATA_RATE } from "./utilities/node";
import { setTileTitleFromContent } from "../../../models/tools/tool-tile";

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
export const DEFAULT_PROGRAM_ZOOM = { dx: 0, dy: 0, scale: 1 };

export const DataflowContentModel = ToolContentModel
  .named("DataflowTool")
  .props({
    type: types.optional(types.literal(kDataflowToolID), kDataflowToolID),
    program: types.optional(DataflowProgramModel, getSnapshot(DataflowProgramModel.create())),
    programRunId: "",
    programStartTime: 0,
    programEndTime: 0,
    programDataRate: DEFAULT_DATA_RATE,
    programIsRunning: "",
    programZoom: types.optional(ProgramZoom, DEFAULT_PROGRAM_ZOOM),
  })
  .volatile(self => ({
    metadata: undefined as any as ToolMetadataModelType
  }))
  .views(self => ({
    programWithoutRecentValues() {
      const { values, ...rest } = getSnapshot(self.program);
      const castedValues = values as Record<string, any>;
      const newValues: Record<string, any> = {};
      if (values) {
        Object.keys(castedValues).forEach((key: string) => {
          const { recentValues, ...other } = castedValues[key];
          newValues[key] = { ...other };
        });
      }
      return { values: newValues, ...rest };
    }
  }))
  .views(self => ({
    get title() {
      return self.metadata.title;
    },
    get isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions) {
      const zoom = getSnapshot(self.programZoom);
      return [
        `{`,
        `  "type": "Dataflow",`,
        `  "programDataRate": ${self.programDataRate},`,
        `  "programZoom": {`,
        `    "dx": ${zoom.dx},`,
        `    "dy": ${zoom.dy},`,
        `    "scale": ${zoom.scale}`,
        `  },`,
        `  "program": ${stringify(self.programWithoutRecentValues())}`,
        `}`
      ].join("\n");
    }
  }))
  .actions(self => toolContentModelHooks({
    doPostCreate(metadata: ToolMetadataModelType){
      self.metadata = metadata;
    }
  }))
  .actions(self => ({
    setProgram(program: any) {
      if (program) {
        applySnapshot(self.program, cloneDeep(program));
      }
    },
    setTitle(title: string) {
      setTileTitleFromContent(self, title); //DATAFLOW-TITLE TODO - not using this yet
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
