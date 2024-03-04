import {autorun} from "mobx";
import React, {forwardRef, MutableRefObject, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {drag, select, color, range} from "d3";
import RTreeLib from 'rtree';
type RTree = ReturnType<typeof RTreeLib>;
import {CaseData} from "../d3-types";
import {InternalizedData, Point, rTreeRect} from "../graph-types";
import {useGraphLayoutContext} from "../models/graph-layout";
import {rectangleSubtract, rectNormalize} from "../utilities/graph-utils";
import {MarqueeState} from "../models/marquee-state";
import {IGraphModel} from "../models/graph-model";
import {useInstanceIdContext} from "../imports/hooks/use-instance-id-context";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import { useGraphEditingContext } from "../hooks/use-graph-editing-context";

interface IProps {
  marqueeState: MarqueeState
}

const prepareTree = (areaSelector: string, circleSelector: string): RTree => {
    const selectionTree = RTreeLib(10);
    select<HTMLDivElement, unknown>(areaSelector).selectAll<SVGCircleElement, InternalizedData>(circleSelector)
      .each((datum: InternalizedData, index, groups) => {
        const element: any = groups[index],
          rect = {
            x: Number(element.cx.baseVal.value),
            y: Number(element.cy.baseVal.value),
            w: 1, h: 1
          };
        selectionTree.insert(rect, (element.__data__ as CaseData).caseID);
      });
    return selectionTree;
  },

  getCasesForDelta = (tree: any, newRect: rTreeRect, prevRect: rTreeRect) => {
    const diffRects = rectangleSubtract(newRect, prevRect);
    let caseIDs: string[] = [];
    diffRects.forEach(aRect => {
      const newlyFoundIDs = tree.search(aRect);
      caseIDs = caseIDs.concat(newlyFoundIDs);
    });
    return caseIDs;
  },

  updateSelections = (graphModel: IGraphModel, tree: any, newRect: rTreeRect, prevRect: rTreeRect) => {
    const newSelection = getCasesForDelta(tree, newRect, prevRect);
    const newDeselection = getCasesForDelta(tree, prevRect, newRect);
    if (newSelection.length) {
      graphModel.layers[0].config.dataset?.selectCases(newSelection, true); // FIXME multi dataset
    }
    if (newDeselection.length) {
      graphModel.layers[0].config.dataset?.selectCases(newDeselection, false);
    }

  };

export const Background = forwardRef<SVGGElement, IProps>((props, ref) => {
  const {marqueeState} = props,
    instanceId = useInstanceIdContext() || 'background',
    layout = useGraphLayoutContext(),
    graphModel = useGraphModelContext(),
    graphEditMode = useGraphEditingContext(),
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

  const onClick = useCallback((event: { offsetX: number, offsetY: number, shiftKey: boolean }) => {
    if (!graphEditMode.addPointsMode) {
        if (!event.shiftKey) {
          // Clicking on background deselects all cases
          graphModel.clearAllSelectedCases();
        }
      return;
    }
    const {x, y} = pointCoordinates(event.offsetX, event.offsetY);
    graphEditMode.addPoint(x, y);
  }, [graphEditMode, graphModel, pointCoordinates]);

  const selectModeDragStart = useCallback((event: { x: number; y: number; sourceEvent: { shiftKey: boolean } }) => {
      const {computedBounds} = layout,
        plotBounds = computedBounds.plot;
      selectionTree.current = prepareTree(`.${instanceId}`, 'circle');
      startX.current = event.x - plotBounds.left;
      startY.current = event.y - plotBounds.top;
      width.current = 0;
      height.current = 0;
      if (!event.sourceEvent.shiftKey) {
        graphModel.clearAllSelectedCases();
      }
      marqueeState.setMarqueeRect({x: startX.current, y: startY.current, width: 0, height: 0});
    }, [graphModel, instanceId, layout, marqueeState]),

    selectModeDrag = useCallback((event: { dx: number; dy: number }) => {
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

    selectModeDragEnd = useCallback(() => {
      marqueeState.setMarqueeRect({x: 0, y: 0, width: 0, height: 0});
      selectionTree.current = null;
    }, [marqueeState]);

  const
    createModeDragStart = useCallback((event: { x: number; y: number; }) => {
      setPotentialPoint(event);
    }, []),

    createModeDrag = useCallback((event: { x: number; y: number; }) => {
      setPotentialPoint(event);
    }, []),

    createModeDragEnd = useCallback((event: { x: number; y: number; }) => {
      const point = pointCoordinates(event.x, event.y);
      graphEditMode.addPoint(point.x, point.y);
      setPotentialPoint(undefined);
    }, [graphEditMode, pointCoordinates]);


  const dragBehavior = useMemo(() => {
    if (graphEditMode.addPointsMode) {
      return drag<SVGRectElement, number>()
      .on("start", createModeDragStart)
      .on("drag", createModeDrag)
      .on("end", createModeDragEnd);
    } else {
    return drag<SVGRectElement, number>()
      .on("start", selectModeDragStart)
      .on("drag", selectModeDrag)
      .on("end", selectModeDragEnd);
    }
  }, [createModeDrag, createModeDragEnd, createModeDragStart, graphEditMode.addPointsMode,
    selectModeDrag, selectModeDragEnd, selectModeDragStart]);

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
    <g>
      <g ref={bgRef}/>
      {potentialPoint &&
        <circle className="potential" cx={potentialPoint.x} cy={potentialPoint.y}
          r={graphModel.getPointRadius('hover-drag')} fill={graphEditMode.getEditablePointsColor()}/> }
    </g>
  );
});
Background.displayName = "Background";
