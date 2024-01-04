import { registerMultiLegendPart } from "../../../components/legend/legend-registration";
import {
  getVariableFunctionLegendIdList, heightOfVariableFunctionLegend, VariableFunctionLegend, variableFunctionLegendType
} from "../../../components/legend/variable-function-legend";
import { registerAdornmentComponentInfo } from "../../adornment-component-info";
import { registerAdornmentContentInfo } from "../../adornment-content-info";
import { PlottedVariablesAdornmentModel } from "./plotted-variables-adornment-model";
import {
  kPlottedVariablesClass, kPlottedVariablesLabelKey, kPlottedVariablesPrefix, kPlottedVariablesType
} from "./plotted-variables-adornment-types";
import { PlottedVariablesAdornmentComponent } from "./plotted-variables-adornment-component";

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
