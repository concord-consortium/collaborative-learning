import { registerAdornmentComponentInfo } from "../adornment-component-info";
import { registerAdornmentContentInfo } from "../adornment-content-info";
import { PlottedFunctionAdornmentModel } from "./plotted-function-adornment-model";
import {
  kPlottedFunctionClass, kPlottedFunctionLabelKey, kPlottedFunctionPrefix, kPlottedFunctionType
} from "./plotted-function-adornment-types";
import { PlottedFunctionAdornmentComponent } from "./plotted-function-adornment-component";

registerAdornmentContentInfo({
  type: kPlottedFunctionType,
  plots: ["scatterPlot", "casePlot"],
  prefix: kPlottedFunctionPrefix,
  modelClass: PlottedFunctionAdornmentModel
});

registerAdornmentComponentInfo({
  adornmentEltClass: kPlottedFunctionClass,
  Component: PlottedFunctionAdornmentComponent,
  labelKey: kPlottedFunctionLabelKey,
  order: 10,
  type: kPlottedFunctionType
});
