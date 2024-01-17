import { registerAdornmentComponentInfo } from "../../../graph/adornments/adornment-component-info";
import { registerAdornmentContentInfo } from "../../../graph/adornments/adornment-content-info";
import { registerMultiLegendPart } from "../../../graph/components/legend/legend-registration";
import {
  getVariableFunctionLegendIdList, heightOfVariableFunctionLegend, VariableFunctionLegend, variableFunctionLegendType
} from "../legend/variable-function-legend";
import { PlottedVariablesAdornmentComponent } from "./plotted-variables-adornment-component";
import { PlottedVariablesAdornmentModel } from "./plotted-variables-adornment-model";
import {
  kPlottedVariablesClass, kPlottedVariablesLabelKey, kPlottedVariablesPrefix, kPlottedVariablesType
} from "./plotted-variables-adornment-types";

registerAdornmentContentInfo({
  type: kPlottedVariablesType,
  plots: ["scatterPlot"],
  prefix: kPlottedVariablesPrefix,
  modelClass: PlottedVariablesAdornmentModel
});

registerAdornmentComponentInfo({
  adornmentEltClass: kPlottedVariablesClass,
  Component: PlottedVariablesAdornmentComponent,
  labelKey: kPlottedVariablesLabelKey,
  order: 10,
  type: kPlottedVariablesType
});

registerMultiLegendPart({
  component: VariableFunctionLegend,
  getHeight: heightOfVariableFunctionLegend,
  getLegendIdList: getVariableFunctionLegendIdList,
  type: variableFunctionLegendType
}, true);
