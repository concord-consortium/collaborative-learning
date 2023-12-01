import { types } from "mobx-state-tree";
import { IAdornmentModel, IUnknownAdornmentModel, UnknownAdornmentModel } from "./adornment-models";
import { IMovableLineModel, MovableLineModel } from "./movable-line/movable-line-model";
import { IMovablePointModel, MovablePointModel } from "./movable-point/movable-point-model";
import { IMovableValueModel, MovableValueModel } from "./movable-value/movable-value-model";
import { CountModel, ICountModel } from "./count/count-model";
import { ConnectingLinesModel, IConnectingLinesModel } from "./connecting-lines/connecting-lines-model";
import {
  PlottedFunctionAdornmentModel, IPlottedFunctionAdornmentModel
} from "./plotted-function/plotted-function-adornment-model";

export const kGraphAdornmentsClass = "graph-adornments-grid";
export const kGraphAdornmentsClassSelector = `.${kGraphAdornmentsClass}`;

const adornmentTypeDispatcher = (adornmentSnap: IAdornmentModel) => {
  switch (adornmentSnap.type) {
    case "Count": return CountModel;
    case "Movable Line": return MovableLineModel;
    case "Movable Point": return MovablePointModel;
    case "Movable Value": return MovableValueModel;
    case "Connecting Lines": return ConnectingLinesModel;
    case "Plotted Function": return PlottedFunctionAdornmentModel;
    default: return UnknownAdornmentModel;
  }
};

export const AdornmentModelUnion = types.union({ dispatcher: adornmentTypeDispatcher },
  CountModel, MovableValueModel, MovableLineModel, MovablePointModel, ConnectingLinesModel,
  PlottedFunctionAdornmentModel, UnknownAdornmentModel);
export type IAdornmentModelUnion =
  ICountModel | IMovableValueModel | IMovableLineModel |
  IMovablePointModel | IConnectingLinesModel | IPlottedFunctionAdornmentModel | IUnknownAdornmentModel ;
