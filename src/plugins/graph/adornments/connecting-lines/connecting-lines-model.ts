import { Instance, types } from "mobx-state-tree";
import { AdornmentModel, IAdornmentModel } from "../adornment-models";
import { kConnectingLinesType } from "./connecting-lines-types";

export const ConnectingLinesModel = AdornmentModel
  .named('ConnectingLinesModel')
  .props({
    type: types.optional(types.literal(kConnectingLinesType), kConnectingLinesType)
  });

export interface IConnectingLinesModel extends Instance<typeof ConnectingLinesModel> {}
export function isConnectingLines(adornment: IAdornmentModel): adornment is IConnectingLinesModel {
  return adornment.type === kConnectingLinesType;
}
