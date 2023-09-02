import { Instance } from "@concord-consortium/mobx-state-tree";
import { AdornmentModel, IAdornmentModel } from "../adornment-models";
import { kConnectingLinesType } from "./connecting-lines-types";

export const ConnectingLinesModel = AdornmentModel
  .named('ConnectingLinesModel')
  .props({
    type: kConnectingLinesType
  });

export interface IConnectingLinesModel extends Instance<typeof ConnectingLinesModel> {}
export function isConnectingLines(adornment: IAdornmentModel): adornment is IConnectingLinesModel {
  return adornment.type === kConnectingLinesType;
}
