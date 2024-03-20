import {D3DragEvent, drag, ScaleBand, ScaleLinear, select} from "d3";
import React, {useCallback, useRef} from "react";
import {ScaleNumericBaseType} from "../imports/components/axis/axis-types";
import {CaseData, inGraphDot, selectGraphDots} from "../d3-types";
import {PlotProps, Point} from "../graph-types";
import { usePlotResponders} from "../hooks/use-plot";
import {useDataConfigurationContext} from "../hooks/use-data-configuration-context";
import {useGraphLayoutContext} from "../models/graph-layout";
import {ICase} from "../../../models/data/data-set-types";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import {
  handleClickOnDot,
  setPointCoordinates,
  setPointSelection
} from "../utilities/graph-utils";
import { useGraphLayerContext } from "../hooks/use-graph-layer-context";

export const ScatterDots = function ScatterDots(props: PlotProps) {
  const {dotsRef, enableAnimation} = props,
    graphModel = useGraphModelContext(),
    layer = useGraphLayerContext(),
    dataConfiguration = useDataConfigurationContext(),
    dataset = dataConfiguration?.dataset,
    secondaryAttrIDsRef = useRef<string[]>([]),
    pointRadiusRef = useRef(0),
    selectedPointRadiusRef = useRef(0),
    dragPointRadiusRef = useRef(0),
    layout = useGraphLayoutContext(),
    legendAttrID = dataConfiguration?.attributeID('legend') as string,
    yScaleRef = useRef<ScaleNumericBaseType>(),
    target = useRef<any>(),
    plotNumRef = useRef(0);

  secondaryAttrIDsRef.current = dataConfiguration?.yAttributeIDs || [];
  pointRadiusRef.current = graphModel.getPointRadius();
  selectedPointRadiusRef.current = graphModel.getPointRadius('select');
  dragPointRadiusRef.current = graphModel.getPointRadius('hover-drag');
  yScaleRef.current = layout.getAxisScale("left") as ScaleNumericBaseType;

  const
    onDragStart = useCallback((event: D3DragEvent<SVGGElement,CaseData,Point>, datum) => {
      const targetDot = event.sourceEvent.target && inGraphDot(event.sourceEvent.target as SVGSVGElement);
      if (!targetDot) return;
      target.current = select(targetDot as SVGSVGElement);
      if (!datum || !dataConfiguration || datum.dataConfigID !== dataConfiguration.id) return;
      handleClickOnDot(event.sourceEvent, datum, dataConfiguration);
      graphModel.setInteractionInProgress(true);
      dataset?.beginCaching();
      secondaryAttrIDsRef.current = dataConfiguration.yAttributeIDs || [];
      enableAnimation.current = false; // We don't want to animate points until end of drag
      plotNumRef.current = datum.plotNum ?? 0;
    }, [dataConfiguration, dataset, enableAnimation, graphModel]),

    updatePositions = useCallback((dx: number, dy: number) => {
      const
        xAxisScale = layout.getAxisScale('bottom') as ScaleLinear<number, number>,
        xAttrID = dataConfiguration?.attributeID('x') ?? '',
        deltaX = Number(xAxisScale.invert(dx)) - Number(xAxisScale.invert(0)),
        deltaY = Number(yScaleRef.current?.invert(dy)) - Number(yScaleRef.current?.invert(0)),
        caseValues: ICase[] = [],
        cellSelection = dataConfiguration?.dataset?.selectedCells;
      cellSelection?.forEach(cell => {
        const
          currX = Number(dataset?.getNumeric(cell.caseId, xAttrID)),
          currY = Number(dataset?.getNumeric(cell.caseId, cell.attributeId));
        if (isFinite(currX) && isFinite(currY)) {
          caseValues.push({
            __id__: cell.caseId,
            [xAttrID]: currX + deltaX,
            [cell.attributeId]: currY + deltaY
          });
        }
      });
      caseValues.length &&
        dataset?.setCanonicalCaseValues(caseValues);
    }, [layout, dataConfiguration, dataset]),

    onDrag = useCallback((event: D3DragEvent<SVGGElement,CaseData,Point>) => {
      if (event.dx !== 0 || event.dy !== 0) {
        updatePositions(event.dx, event.dy);
      }
    }, [updatePositions]),

    onDragEnd = useCallback((event: D3DragEvent<SVGGElement,CaseData,Point>) => {
        graphModel.setInteractionInProgress(false);
        // Final update does a rescale if appropriate
        updatePositions(event.dx, event.dy);
        target.current = null;
    }, [graphModel, updatePositions]);

  selectGraphDots(dotsRef.current)
    ?.call(drag<SVGGElement,CaseData,Point>()
      .filter(() => graphModel.editingMode !== "none")
      .subject((event) => ({ x: event.x, y: event.y }))
      .on('start', onDragStart)
      .on('drag', onDrag)
      .on('end', onDragEnd)
    );

  const refreshPointSelection = useCallback(() => {
    const { pointColor, pointStrokeColor } = graphModel;
    dataConfiguration && setPointSelection(
      {
        dotsRef, dataConfiguration, pointRadius: pointRadiusRef.current,
        selectedPointRadius: selectedPointRadiusRef.current,
        pointColor, pointStrokeColor
      });
  }, [dataConfiguration, dotsRef, graphModel]);

  const refreshPointPositionsD3 = useCallback((selectedOnly: boolean) => {
    if (!dataConfiguration) return;
    const getScreenX = (anID: string) => {
      const xAttrID = dataConfiguration?.attributeID('x') ?? '',
        xValue = dataset?.getNumeric(anID, xAttrID) ?? NaN,
        xScale = layout.getAxisScale('bottom') as ScaleLinear<number, number>,
        topSplitID = dataConfiguration?.attributeID('topSplit') ?? '',
        topCoordValue = dataset?.getStrValue(anID, topSplitID) ?? '',
        topScale = layout.getAxisScale('top') as ScaleBand<string>;
      return xScale(xValue) / numExtraPrimaryBands + (topScale(topCoordValue) || 0);
    };

    const getScreenY = (anID: string, plotNum = 0) => {
      const yAttrID = yAttrIDs[plotNum],
        yValue = dataset?.getNumeric(anID, yAttrID) ?? NaN,
        yScale = (hasY2Attribute && plotNum === numberOfPlots - 1 ? v2Scale : yScaleRef.current) as
          ScaleLinear<number, number>,
        rightSplitID = dataConfiguration?.attributeID('rightSplit') ?? '',
        rightCoordValue = dataset?.getStrValue(anID, rightSplitID) ?? '',
        rightScale = layout.getAxisScale('rightCat') as ScaleBand<string>,
        rightScreenCoord = ((rightCoordValue && rightScale(rightCoordValue)) || 0);
      return yScale(yValue) / numExtraSecondaryBands + rightScreenCoord;
    };

    const yAttrIDs = dataConfiguration?.yAttributeIDs || [],
      {pointColor, pointStrokeColor} = graphModel,
      hasY2Attribute = dataConfiguration?.hasY2Attribute,
      v2Scale = layout.getAxisScale("rightNumeric") as ScaleNumericBaseType,
      numExtraPrimaryBands = dataConfiguration?.numRepetitionsForPlace('bottom') ?? 1,
      numExtraSecondaryBands = dataConfiguration?.numRepetitionsForPlace('left') ?? 1,
      numberOfPlots = dataConfiguration?.numberOfPlots || 0,
      getLegendColor = legendAttrID ? dataConfiguration?.getLegendColorForCase : undefined;

    setPointCoordinates({
      dataConfiguration, dotsRef, pointRadius: pointRadiusRef.current,
      selectedPointRadius: selectedPointRadiusRef.current,
      selectedOnly, getScreenX, getScreenY, getLegendColor,
      getColorForId: graphModel.getColorForId, enableAnimation, pointColor, pointStrokeColor
    });
  }, [dataConfiguration, dataset, dotsRef, layout, legendAttrID,
    enableAnimation, graphModel, yScaleRef]);

  // const refreshPointPositionsSVG = useCallback((selectedOnly: boolean) => {
  //   const xAttrID = dataConfiguration?.attributeID('x') ?? '',
  //     {joinedCaseDataArrays, selection} = dataConfiguration || {},
  //     primaryAxisScale = layout.getAxisScale('bottom') as ScaleLinear<number, number>;
  //   const updateDot = (aCaseData: CaseData) => {
  //     const caseId = aCaseData.caseID,
  //       dot = dotsRef.current?.querySelector(`#${instanceId}_${caseId}`);
  //     if (dot) {
  //       const dotSvg = dot as SVGCircleElement;
  //       const x = primaryAxisScale && getScreenCoord(dataset, caseId, xAttrID, primaryAxisScale);
  //       const y = yScaleRef.current &&
  //         getScreenCoord(dataset, caseId, secondaryAttrIDsRef.current[aCaseData.plotNum], yScaleRef.current);
  //       if (x != null && isFinite(x) && y != null && isFinite(y)) {
  //         dotSvg.setAttribute("cx", `${x}`);
  //         dotSvg.setAttribute("cy", `${y}`);
  //       }
  //     }
  //   };
  //   if (selectedOnly) {
  //     selection?.forEach(caseId => updateDot({plotNum: 0, caseID: caseId}));
  //   } else {
  //     joinedCaseDataArrays?.forEach((aCaseData) => updateDot(aCaseData));
  //   }
  // }, [layout, dataConfiguration, dataset, dotsRef, instanceId]);

  const refreshPointPositions = useCallback((selectedOnly: boolean) => {
    refreshPointPositionsD3(selectedOnly);
  }, [refreshPointPositionsD3]);

  usePlotResponders({
    layer, dotsRef, refreshPointPositions, refreshPointSelection, enableAnimation
  });

  return (
    <>
    </>
  );
};
