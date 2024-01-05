import { types } from "mobx-state-tree";
import { gAdornmentContentInfoMap } from "./adornment-content-info";
import { AdornmentModel, IAdornmentModel, UnknownAdornmentModel } from "./adornment-models";

export const kGraphAdornmentsClass = "graph-adornments-grid";
export const kGraphAdornmentsClassSelector = `.${kGraphAdornmentsClass}`;

const adornmentTypeDispatcher = (adornmentSnap: IAdornmentModel) => {
  const adornmentInfo = gAdornmentContentInfoMap[adornmentSnap.type];
  return adornmentInfo.modelClass ?? UnknownAdornmentModel;
};

export const AdornmentModelUnion = types.late<typeof AdornmentModel>(() => {
  const adornmentModels = Object.values(gAdornmentContentInfoMap).map(info => info!.modelClass);
  return types.union({ dispatcher: adornmentTypeDispatcher }, ...adornmentModels) as typeof AdornmentModel;
});
