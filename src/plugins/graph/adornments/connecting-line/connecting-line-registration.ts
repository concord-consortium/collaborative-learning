import { registerAdornmentComponentInfo } from "../adornment-component-info";
import { registerAdornmentContentInfo } from "../adornment-content-info";
import { ConnectingLineModel } from "./connecting-line-model";
import {
   kConnectingLineClass, kConnectingLineLabelKey, kConnectingLinePrefix, kConnectingLineType
} from "./connecting-line-types";
import { ConnectingLine } from "./connecting-line";

registerAdornmentContentInfo({
  type: kConnectingLineType,
  plots: ['scatterPlot'],
  prefix: kConnectingLinePrefix,
  modelClass: ConnectingLineModel
});

registerAdornmentComponentInfo({
  adornmentEltClass: kConnectingLineClass,
  Component: ConnectingLine,
  labelKey: kConnectingLineLabelKey,
  order: 10,
  type: kConnectingLineType
});
