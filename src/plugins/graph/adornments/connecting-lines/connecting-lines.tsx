import { IConnectingLinesModel } from "./connecting-lines-model";
import { IDotsRef } from "../../graph-types";

// Leaving this here for the moment since legacy models still include the adornment.

interface IConnectLines {
  model: IConnectingLinesModel
  subPlotKey: Record<string, string>
  dotsRef: IDotsRef
}

export const ConnectingLines = function ConnectingLines({dotsRef}: IConnectLines) {
  return null;
};
