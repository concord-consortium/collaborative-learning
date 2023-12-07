import React, { useCallback, useEffect, useRef } from "react";
import { select } from "d3";
import { observer } from "mobx-react-lite";
import { mstAutorun } from "../../../../utilities/mst-autorun";
import { INumericAxisModel } from "../../imports/components/axis/models/axis-model";
import { useAxisLayoutContext } from "../../imports/components/axis/models/axis-layout-context";
import { ScaleNumericBaseType } from "../../imports/components/axis/axis-types";
import { IPlottedFunctionAdornmentModel } from "./plotted-function-adornment-model";
import { useGraphModelContext } from "../../models/graph-model";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { curveBasis } from "../../utilities/graph-utils";
import { FormulaFn } from "./plotted-function-adornment-types";

import "./plotted-function-adornment-component.scss";

interface IProps {
  containerId?: string
  model: IPlottedFunctionAdornmentModel
  plotHeight: number
  plotWidth: number
  cellKey: Record<string, string>
  xAxis?: INumericAxisModel
  yAxis?: INumericAxisModel
}

export const PlottedFunctionAdornmentComponent = observer(function PlottedFunctionAdornment(props: IProps) {
  const {model, cellKey = {}, plotWidth, plotHeight, xAxis, yAxis} = props;
  const graphModel = useGraphModelContext();
  const dataConfig = useDataConfigurationContext();
  const layout = useAxisLayoutContext();
  const xScale = layout.getAxisScale("bottom") as ScaleNumericBaseType;
  const yScale = layout.getAxisScale("left") as ScaleNumericBaseType;
  const xAttrType = dataConfig?.attributeType("x");
  const yAttrType = dataConfig?.attributeType("y");
  const xSubAxesCount = layout.getAxisMultiScale("bottom")?.repetitions ?? 1;
  const ySubAxesCount = layout.getAxisMultiScale("left")?.repetitions ?? 1;
  const xCatSet = layout.getAxisMultiScale("bottom")?.categorySet;
  const xCats = xAttrType === "categorical" && xCatSet ? Array.from(xCatSet.values) : [""];
  const yCatSet = layout.getAxisMultiScale("left")?.categorySet;
  const yCats = yAttrType === "categorical" && yCatSet ? Array.from(yCatSet.values) : [""];
  const xCellCount = xCats.length * xSubAxesCount;
  const yCellCount = yCats.length * ySubAxesCount;
  const classFromKey = model.classNameFromKey(cellKey);
  const instanceKey = model.instanceKey(cellKey);
  const path = useRef("");
  const plottedFunctionRef = useRef<SVGGElement>(null);
  const sharedVariables = graphModel.sharedVariables;

  const addPath = useCallback((formulaFunction: FormulaFn) => {
    const xMin = xScale.domain()[0];
    const xMax = xScale.domain()[1];
    const tPixelMin = xScale(xMin);
    const tPixelMax = xScale(xMax);
    const kPixelGap = 1;
    const tPoints = model.computePoints({
      formulaFunction, min: tPixelMin, max: tPixelMax, xCellCount, yCellCount, gap: kPixelGap, xScale, yScale
    });
    if (tPoints.length === 0) return;
    path.current = `M${tPoints[0].x},${tPoints[0].y},${curveBasis(tPoints)}`;

    const selection = select(plottedFunctionRef.current);
    selection.append("path")
      .attr("class", `plotted-function plotted-function-${classFromKey}`)
      .attr("data-testid", `plotted-function-path${classFromKey ? `-${classFromKey}` : ""}`)
      .attr("d", path.current);

  }, [classFromKey, model, xCellCount, xScale, yCellCount, yScale]);

  // Add the lines and their associated covers and labels
  const refreshValues = useCallback(() => {
    if (!model.isVisible) return;

    const measure = model?.plottedFunctions.get(instanceKey);
    const selection = select(plottedFunctionRef.current);

    // Remove the previous value's elements
    selection.html(null);

    if (measure) {
      addPath(measure.formulaFunction);
    }
  }, [addPath, instanceKey, model]);

  // Refresh values on expression changes
  useEffect(function refreshExpressionChange() {
    return mstAutorun(() => {
      // The following comment and commented line are copied from CODAP. I'm leaving them in because
      // I'm not sure if they're relevant for CLUE or not.

      // The next line should not be needed, but without it this autorun doesn't get triggered.
      // TODO: Figure out exactly why this is needed and adjust accordingly.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      // const modelValue = isPlottedFunctionAdornment(model) ? model.expression : undefined;

      model.updateCategories(graphModel.layers[0].getUpdateCategoriesOptions(false));
    }, { name: "PlottedFunctionAdornmentComponent.refreshExpressionChange" }, model);
  }, [graphModel, model, xScale, xSubAxesCount, yScale]);

  // Refresh values on axis or expression change
  useEffect(function refreshAxisChange() {
    return mstAutorun(() => {
      console.log(`*** refreshAxisChange`);
      // We observe changes to the axis domains within the autorun by extracting them from the axes below.
      // We do this instead of including domains in the useEffect dependency array to prevent domain changes
      // from triggering a reinstall of the autorun.
      if (xAxis && yAxis) {
        const { domain: xDomain } = xAxis; // eslint-disable-line unused-imports/no-unused-vars
        const { domain: yDomain } = yAxis; // eslint-disable-line unused-imports/no-unused-vars
      }
      // Trigger an autorun if the expression of y changes
      // TODO Change this from hard coded "y"
      if (sharedVariables) {
        const y = sharedVariables.variables.find(variable => variable.name === "y");
        y?.expression; // eslint-disable-line no-unused-expressions
      }
      refreshValues();
    }, { name: "PlottedFunctionAdornmentComponent.refreshAxisChange" }, model);
  }, [dataConfig, model, plotWidth, plotHeight, refreshValues, sharedVariables, xAxis, yAxis]);

  return (
    <svg
      className={`plotted-function-${classFromKey}`}
      style={{height: "100%", width: "100%"}}
      x={0}
      y={0}
    >
      <g
        className={`plotted-function plotted-function-${classFromKey}`}
        ref={plottedFunctionRef}
      />
    </svg>
  );
});
