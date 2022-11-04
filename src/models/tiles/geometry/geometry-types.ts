import { kGeometryDefaultPixelsPerUnit, kGeometryDefaultXAxisMin, kGeometryDefaultYAxisMin } from "./jxg-types";

export const kGeometryToolID = "Geometry";

export const kDefaultBoardModelInputProps = {
  xAxis: { min: kGeometryDefaultXAxisMin },
  yAxis: { min: kGeometryDefaultYAxisMin }
};

export const kDefaultBoardModelOutputProps = {
  xAxis: { min: kGeometryDefaultXAxisMin, unit: kGeometryDefaultPixelsPerUnit },
  yAxis: { min: kGeometryDefaultYAxisMin, unit: kGeometryDefaultPixelsPerUnit }
};
