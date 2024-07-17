import {autorun} from "mobx";
import React, {forwardRef, MutableRefObject, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {drag, select, color, range} from "d3";
import RTreeLib from 'rtree';
type RTree = ReturnType<typeof RTreeLib>;
import {CaseData, graphDotSelector} from "../d3-types";
import { Point, rTreeRect} from "../graph-types";
import {useGraphLayoutContext} from "../models/graph-layout";
import {rectangleSubtract, rectNormalize} from "../utilities/graph-utils";
import {MarqueeState} from "../models/marquee-state";
import {IGraphModel} from "../models/graph-model";
import {useInstanceIdContext} from "../imports/hooks/use-instance-id-context";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import { ICell } from "../../../models/data/data-types";

interface IProps {
  marqueeState: MarqueeState
}

/**
 * Gets the transformation matrix that transforms from the user coordinate
 * system on the source element to the user coordinate system on the
 * target element.
 * Replaces deprecated SVG method of the same name.
 * @param source
 * @param elem
 * @returns
 */
function getTransformToElement(source: SVGGraphicsElement, elem: SVGGraphicsElement)    {
  const elemCTM = elem.getScreenCTM();
  const sourceCTM = source.getScreenCTM();
  if (elemCTM && sourceCTM) {
    return elemCTM.inverse().multiply(sourceCTM);
  } else {
    console.warn("Can't get CTM on element");
  }
}

// Get bounding box INCLUDING any transform="..." on the element itself.
// Adapted from https://stackoverflow.com/a/64909822
function boundingBoxRelativeToElement(fromSpace: SVGGraphicsElement, toSpace: SVGGraphicsElement) {
  const bbox = fromSpace.getBBox();
  const m = getTransformToElement(fromSpace, toSpace);
  let bbC = new DOMPoint(); bbC.x = bbox.x; bbC.y = bbox.y;
  let bbD = new DOMPoint(); bbD.x = bbox.x + bbox.width; bbD.y = bbox.y + bbox.height;
  bbC = bbC.matrixTransform(m);
  bbD = bbD.matrixTransform(m);
  return { x: bbC.x, y: bbC.y, width: Math.abs(bbD.x - bbC.x), height: Math.abs(bbD.y - bbC.y)};
}

const prepareTree = (areaSelector: string, circleSelector: string): RTree => {
    const selectionTree = RTreeLib(10);
    select<HTMLDivElement, unknown>(areaSelector).selectAll<SVGSVGElement, CaseData>(circleSelector)
      .each((datum: CaseData, index, groups) => {
        const
          element: any = groups[index],
          bbox = boundingBoxRelativeToElement(element, element.parentElement),
          rect = {
            x: bbox.x,
            y: bbox.y,
            w: bbox.width,
            h: bbox.height
          };
        selectionTree.insert(rect, (element.__data__ as CaseData));
      });
    return selectionTree;
  },

  /**
   * Searches the new area, and returns cases found in it.
   */
  getCasesForDelta = (tree: any, newRect: rTreeRect, prevRect: rTreeRect) => {
    const diffRects = rectangleSubtract(newRect, prevRect);
    let allCases: CaseData[] = [];
    diffRects.forEach(aRect => {
      const newlyFoundCases = tree.search(aRect);
      allCases = allCases.concat(newlyFoundCases);
    });
    return allCases;
  },

  /**
   * Take list of CaseData objects, return map from data configuration id to cell info.
   */
  sortByDataConfiguration = (graphModel: IGraphModel, cases: CaseData[]) => {
    const caseDatas = new Map<string,ICell[]>();
    for (const c of cases) {
      if (!caseDatas.has(c.dataConfigID)) {
        caseDatas.set(c.dataConfigID, []);
      }
      const dataConfiguration = graphModel.layerForDataConfigurationId(c.dataConfigID)?.config;
      if (dataConfiguration) {
        const attributeId = dataConfiguration.attributeIdforPlotNumber(c.plotNum);
        caseDatas.get(c.dataConfigID)?.push({caseId: c.caseID, attributeId});
      }
    }
    return caseDatas;
  },

  updateSelections = (graphModel: IGraphModel, tree: any, newRect: rTreeRect, prevRect: rTreeRect) => {
    const newSelection = getCasesForDelta(tree, newRect, prevRect);
    const newDeselection = getCasesForDelta(tree, prevRect, newRect);
    if (newSelection.length) {
      for (const [dataConfId, cells] of sortByDataConfiguration(graphModel, newSelection).entries()) {
        const dataConfiguration = graphModel.layerForDataConfigurationId(dataConfId);
        if (dataConfiguration) {
          dataConfiguration.config.dataset?.selectCells(cells, true);
        }
      }
    }
    if (newDeselection.length) {
      for (const [dataConfId, cells] of sortByDataConfiguration(graphModel, newDeselection).entries()) {
        const dataConfiguration = graphModel.layerForDataConfigurationId(dataConfId);
        if (dataConfiguration) {
          dataConfiguration.config.dataset?.selectCells(cells, false);
        }
      }
    }
  };

export const Background = forwardRef<SVGGElement, IProps>((props, ref) => {
  const {marqueeState} = props,
    instanceId = useInstanceIdContext() || 'background',
    layout = useGraphLayoutContext(),
    graphModel = useGraphModelContext(),
    bgRef = ref as MutableRefObject<SVGGElement | null>,
    startX = useRef(0),
    startY = useRef(0),
    width = useRef(0),
    height = useRef(0),
    selectionTree = useRef<RTree | null>(null),
    previousMarqueeRect = useRef<rTreeRect>(),
    [potentialPoint, setPotentialPoint] = useState<Point|undefined>(undefined);

  const pointCoordinates = useCallback((offsetX: number, offsetY: number) => {
    const plotBounds = layout.computedBounds.plot;
    const relX = offsetX - plotBounds.left;
    const relY = offsetY - plotBounds.top;
    const { data: x } = layout.getAxisMultiScale("bottom").getDataCoordinate(relX);
    const { data: y } = layout.getAxisMultiScale("left").getDataCoordinate(relY);
    return { x, y };
  }, [layout]);

  const addAndSelectPoint = useCallback((coords: Point) => {
    const point = graphModel.editingLayer?.addPoint(coords.x, coords.y);
    const yAttribute = point && Object.keys(point).find(p=>p!=='__id__');
    if (point && yAttribute) {
      const cellToSelect: ICell = {
        caseId: point.__id__,
        attributeId: yAttribute
      };
      graphModel.editingLayer?.config.dataset?.selectCells([cellToSelect], true);
    }
  }, [graphModel.editingLayer]);

  const onClick = useCallback((event: { offsetX: number, offsetY: number, shiftKey: boolean }) => {
    // If not shifted, clicking on background deselects everything
    if (!event.shiftKey) {
      graphModel.clearAllSelectedCases();
    }
    if (graphModel.editingMode==="add") {
      const coords = pointCoordinates(event.offsetX, event.offsetY);
      addAndSelectPoint(coords);
    }
    graphModel.adornments.forEach(adornment => {
      adornment.toggleSelected();
    });
  }, [addAndSelectPoint, graphModel, pointCoordinates]);

  // Define the dragging behaviors for "edit" mode and for "add" mode, then assemble into one "drag" object.
  const
    dragStartEditMode = useCallback((event: { x: number; y: number; sourceEvent: { shiftKey: boolean } }) => {
      const {computedBounds} = layout,
        plotBounds = computedBounds.plot;
      selectionTree.current = prepareTree(`.${instanceId}`, graphDotSelector);
      startX.current = event.x - plotBounds.left;
      startY.current = event.y - plotBounds.top;
      width.current = 0;
      height.current = 0;
      if (!event.sourceEvent.shiftKey) {
        graphModel.clearAllSelectedCases();
      }
      marqueeState.setMarqueeRect({x: startX.current, y: startY.current, width: 0, height: 0});
    }, [graphModel, instanceId, layout, marqueeState]),

    dragMoveEditMode = useCallback((event: { dx: number; dy: number }) => {
      if (event.dx !== 0 || event.dy !== 0) {
        previousMarqueeRect.current = rectNormalize(
          {x: startX.current, y: startY.current, w: width.current, h: height.current});
        width.current = width.current + event.dx;
        height.current = height.current + event.dy;
        const marqueeRect = marqueeState.marqueeRect;
        marqueeState.setMarqueeRect({
          x: marqueeRect.x, y: marqueeRect.y,
          width: marqueeRect.width + event.dx,
          height: marqueeRect.height + event.dy
        });
        const currentRect = rectNormalize({
            x: startX.current, y: startY.current,
            w: width.current,
            h: height.current
          });
        updateSelections(graphModel, selectionTree.current, currentRect, previousMarqueeRect.current);
      }
    }, [graphModel, marqueeState]),

    dragEndEditMode = useCallback((event: { x: number; y: number; }) => {
      marqueeState.setMarqueeRect({x: 0, y: 0, width: 0, height: 0});
      selectionTree.current = null;
    }, [marqueeState]),

    dragStartAddMode = useCallback((event: { x: number; y: number; sourceEvent: MouseEvent }) => {
      if (!event.sourceEvent.shiftKey) {
        graphModel.clearAllSelectedCases();
      }
      setPotentialPoint(event);
    }, [graphModel]),

    dragMoveAddMode = useCallback((event: { x: number; y: number; dx: number; dy: number }) => {
      setPotentialPoint(event);
    }, []),

    dragEndAddMode = useCallback((event: { x: number; y: number; }) => {
      setPotentialPoint(undefined);
      const coords = pointCoordinates(event.x, event.y);
      addAndSelectPoint(coords);
    }, [addAndSelectPoint, pointCoordinates]),

    dragStart = useCallback((event: { x: number; y: number; sourceEvent: MouseEvent }) => {
      if (graphModel.editingMode === "add") {
        dragStartAddMode(event);
      } else {
        dragStartEditMode(event);
      }
      event.sourceEvent.stopPropagation();
    }, [dragStartAddMode, graphModel.editingMode, dragStartEditMode]),

    dragMove = useCallback((event: { x: number; y: number; dx: number; dy: number }) => {
      if (graphModel.editingMode === "add") {
        dragMoveAddMode(event);
      } else {
        dragMoveEditMode(event);
      }
    }, [dragMoveAddMode, graphModel.editingMode, dragMoveEditMode]),

    dragEnd = useCallback((event: { x: number; y: number; }) => {
      if (graphModel.editingMode === "add") {
        dragEndAddMode(event);
      } else {
        dragEndEditMode(event);
      }
    }, [dragEndAddMode, graphModel.editingMode, dragEndEditMode]);

  const dragBehavior = useMemo(() => {
    return drag<any, any>()
      .on("start", dragStart)
      .on("drag", dragMove)
      .on("end", dragEnd);
  }, [dragMove, dragEnd, dragStart]);

  useEffect(() => {
    return autorun(() => {
      const { left, top, width: plotWidth, height: plotHeight } = layout.computedBounds.plot,
        transform = `translate(${left}, ${top})`,
        { isTransparent, plotBackgroundColor } = graphModel,
        bgColor = String(color(plotBackgroundColor)),
        darkBgColor = String(color(plotBackgroundColor)?.darker(0.2)),
        numRows = layout.getAxisMultiScale('left').repetitions,
        numCols = layout.getAxisMultiScale('bottom').repetitions,
        cellWidth = plotWidth / numCols,
        cellHeight = plotHeight / numRows,
        row = (index: number) => Math.floor(index / numCols),
        col = (index: number) => index % numCols,
        groupElement = bgRef.current;
      select(groupElement)
        .on('click', onClick)
        .selectAll<SVGRectElement, number>('rect')
        .data(range(numRows * numCols))
        .join('rect')
        .attr('class', 'plot-cell-background')
        .attr('transform', transform)
        .attr('width', cellWidth)
        .attr('height', cellHeight)
        .attr('x', d => cellWidth * col(d))
        .attr('y', d => cellHeight * row(d))
        .style('fill', d => (row(d) + col(d)) % 2 === 0 ? bgColor : darkBgColor)
        .style('fill-opacity', isTransparent ? 0 : 1)
        .call(dragBehavior);
    });
  }, [bgRef, dragBehavior, graphModel, layout, onClick]);

  return (
    <g data-testid="graph-background">
      <g ref={bgRef}/>
      {potentialPoint &&
        <circle className="potential" cx={potentialPoint.x} cy={potentialPoint.y}
          r={graphModel.getPointRadius('hover-drag')} fill={graphModel.getEditablePointsColor()}/> }
    </g>
  );
});
Background.displayName = "Background";
