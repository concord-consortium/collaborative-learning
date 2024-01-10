import React, { useCallback, useEffect, useRef } from "react";
import { drag, format, select, Selection } from "d3";
import { observer } from "mobx-react-lite";
import { VariableType } from "@concord-consortium/diagram-view";

import { useTileModelContext } from "../../../../components/tiles/hooks/use-tile-model-context";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { mstAutorun } from "../../../../utilities/mst-autorun";
import { mstReaction } from "../../../../utilities/mst-reaction";
import { useDataConfigurationContext } from "../../../graph/hooks/use-data-configuration-context";
import { useGraphModelContext } from "../../../graph/hooks/use-graph-model-context";
import { ScaleNumericBaseType } from "../../../graph/imports/components/axis/axis-types";
import { useAxisLayoutContext } from "../../../graph/imports/components/axis/models/axis-layout-context";
import { IAxisModel, INumericAxisModel } from "../../../graph/imports/components/axis/models/axis-model";
import { curveBasis, setNiceDomain } from "../../../graph/utilities/graph-utils";
import { SharedVariables } from "../../shared-variables";
import { IPlottedVariablesAdornmentModel } from "./plotted-variables-adornment-model";
import { Point } from "../../../graph/graph-types";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";

import "../../../graph/adornments/plotted-function/plotted-function-adornment-component.scss";
import "./plotted-variables.scss";

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
  const readOnly = useReadOnlyContext();
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
  const smm = getSharedModelManager(graphModel);
  const sharedVariables = tile && smm?.isReady && smm.findFirstSharedModelByType(SharedVariables, tile.id);

  const addPath = useCallback(() => {

    const dragPoint = (point: Selection<SVGCircleElement, unknown, null, undefined>,
      tPoints: Point[],
      event: MouseEvent) => {
      const { x: newX } = event;
      const newY = tPoints[Math.round(newX)].y;
      if (newX && newY) {
        point.attr('cx', newX).attr('cy', newY);
      }
    };

    const setVariableValueFromDragPosition = (variable: VariableType, event: MouseEvent) => {
      variable.setValue(model.valueForPoint(event.x, xScale, xCellCount));
    };

    const xMin = xScale.domain()[0];
    const xMax = xScale.domain()[1];
    const tPixelMin = xScale(xMin);
    const tPixelMax = xScale(xMax);
    const kPixelGap = 1;
    for (const instanceKey of model.plottedVariables.keys()) {
      const plottedVar = model.plottedVariables.get(instanceKey);
      const values = plottedVar?.variableValues;
      const tPoints = model.computePoints({
        instanceKey, min: tPixelMin, max: tPixelMax, xCellCount, yCellCount, gap: kPixelGap, xScale, yScale
      });
      if (tPoints.length > 0) {
        const path = `M${tPoints[0].x},${tPoints[0].y},${curveBasis(tPoints)}`;

        const selection = select(plottedFunctionRef.current);
        const traceGroup = selection.append("g")
          .attr("class", 'plotted-variable')
          .on('mouseover', function(d, i) { this.classList.add('selected'); })
          .on('mouseout', function(d, i) { this.classList.remove('selected'); });

        // Highlight of line (visible on mouseover)
        traceGroup.append('path')
          .attr('class', 'plotted-variable-highlight plotted-variable-highlight-path')
          .attr('d', path);
        // Path for main line
        traceGroup.append('path')
          .attr('class', `plotted-variable-path`)
          .attr('stroke', graphModel.getColorForId(instanceKey))
          .attr('d', path);
        if (values) {
          const x = model.pointPosition(values.x, xScale, xCellCount),
            y = model.pointPosition(values.y, yScale, yCellCount),
            textHeight = 12,
            padding = 4,
            offsetFromPoint = 14,
            highlightStrokeWidth = 5,
            labelFormat = format('.3~r'),
            label = `${labelFormat(values.x)}, ${labelFormat(values.y)}`;
          // Highlight for value marker
          traceGroup.append('circle')
            .attr('class', 'plotted-variable-highlight plotted-variable-highlight-value')
            .attr('r', graphModel.getPointRadius() + highlightStrokeWidth/2)
            .attr('stroke-width', highlightStrokeWidth)
            .attr('cx', x)
            .attr('cy', y);
          // Value marker circle
          const point = traceGroup.append('circle')
            .attr('class', 'plotted-variable-value')
            .attr('r', graphModel.getPointRadius())
            .attr('stroke', graphModel.getColorForId(instanceKey))
            .attr('fill', '#fff')
            .attr('cx', x)
            .attr('cy', y);
          // Value label background
          const labelRectHeight = textHeight + 2 * padding;
          const labelRect = traceGroup.append('rect')
            .attr('class', 'plotted-variable-highlight plotted-variable-labelbox')
            .attr('y', y - offsetFromPoint - labelRectHeight)
            .attr('rx', labelRectHeight / 2)
            .attr('ry', labelRectHeight / 2)
            .attr('height', labelRectHeight);
          // Value label
          const valueLabel = traceGroup.append('text')
            .attr('class', 'plotted-variable-highlight plotted-variable-label')
            .attr('text-anchor', 'middle')
            .attr('x', x)
            .attr('y', y - offsetFromPoint - padding - 2) // up 2px to account for borders
            .text(label);
          // Go back and size value label background rectangle to fit nicely under the label
          const labelWidth = valueLabel.node()?.getComputedTextLength() || 0;
          labelRect
            .attr('width', labelWidth + padding * 2)
            .attr('x', x - labelWidth / 2 - padding);

          if (!readOnly && sharedVariables && plottedVar.xVariableId) {
            const variable = sharedVariables?.getVariableById(plottedVar.xVariableId);
            if (variable) {
              point
                .call(drag<SVGCircleElement, unknown>()
                  .on('drag', (e) => dragPoint(point, tPoints, e))
                  .on('end', (e) => setVariableValueFromDragPosition(variable, e)));
            }
          }
        }
      }
    }
  }, [graphModel, model, readOnly, sharedVariables, xCellCount, xScale, yCellCount, yScale]);

  // Add the lines and their associated covers and labels
  const refreshValues = useCallback(() => {
    if (!model.isVisible) return;

    // const measure = model?.plottedFunctions.get(instanceKey);
    const selection = select(plottedFunctionRef.current);

    // Remove the previous value's elements
    selection.html(null);

    addPath();
  }, [addPath, model]);

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
    }, { name: "PlottedVariablesAdornmentComponent.refreshAxisChange" }, model);
  }, [dataConfig, model, plotWidth, plotHeight, sharedVariables, xAxis, yAxis, refreshValues]);

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
    </svg>
  );
});
