import { registerAdornmentComponentInfo } from "../adornment-component-info";
import { registerAdornmentContentInfo } from "../adornment-content-info";
import { ConnectingLinesModel } from "./connecting-lines-model";
import {
   kConnectingLinesClass, kConnectingLinesLabelKey, kConnectingLinesPrefix, kConnectingLinesType
} from "./connecting-lines-types";
import { ConnectingLines } from "./connecting-lines";

registerAdornmentContentInfo({
  type: kConnectingLinesType,
  plots: ['scatterPlot'],
  prefix: kConnectingLinesPrefix,
  modelClass: ConnectingLinesModel
});

registerAdornmentComponentInfo({
  adornmentEltClass: kConnectingLinesClass,
  Component: ConnectingLines,
  labelKey: kConnectingLinesLabelKey,
  order: 10,
  type: kConnectingLinesType
});
