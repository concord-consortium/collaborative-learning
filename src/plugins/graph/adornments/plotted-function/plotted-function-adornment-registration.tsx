import { registerAdornmentComponentInfo } from "../adornment-component-info";
import { registerAdornmentContentInfo } from "../adornment-content-info";
import { PlottedFunctionAdornmentModel } from "./plotted-function-adornment-model";
import {
  kPlottedFunctionClass, kPlottedFunctionLabelKey, kPlottedFunctionPrefix, kPlottedFunctionType
} from "./plotted-function-adornment-types";
import { PlottedFunctionAdornmentComponent } from "./plotted-function-adornment-component";

// const Controls = () => {
//   return (
//     <AdornmentCheckbox
//       classNameValue={kPlottedFunctionClass}
//       labelKey={kPlottedFunctionLabelKey}
//       type={kPlottedFunctionType}
//     />
//   );
// };

registerAdornmentContentInfo({
  type: kPlottedFunctionType,
  plots: ["scatterPlot"],
  prefix: kPlottedFunctionPrefix,
  modelClass: PlottedFunctionAdornmentModel,
  // undoRedoKeys: {
  //   undoAdd: kPlottedFunctionUndoAddKey,
  //   redoAdd: kPlottedFunctionRedoAddKey,
  //   undoRemove: kPlottedFunctionUndoRemoveKey,
  //   redoRemove: kPlottedFunctionRedoRemoveKey
  // }
});

registerAdornmentComponentInfo({
  adornmentEltClass: kPlottedFunctionClass,
  Component: PlottedFunctionAdornmentComponent,
  // Controls,
  // BannerComponent: PlottedFunctionAdornmentBanner,
  labelKey: kPlottedFunctionLabelKey,
  order: 10,
  type: kPlottedFunctionType
});
