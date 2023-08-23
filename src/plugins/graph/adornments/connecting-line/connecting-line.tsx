import React from "react";
import { observer } from "mobx-react-lite";
import { IConnectingLineModel } from "./connecting-line-model";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";

import "./connecting-line.scss";

interface IProps {
  model: IConnectingLineModel
  subPlotKey: Record<string, string>
}

export const ConnectingLine = observer(function ConnectingLine({model, subPlotKey}: IProps) {
  const dataConfig = useDataConfigurationContext();
  const casesInPlot = dataConfig?.subPlotCases(subPlotKey)?.length ?? 0;
  const classFromKey = model.classNameFromKey(subPlotKey);

  return (
    <div
      className="graph-connecting-line"
      data-testid={`graph-connecting-line${classFromKey ? `-${classFromKey}` : ""}`}>
      {casesInPlot}
    </div>
  );
});
