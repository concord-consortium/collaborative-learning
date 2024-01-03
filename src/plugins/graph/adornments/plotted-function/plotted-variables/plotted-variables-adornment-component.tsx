import React, { useCallback, useEffect, useRef } from "react";
import { select } from "d3";
import { observer } from "mobx-react-lite";
import { mstAutorun } from "../../../../../utilities/mst-autorun";
import { mstReaction } from "../../../../../utilities/mst-reaction";
import { IAxisModel, INumericAxisModel } from "../../../imports/components/axis/models/axis-model";
import { useAxisLayoutContext } from "../../../imports/components/axis/models/axis-layout-context";
import { ScaleNumericBaseType } from "../../../imports/components/axis/axis-types";
import { IPlottedVariablesAdornmentModel } from "./plotted-variables-adornment-model";
import { useGraphModelContext } from "../../../hooks/use-graph-model-context";
import { useDataConfigurationContext } from "../../../hooks/use-data-configuration-context";
import { curveBasis, setNiceDomain } from "../../../utilities/graph-utils";

import "../plotted-function-adornment-component.scss";

interface IProps {
  containerId?: string
  model: IPlottedVariablesAdornmentModel
  plotHeight: number
  plotWidth: number
  cellKey: Record<string, string>
  xAxis?: INumericAxisModel
  yAxis?: INumericAxisModel
}

export const PlottedVariablesAdornmentComponent = observer(function PlottedVariablesAdornment(props: IProps) {
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
  const plottedFunctionRef = useRef<SVGGElement>(null);
  const plottedFunctionCurrentValueRef = useRef<SVGGElement>(null);
  const sharedVariables = graphModel.sharedVariables;

  const addPath = useCallback(() => {
    const xMin = xScale.domain()[0];
    const xMax = xScale.domain()[1];
    const tPixelMin = xScale(xMin);
    const tPixelMax = xScale(xMax);
    const kPixelGap = 1;
    for (const instanceKey of model.plottedVariables.keys()) {
      const tPoints = model.computePoints({
        instanceKey, min: tPixelMin, max: tPixelMax, xCellCount, yCellCount, gap: kPixelGap, xScale, yScale
      });
      if (tPoints.length > 0) {
        const path = `M${tPoints[0].x},${tPoints[0].y},${curveBasis(tPoints)}`;

        const selection = select(plottedFunctionRef.current);
        selection.append("path")
          .attr("class", `plotted-function plotted-function-${classFromKey}`)
          .attr("data-testid", `plotted-function-path${classFromKey ? `-${classFromKey}` : ""}`)
          .attr("d", path);
      }
    }
  }, [classFromKey, model, xCellCount, xScale, yCellCount, yScale]);

  // Add the lines and their associated covers and labels
  const refreshValues = useCallback(() => {
    if (!model.isVisible) return;

    // const measure = model?.plottedFunctions.get(instanceKey);
    const selection = select(plottedFunctionRef.current);

    // Remove the previous value's elements
    selection.html(null);

    addPath();
  }, [addPath, model]);

  const refreshCurrentValue = useCallback(() => {
    if (!model.isVisible) return;
    for (const pvi of model.plottedVariables.values()) {
      const selection = select(plottedFunctionCurrentValueRef.current).selectAll("circle");
      const vals = pvi.variableValues;
      if (vals) {
        selection
          .data([vals])
          .join(
            enter => {
              return enter.append('circle')
                .attr('r', '5')
                .attr('class', 'variable-value')
                .attr('cx', (data) => model.pointPosition(data.x, xScale, xCellCount))
                .attr('cy', (data) => model.pointPosition(data.y, yScale, yCellCount));
            },
            update => {
              return update
                .attr('cx', (data) => model.pointPosition(data.x, xScale, xCellCount))
                .attr('cy', (data) => model.pointPosition(data.y, yScale, yCellCount));
            },
            exit => {
              exit.remove();
            }
          );
      }
    }
  }, [model, xCellCount, xScale, yCellCount, yScale]);

  // Refresh values on expression changes
  useEffect(function refreshExpressionChange() {
    return mstAutorun(() => {
      model.updateCategories(graphModel.layers[0].getUpdateCategoriesOptions(false));
    }, { name: "PlottedVariablesAdornmentComponent.refreshExpressionChange" }, model);
  }, [graphModel, model, xScale, xSubAxesCount, yScale]);

  // Refresh values on axis or expression change
  useEffect(function refreshAxisChange() {
    return mstAutorun(() => {
      // We observe changes to the axis domains within the autorun by extracting them from the axes below.
      // We do this instead of including domains in the useEffect dependency array to prevent domain changes
      // from triggering a reinstall of the autorun.
      if (xAxis && yAxis) {
        const { domain: xDomain } = xAxis; // eslint-disable-line unused-imports/no-unused-vars
        const { domain: yDomain } = yAxis; // eslint-disable-line unused-imports/no-unused-vars
      }
      // Trigger an autorun if any inputs or the expression of y change, or if the x variable changes
      Array.from(model.plottedVariables.values()).forEach(plottedVariables => {
        plottedVariables.yVariable?.computedValueIncludingMessageAndError; // eslint-disable-line no-unused-expressions
        plottedVariables.xVariable; // eslint-disable-line no-unused-expressions
      });
      refreshValues();
      refreshCurrentValue();
    }, { name: "PlottedVariablesAdornmentComponent.refreshAxisChange" }, model);
  }, [dataConfig, model, plotWidth, plotHeight, refreshValues, sharedVariables, xAxis, yAxis, refreshCurrentValue]);

  // Scale graph when a new X or Y variable is selected
  useEffect(function scaleOnVariableChange() {
    return mstReaction(() => {
      return Array.from(model.plottedVariables.values()).map((pvi) => [pvi.xVariableId, pvi.yVariableId]);
    },
    (varlist) => {
      // Set a range that includes 0 to 2x for all the given values.
      function fitValues(values: number[], axis: IAxisModel) {
        if (values.length) {
          setNiceDomain([0, ...values.map(x=>2*x)], axis);
        }
      }

      const variableValues = model.variableValues;
      if (xAxis && yAxis) {
        fitValues(variableValues.x, xAxis);
        fitValues(variableValues.y, yAxis);
      }
    },
    { name: "PlottedVariablesAdornmentComponent.scaleOnVariableChange" },
    model);
  }, [model, xAxis, yAxis]);

  return (
    <svg className={`plotted-function-${classFromKey}`}>
      <g
        className={`plotted-function plotted-function-${classFromKey}`}
        ref={plottedFunctionRef}
      />
      <g
        className={`plotted-function-current-value plotted-function-current-value-${classFromKey}`}
        ref={plottedFunctionCurrentValueRef}
      />
    </svg>
  );
});
