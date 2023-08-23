import { Instance } from "@concord-consortium/mobx-state-tree";
import { AdornmentModel, IAdornmentModel } from "../adornment-models";
import { kConnectingLineType } from "./connecting-line-types";

export const ConnectingLineModel = AdornmentModel
  .named('ConnectingLineModel')
  .props({
    type: 'Connecting Line'
  });

export interface IConnectingLineModel extends Instance<typeof ConnectingLineModel> {}
export function isConnectingLine(adornment: IAdornmentModel): adornment is IConnectingLineModel {
  return adornment.type === kConnectingLineType;
}
