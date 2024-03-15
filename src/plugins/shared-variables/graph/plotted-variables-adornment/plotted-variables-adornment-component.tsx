import React, { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { drag, select, Selection } from "d3";
import { observer } from "mobx-react-lite";
import { VariableType } from "@concord-consortium/diagram-view";

import { useTileModelContext } from "../../../../components/tiles/hooks/use-tile-model-context";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { mstAutorun } from "../../../../utilities/mst-autorun";
import { mstReaction } from "../../../../utilities/mst-reaction";
import { useGraphModelContext } from "../../../graph/hooks/use-graph-model-context";
import { ScaleNumericBaseType } from "../../../graph/imports/components/axis/axis-types";
import { useAxisLayoutContext } from "../../../graph/imports/components/axis/models/axis-layout-context";
import { INumericAxisModel } from "../../../graph/imports/components/axis/models/axis-model";
import { curveBasis } from "../../../graph/utilities/graph-utils";
import { SharedVariables } from "../../shared-variables";
import { IPlottedVariablesAdornmentModel } from "./plotted-variables-adornment-model";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { isFiniteNumber } from "../../../../utilities/math-utils";
import { useUIStore } from "../../../../hooks/use-stores";
import { useGraphSettingsContext } from "../../../graph/hooks/use-graph-settings-context";
import { GraphControllerContext } from "../../../graph/models/graph-controller";

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
  const readOnly = useReadOnlyContext();
  const layout = useAxisLayoutContext();
  const ui = useUIStore();
  const settings = useGraphSettingsContext();
  const controller = useContext(GraphControllerContext);
  const xScale = layout.getAxisScale("bottom") as ScaleNumericBaseType;
  const yScale = layout.getAxisScale("left") as ScaleNumericBaseType;
  const xSubAxesCount = layout.getAxisMultiScale("bottom")?.repetitions ?? 1;
  const ySubAxesCount = layout.getAxisMultiScale("left")?.repetitions ?? 1;
  const xCellCount = xSubAxesCount;
  const yCellCount = ySubAxesCount;
  const classFromKey = model.classNameFromKey(cellKey);
  const plottedFunctionRef = useRef<SVGGElement>(null);
  const smm = getSharedModelManager(graphModel);
  const sharedVariables = (tile && smm?.isReady) ? smm.findFirstSharedModelByType(SharedVariables, tile.id) : undefined;
  const textHeight = 12;
  const padding = 4;
  const offsetFromPoint = 14;
  const highlightStrokeWidth = 5;
  const labelRectHeight = textHeight + 2 * padding;
  const numberFormatter
    = useMemo(() => Intl.NumberFormat(undefined, { maximumFractionDigits: 4, useGrouping: false}), []);

  // Set the positions of the point-related SVG objects and the contents of the label when the variable value changes.
  const positionPointMarkers = useCallback((xValue: number, yValue: number,
      xPos: number, yPos: number,
      point: Selection<SVGCircleElement, unknown, null, undefined>,
      pointHighlight: Selection<SVGCircleElement, unknown, null, undefined>,
      labelRect: Selection<SVGRectElement, unknown, null, undefined>,
      labelText: Selection<SVGTextElement, unknown, null, undefined>) => {
    point
        .attr('cx', xPos)
        .attr('cy', yPos);
    pointHighlight
        .attr('cx', xPos)
        .attr('cy', yPos);
    const label = `${numberFormatter.format(xValue)}, ${numberFormatter.format(yValue)}`;
    labelText
      .attr('x', xPos)
      .attr('y', yPos - offsetFromPoint - padding - 2) // up 2px to account for borders
      .text(label);
    const labelWidth = (labelText.node()?.getComputedTextLength() || 0) + padding * 2;
      labelRect
        .attr('x', xPos - labelWidth / 2)
        .attr('y', yPos - offsetFromPoint - labelRectHeight)
        .attr('width', labelWidth);
  }, [labelRectHeight, numberFormatter]);

  // Assign a new value to the Variable based on the given pixel position
  const setVariableValue = useCallback((variable: VariableType, position: number) => {
    const newValue = model.valueForPosition(position, xScale, xCellCount);
    if (isFiniteNumber(newValue)) {
      // Truncate extra decimals to match the value that is displayed.
      variable.setValue(+numberFormatter.format(newValue));
    }
  }, [model, numberFormatter, xCellCount, xScale]);

  // Draw the variable traces
  const addPath = useCallback(() => {
    const xMin = xScale.domain()[0];
    const xMax = xScale.domain()[1];
    const tPixelMin = xScale(xMin);
    const tPixelMax = xScale(xMax);
    const kPixelGap = 1;
    const isTileSelected = !!tile && ui.isSelectedTile(tile);
    for (const instanceKey of model.plottedVariables.keys()) {
      const plottedVar = model.plottedVariables.get(instanceKey);
      const variable = plottedVar && plottedVar.xVariableId && sharedVariables?.getVariableById(plottedVar.xVariableId);
      const values = plottedVar?.variableValues;
      const tPoints = model.computePoints({
        instanceKey, min: tPixelMin, max: tPixelMax, xCellCount, yCellCount, gap: kPixelGap, xScale, yScale
      });
      if (tPoints.length > 0) {
        const path = `M${tPoints[0].x},${tPoints[0].y},${curveBasis(tPoints)}`;

        const selection = select(plottedFunctionRef.current);
        const traceGroup = selection.append("g")
          .attr("class", 'plotted-variable')
          .on('mouseover', function(d, i) { this.classList.add('hovered'); })
          .on('mouseout', function(d, i) { this.classList.remove('hovered'); });

        // Highlight of line (visible on mouseover)
        const pathHighlight = traceGroup.append('path')
          .attr('class', 'plotted-variable-highlight plotted-variable-highlight-path')
          .attr('d', path);
        if (!readOnly && variable) {
          pathHighlight.on('click', (e) => {
            // "Position" is the click x value relative to the left edge of the graph area.
            const containerLeft = plottedFunctionRef.current?.getBoundingClientRect().left;
            if (isFiniteNumber(containerLeft)) {
              setVariableValue(variable, e.x-containerLeft);
            }
          });
        }
        // Path for main line
        traceGroup.append('path')
          .attr('class', `plotted-variable-path`)
          .attr('stroke', graphModel.getColorForId(instanceKey))
          .attr('d', path);
        if (values) {
          const x = model.positionForValue(values.x, xScale, xCellCount),
            y = model.positionForValue(values.y, yScale, yCellCount);
          // Highlight for value marker
          const pointHighlight = traceGroup.append('circle')
            .attr('class', 'plotted-variable-highlight plotted-variable-highlight-value')
            .attr('r', graphModel.getPointRadius() + highlightStrokeWidth/2)
            .attr('stroke-width', highlightStrokeWidth);
          // Value marker circle
          const point = traceGroup.append('circle')
            .attr('class', 'plotted-variable-value')
            .attr('r', graphModel.getPointRadius())
            .attr('stroke', graphModel.getColorForId(instanceKey))
            .attr('fill', '#fff');
          // Value label background
          const labelRect = traceGroup.append('rect')
            .attr('class', 'plotted-variable-highlight plotted-variable-labelbox')
            .attr('rx', labelRectHeight / 2)
            .attr('ry', labelRectHeight / 2)
            .attr('height', labelRectHeight);
          // Value label
          const valueLabel = traceGroup.append('text')
            .attr('class', 'plotted-variable-highlight plotted-variable-label')
            .attr('text-anchor', 'middle');
          positionPointMarkers(values.x, values.y, x, y,
            point, pointHighlight, labelRect, valueLabel);

          // Set up drag handling for point if needed
          if (!readOnly && variable) {
            let currentX = x;
            pointHighlight
              .call(drag<SVGCircleElement, unknown>()
                .container(() => { return plottedFunctionRef.current!; })
                .filter((e) => { return !e.ctrlKey && !e.button && isTileSelected; })
                .on('start', (e) => traceGroup.classed('dragging', true))
                .on('drag', (e) => {
                  const newX = Math.round(e.x);
                  if (newX < tPixelMin || newX > tPixelMax) return;
                  const newY = tPoints[newX].y;
                  const xValue = model.valueForPosition(newX, xScale, xCellCount);
                  const yValue = model.valueForPosition(newY, yScale, yCellCount);
                  if (xValue && yValue) {
                    currentX = newX;
                    positionPointMarkers(xValue, yValue, newX, newY,
                      point, pointHighlight, labelRect, valueLabel);
                  }
                })
                .on('end', (e) => {
                  traceGroup.classed('dragging', false);
                  setVariableValue(variable, currentX);
                }));
          }
        }
      }
    }
  }, [tile, ui, model, graphModel, xScale, xCellCount, yScale, yCellCount,
      labelRectHeight, positionPointMarkers, readOnly, sharedVariables, setVariableValue]);

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

  // Refresh display when axis domains change
  useEffect(function refreshAxisChange() {
    return mstReaction<string,boolean>(
      () => {
        if (xAxis && yAxis) {
          const { domain: xDomain } = xAxis;
          const { domain: yDomain } = yAxis;
          // Return a primitive value (string, not array) so that equality will work
          // and effect will only be called when these numbers actually change.
          return `${xDomain[0]}, ${xDomain[1]}, ${yDomain[0]}, ${yDomain[1]}`;
        }
        return '';
      },
      (limits) => {
        refreshValues();
      },
      { fireImmediately: true, name: "PlottedVariablesAdornmentComponent.refreshAxisChange" },
      model);
  }, [model, plotWidth, plotHeight, xAxis, yAxis, refreshValues, controller]);

  // If desired, rescale graph when variable values change
  useEffect(function rescaleOnValuesChange() {
    return mstReaction(
      () => {
        return Array.from(model.plottedVariables.values()).map(plottedVariables => {
          return [
            plottedVariables.xVariable,
            plottedVariables.yVariable?.computedValueIncludingMessageAndError
          ];
        });
      },
      (any) => {
        if (settings.scalePlotOnValueChange && !graphModel.lockAxes) {
          controller?.autoscaleAllAxes();
        }
      },
      { name: "PlottedVariablesAdornmentComponent.rescaleOnValuesChange" },
      model);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, model]);

  // Scale graph when a new X or Y variable is selected
  useEffect(function scaleOnVariableChange() {
    return mstReaction(() => {
      return Array.from(model.plottedVariables.values()).map((pvi) => [pvi.xVariableId, pvi.yVariableId]);
    },
      (varlist) => {
        if (!graphModel.lockAxes) {
          controller?.autoscaleAllAxes();
        }
      },
      { name: "PlottedVariablesAdornmentComponent.scaleOnVariableChange" },
      model);
  }, [graphModel.lockAxes, model, xAxis, yAxis, controller]);

  return (
    <svg className={`plotted-function-${classFromKey}`}>
      <g
        className={`plotted-function plotted-function-${classFromKey}`}
        ref={plottedFunctionRef}
      />
    </svg>
  );
});
