import React, { useCallback, useEffect, useRef } from "react";
import { select } from "d3";
import { observer } from "mobx-react-lite";

import { useTileModelContext } from "../../../../components/tiles/hooks/use-tile-model-context";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { mstAutorun } from "../../../../utilities/mst-autorun";
import { useDataConfigurationContext } from "../../../graph/hooks/use-data-configuration-context";
import { useGraphModelContext } from "../../../graph/hooks/use-graph-model-context";
import { ScaleNumericBaseType } from "../../../graph/imports/components/axis/axis-types";
import { useAxisLayoutContext } from "../../../graph/imports/components/axis/models/axis-layout-context";
import { IAxisModel, INumericAxisModel } from "../../../graph/imports/components/axis/models/axis-model";
import { curveBasis, setNiceDomain } from "../../../graph/utilities/graph-utils";
import { SharedVariables } from "../../shared-variables";
import { IPlottedVariablesAdornmentModel } from "./plotted-variables-adornment-model";

import "../../../graph/adornments/plotted-function/plotted-function-adornment-component.scss";
import { mstReaction } from "../../../../utilities/mst-reaction";

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
  const { tile } = useTileModelContext();
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
  const smm = getSharedModelManager(graphModel);
  const sharedVariables = tile && smm?.isReady && smm.findFirstSharedModelByType(SharedVariables, tile.id);

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
          .attr("stroke", graphModel.getColorForId(instanceKey))
          .attr("d", path);
      }
    }
  }, [classFromKey, graphModel, model, xCellCount, xScale, yCellCount, yScale]);

  // Add the lines and their associated covers and labels
  const refreshValues = useCallback(() => {
    if (!model.isVisible) return;

    // const measure = model?.plottedFunctions.get(instanceKey);
    const selection = select(plottedFunctionRef.current);

    // Remove the previous value's elements
    selection.html(null);

    addPath();
  }, [addPath, model]);

  const refreshCurrentValues = useCallback(() => {
    if (!model.isVisible) return;
    const valueData = [] as {key: string, x: number, y: number}[];
    for (const key of model.plottedVariables.keys()) {
      const vals = model.plottedVariables.get(key)?.variableValues;
      if (vals) {
        valueData.push({ key, x: vals.x, y: vals.y });
      }
    }
    const selection = select(plottedFunctionCurrentValueRef.current).selectAll("circle");
    selection
      .data(valueData)
      .join(
        enter => {
          return enter.append('circle')
            .attr('r', '5')
            .attr('class', 'variable-valuex')
            .attr("fill", (data) => graphModel.getColorForId(data.key))
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
  }, [graphModel, model, xCellCount, xScale, yCellCount, yScale]);

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
      refreshCurrentValues();
    }, { name: "PlottedVariablesAdornmentComponent.refreshAxisChange" }, model);
  }, [dataConfig, model, plotWidth, plotHeight, sharedVariables, xAxis, yAxis, refreshValues, refreshCurrentValues]);

  // Scale graph when a new X or Y variable is selected
  useEffect(function scaleOnVariableChange() {
    return mstReaction(() => {
      return Array.from(model.plottedVariables.values()).map((pvi) => [pvi.xVariableId, pvi.yVariableId]);
    },
      (varlist) => {
        // Set a range that includes 0 to 2x for all the given values.
        function fitValues(values: number[], axis: IAxisModel) {
          if (values.length) {
            setNiceDomain([0, ...values.map(x => 2 * x)], axis);
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
