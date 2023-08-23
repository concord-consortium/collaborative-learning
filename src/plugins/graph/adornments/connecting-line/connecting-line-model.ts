import { Instance } from "@concord-consortium/mobx-state-tree";
import { AdornmentModel, IAdornmentModel } from "../adornment-models";
import { kConnectingLineType } from "./connecting-line-types";

export const ConnectingLineModel = AdornmentModel
  .named('ConnectingLineModel')
  .props({
    type: 'Count'
  });
export interface IConnectingLineModel extends Instance<typeof ConnectingLineModel> {}
export function isCount(adornment: IAdornmentModel): adornment is IConnectingLineModel {
  return adornment.type === kConnectingLineType;
}
