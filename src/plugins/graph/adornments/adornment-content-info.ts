import { AdornmentModel } from "./adornment-models";
import { PlotType } from "../graph-types";

export interface IAdornmentContentInfo {
  modelClass: typeof AdornmentModel
  plots: PlotType[]
  prefix: string
  type: string
}

export const gAdornmentContentInfoMap: Record<string, IAdornmentContentInfo> = {};

export function registerAdornmentContentInfo(info: IAdornmentContentInfo) {
  gAdornmentContentInfoMap[info.type] = info;
}

export function getAdornmentContentInfo(type: string) {
  return gAdornmentContentInfoMap[type];
}

export function getAdornmentContentModels() {
  return Object.values(gAdornmentContentInfoMap).map(info => info.modelClass);
}

export function getAdornmentTypes() {
  return Object.values(gAdornmentContentInfoMap).map(info => info.type);
}
