import { types } from "mobx-state-tree";
import { AdornmentModel, IAdornmentModel, UnknownAdornmentModel } from "./adornment-models";
import { MovableLineModel } from "./movable-line/movable-line-model";
import { MovablePointModel } from "./movable-point/movable-point-model";
import { MovableValueModel } from "./movable-value/movable-value-model";
import { CountModel } from "./count/count-model";
import { ConnectingLinesModel } from "./connecting-lines/connecting-lines-model";

export const kGraphAdornmentsClass = "graph-adornments-grid";
export const kGraphAdornmentsClassSelector = `.${kGraphAdornmentsClass}`;

interface IAdornmentInfo {
  type: string;
  modelClass: typeof AdornmentModel;
}

const adornmentInfos: Record<string, IAdornmentInfo | undefined> = {};
export function registerAdornmentInfo(adornmentInfo: IAdornmentInfo) {
  adornmentInfos[adornmentInfo.type] = adornmentInfo;
}

// TODO: Do we actually want to include all these types? Most are not being used.
const defaultAdornmentInfos = [
  { type: "Count", modelClass: CountModel },
  { type: "Movable Line", modelClass: MovableLineModel },
  { type: "Movable Point", modelClass: MovablePointModel },
  { type: "Movable Value", modelClass: MovableValueModel },
  { type: "Connecting Lines", modelClass: ConnectingLinesModel },
  { type: "Unknown", modelClass: UnknownAdornmentModel }
];
defaultAdornmentInfos.forEach(adornmentInfo => registerAdornmentInfo(adornmentInfo));

const adornmentTypeDispatcher = (adornmentSnap: IAdornmentModel) => {
  const adornmentInfo = adornmentInfos[adornmentSnap.type];
  if (adornmentInfo) return adornmentInfo.modelClass;
  return UnknownAdornmentModel;
};

export const AdornmentModelUnion = types.late<typeof AdornmentModel>(() => {
  const adornmentModels = Object.values(adornmentInfos).map(info => info!.modelClass);
  return types.union({ dispatcher: adornmentTypeDispatcher }, ...adornmentModels) as typeof AdornmentModel;
});
