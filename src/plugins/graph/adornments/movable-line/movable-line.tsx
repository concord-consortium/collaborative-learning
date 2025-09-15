import React, { useCallback, useEffect, useRef } from "react";
import { autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { drag, DragBehavior, select, Selection } from "d3";
import classNames from "classnames";
import { kebabCase } from "lodash";

import { useAxisLayoutContext } from "../../imports/components/axis/models/axis-layout-context";
import { ScaleNumericBaseType } from "../../imports/components/axis/axis-types";
import { INumericAxisModel } from "../../imports/components/axis/models/axis-model";
import {
  computeSlopeAndIntercept, equationString, IAxisIntercepts, lineToAxisIntercepts
} from "../../utilities/graph-utils";
import { getAnnotationId, IMovableLineInstance, IMovableLineModel } from "./movable-line-model";
import { useGraphModelContext } from "../../hooks/use-graph-model-context";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { kInfinitePoint } from "../adornment-models";
import { Point } from "../../graph-types";
import { kAnnotationNodeDefaultRadius } from "../../../../components/annotations/annotation-utilities";
import { useInstanceIdContext } from "../../imports/hooks/use-instance-id-context";

import "./movable-line.scss";

function equationContainer(model: IMovableLineModel, subPlotKey: Record<string, string>) {
  const classFromKey = model.classNameFromKey(subPlotKey),
    equationContainerClass = `movable-line-equation-container-${classFromKey}`;
  return { equationContainerClass };
}

// ensures class names do not include invalid characters like "{}"
function lineClassName(lineKey: string) {
  return `movable-line-${kebabCase(lineKey)}`;
}

function equationClassName(lineKey: string, instanceId: string) {
  return `movable-line-equation-${kebabCase(lineKey)}-${instanceId}`;
}

interface IProps {
  containerId: string
  model: IMovableLineModel
  plotHeight: number
  plotWidth: number
  subPlotKey: Record<string, string>
  xAxis: INumericAxisModel
  yAxis: INumericAxisModel
}

interface ILineObject {
  arrowLower?: Selection<SVGPolygonElement, unknown, null, undefined>
  arrowUpper?: Selection<SVGPolygonElement, unknown, null, undefined>
  cover?: Selection<SVGLineElement, unknown, null, undefined>
  equation?: Selection<HTMLDivElement, unknown, HTMLElement, any>
  handleLower?: Selection<SVGCircleElement, unknown, null, undefined>
  handleUpper?: Selection<SVGCircleElement, unknown, null, undefined>
  key: string
  line?: Selection<SVGLineElement, unknown, null, undefined>
}

export const MovableLine = observer(function MovableLine(props: IProps) {
  const {containerId, model, plotHeight, plotWidth, subPlotKey={}, xAxis, yAxis} = props,
    graphModel = useGraphModelContext(),
    layout = useAxisLayoutContext(),
    instanceId = useInstanceIdContext(),
    readOnly = useReadOnlyContext(),
    { setAnnotationLocation } = graphModel,
    xScale = layout.getAxisScale("bottom") as ScaleNumericBaseType,
    yScale = layout.getAxisScale("left") as ScaleNumericBaseType,
    kTolerance = 4, // pixels to snap to horizontal or vertical
    kHandleSize = 10,
    kHandle1Loc = 1/3,
    kHandle2Loc = 2/3,
    {equationContainerClass} = equationContainer(model, subPlotKey),
    xScaleCopy = useRef(xScale.copy()),
    yScaleCopy = useRef(yScale.copy()),
    lineRef = useRef<SVGSVGElement>(null),
    lineObjects = useRef<ILineObject[]>([]);
  const pointsOnAxes = useRef<IAxisIntercepts[]>([]);

  // Set scale copy ranges. The scale copies are used when computing the line's
  // coordinates during dragging.
  xScaleCopy.current.range([0, plotWidth]);
  yScaleCopy.current.range([plotHeight, 0]);

  // get attributes for use in equation
  const
    xAttrName = graphModel.xAttributeLabel,
    yAttrName = graphModel.yAttributeLabel,
    xSubAxesCount = layout.getAxisMultiScale('bottom')?.repetitions ?? 1,
    ySubAxesCount = layout.getAxisMultiScale('left')?.repetitions ?? 1;

  const toggleLineSelection = useCallback((lineKey: string) => {
    model.toggleSelected(lineKey);
  }, [model]);

  // Calculate where the drag handles go, given the line endpoints
  const calculateHandlePosition = useCallback((index: number, pt1: Point, pt2: Point) => {
    if (pt1 && pt2) {
      const fraction = (index === 1) ? kHandle1Loc : kHandle2Loc;
      return {
        x: pt1.x + fraction * (pt2.x - pt1.x),
        y: pt1.y + fraction * (pt2.y - pt1.y)
      };
    } else {
      return kInfinitePoint;
    }
  }, [kHandle1Loc, kHandle2Loc]);

  const positionEquation = useCallback(
    (equation: Selection<HTMLElement, unknown, HTMLElement, any>, point: Point, index: number, lineKey: string) => {
    const annotationId = getAnnotationId(lineKey, "equation");
    equation.style('left', `${point.x}px`)
        .style('top', `${point.y}px`);
    if (model.isVisible) {
      const equationNode = equation.node() as Element,
        rect = equationNode?.getBoundingClientRect(),
        width = rect?.width || kAnnotationNodeDefaultRadius,
        height = rect?.height || kAnnotationNodeDefaultRadius;
      setAnnotationLocation(instanceId, annotationId, point, { width, height });
    } else {
      setAnnotationLocation(instanceId, annotationId, undefined, undefined);
    }
  }, [setAnnotationLocation, model]);

  const updateClasses = useCallback(
    (elt: Selection<SVGLineElement, unknown, null, undefined>, lineKey: string, hover = false) => {
      const isLineSelected = !!model.lines.get(lineKey)?.isSelected;
      elt.classed("selected", isLineSelected);
      elt.classed("hover", hover);
  }, [model.lines]);

  const refreshLines = useCallback(() => {
    function fixEndPoints(
      iLine: Selection<SVGLineElement, unknown, null, undefined>,
      pixelPtsOnAxes: { pt1: Point, pt2: Point }
    ) {
      iLine
        .attr('x1', pixelPtsOnAxes.pt1.x)
        .attr('y1', pixelPtsOnAxes.pt1.y)
        .attr('x2', pixelPtsOnAxes.pt2.x)
        .attr('y2', pixelPtsOnAxes.pt2.y);
    }

    function fixArrow(
      elt: Selection<SVGPolygonElement, unknown, null, undefined>,
      index: number,
      pixelPtsOnAxes: { pt1: Point, pt2: Point }
    ) {
      const
        end   = index===1 ? pixelPtsOnAxes.pt1 : pixelPtsOnAxes.pt2,
        start = index===1 ? pixelPtsOnAxes.pt2 : pixelPtsOnAxes.pt1,
        offset = `${end.x},${end.y}`,
        dx = end.x - start.x,
        dy = end.y - start.y,
        angle = 90-Math.atan2(dy, -dx)*180/Math.PI;
      elt
        .attr('transform', `translate(${offset}) rotate(${angle})`);
    }

    // Position handle {index} at appropriate position.
    // This is the stored pivot location if there is one, otherwise calculated.
    function fixHandles(
      elt: Selection<SVGCircleElement, unknown, null, undefined>,
      index: number,
      pixelPtsOnAxes: { pt1: Point, pt2: Point },
      lineModel: IMovableLineInstance,
      lineKey: string
    ) {
      console.log(`... fixHandles`, pixelPtsOnAxes);
      const pivot = index === 1 ? lineModel?.pivot1 : lineModel?.pivot2;
      let x,y;
      if (pivot?.x && pivot?.y) {
        console.log(`  . pivot`, pivot.x, pivot.y);
        x = layout.getAxisMultiScale("bottom")?.getScreenCoordinate({ data: pivot.x, cell: 0 });
        y = layout.getAxisMultiScale("left")?.getScreenCoordinate({ data: pivot.y, cell: 0 });
      } else {
        const point = calculateHandlePosition(index, pixelPtsOnAxes.pt1, pixelPtsOnAxes.pt2);
        console.log(`  . no pivot`, point);
        x = point.x;
        y = point.y;
      }
      if (x != null && y != null) {
        elt
          .attr('cx', x)
          .attr('cy', y);

        const annotationId = getAnnotationId(lineKey, "handle", index === 1 ? "lower" : "upper");
        const annotationPoint = model.isVisible ? { x, y } : undefined;
        setAnnotationLocation(instanceId, annotationId, annotationPoint, undefined);
      }
    }

    function refreshEquation(
      slope: number, intercept: number, lineModel: IMovableLineInstance, index: number, lineKey: string
    ) {
      const equationSelector = '.' + equationClassName(lineKey, instanceId);
      if (pointsOnAxes.current.length < 1) return;
      const lineEquationContainer = select(equationSelector);
      const lineEquationElt =
        select<HTMLElement,unknown>(`${equationSelector} p`);
      const
        attrNames = {x: xAttrName, y: yAttrName},
        string = equationString(slope, intercept, attrNames);

      lineEquationContainer
        .style('width', `${plotWidth}px`)
        .style('height', `${plotHeight}px`);
      lineEquationElt.html(string);

      const fixedCoords = lineModel?.currentEquationCoords;
      if (fixedCoords) {
        // The equation is unpinned -- the user dragged it away from the line. Use stored position.
        // It is stored in the model as a fraction of the graph height & width.
        positionEquation(lineEquationElt, { x: fixedCoords.x*plotWidth, y: fixedCoords.y*plotHeight }, index, lineKey);
      } else {
        // Pinned to line; calculate position.
        const pointXSum = pointsOnAxes.current[index].pt1.x + pointsOnAxes.current[index].pt2.x;
        const pointYSum = pointsOnAxes.current[index].pt1.y + pointsOnAxes.current[index].pt2.y;
        const screenX = xScale(pointXSum / 2) / xSubAxesCount;
        const screenY = yScale(pointYSum / 2) / ySubAxesCount;
        positionEquation(lineEquationElt, { x: screenX, y: screenY }, index, lineKey);
      }
    }

    lineObjects.current.forEach((lineObject, index) => {
      const lineModel = model.lines.get(lineObject.key);
      if (!lineObject.line || !lineModel) return;

      const slope = lineModel.currentSlope;
      const intercept = lineModel.currentIntercept;
      const { domain: xDomain } = xAxis;
      const { domain: yDomain } = yAxis;
      pointsOnAxes.current[index] = lineToAxisIntercepts(slope, intercept, xDomain, yDomain);
      // The coordinates at which the line intersects the axes
      console.log(`xxx points`, pointsOnAxes.current[index].pt1, `y`, pointsOnAxes.current[index].pt2);
      console.log(`  x scaled`, xScale(pointsOnAxes.current[index].pt2.x));
      const pixelPtsOnAxes = {
        pt1: {
          x: xScale(pointsOnAxes.current[index].pt1.x) / xSubAxesCount,
          y: yScale(pointsOnAxes.current[index].pt1.y) / ySubAxesCount
        },
        pt2: {
          x: xScale(pointsOnAxes.current[index].pt2.x) / xSubAxesCount,
          y: yScale(pointsOnAxes.current[index].pt2.y) / ySubAxesCount
        }
      };
      lineObject.line && fixEndPoints(lineObject.line, pixelPtsOnAxes);
      lineObject.cover && fixEndPoints(lineObject.cover, pixelPtsOnAxes);
      lineObject.arrowLower && fixArrow(lineObject.arrowLower, 1, pixelPtsOnAxes);
      lineObject.arrowUpper && fixArrow(lineObject.arrowUpper, 2, pixelPtsOnAxes);
      lineObject.handleLower && fixHandles(lineObject.handleLower, 1, pixelPtsOnAxes, lineModel, lineObject.key);
      lineObject.handleUpper && fixHandles(lineObject.handleUpper, 2, pixelPtsOnAxes, lineModel, lineObject.key);
      updateClasses(lineObject.line, lineObject.key);
      refreshEquation(slope, intercept, lineModel, index, lineObject.key);
    });
  }, [
    setAnnotationLocation, calculateHandlePosition, instanceId, layout, model.isVisible, model.lines, plotHeight,
    plotWidth, positionEquation, updateClasses, xAttrName, xAxis, xScale, xSubAxesCount, yAttrName, yAxis, yScale,
    ySubAxesCount
  ]);

  // Refresh the scale copies
  useEffect(() => {
    xScaleCopy.current = xScale.copy();
    yScaleCopy.current = yScale.copy();
  }, [xScale, yScale]);

  // Refresh the lines
  useEffect(function refresh() {
    const disposer = autorun(() => {
      refreshLines();
    });
    return () => disposer();
  }, [refreshLines]);

  // Line drag handler
  const continueTranslate = useCallback((event: MouseEvent, lineKey: string) => {
    const lineParams = model.lines.get(lineKey),
      slope = lineParams?.currentSlope || 0,
      tWorldX = xScaleCopy.current.invert(event.x),
      tWorldY = yScaleCopy.current.invert(event.y);

    // If the line is dragged outside plot area, reset it to the initial state
    if (
        tWorldX < xScaleCopy.current.domain()[0] ||
        tWorldX > xScaleCopy.current.domain()[1] ||
        tWorldY < yScaleCopy.current.domain()[0] ||
        tWorldY > yScaleCopy.current.domain()[1]
    ) {
      const { intercept, slope: initSlope } = computeSlopeAndIntercept(xAxis, yAxis);
      model.dragLine(intercept, initSlope, lineKey);
      return;
    }

    const newIntercept = isFinite(slope) ? tWorldY - slope * tWorldX : tWorldX;
    model.dragLine(newIntercept, slope, lineKey);
    refreshLines();
  }, [model, refreshLines, xAxis, yAxis]);

  const endTranslate = useCallback((lineKey: string) => {
    model.saveLine(lineKey);
    refreshLines();
  }, [model, refreshLines]);

  const startRotation = useCallback((
    event: { x: number, y: number },
    lineSection: string,
    index: number
  ) => {
    // Fix the pivot position of the handle not being dragged for the duration of the drag.
    const lineObject = lineObjects.current[index];
    const lineParams = model.lines.get(lineObject.key);
    if (lineParams && pointsOnAxes.current) {
      const pivot = calculateHandlePosition(lineSection === "lower" ? 2 : 1,
        pointsOnAxes.current[index].pt1, pointsOnAxes.current[index].pt2);
      if (lineSection === "lower") {
        lineParams.setPivot2(pivot);
      } else {
        lineParams.setPivot1(pivot);
      }
    }
    refreshLines();
  }, [calculateHandlePosition, model.lines, refreshLines]);

  const continueRotation = useCallback((
    event: { x: number, y: number, dx: number, dy: number },
    lineSection: string,
    index: number
  ) => {
    if (!pointsOnAxes.current) return;
    const lineObject = lineObjects.current[index];
    const lineParams = model.lines.get(lineObject.key);
    // This is the point we rotate around: it will not move.
    const pivot = lineSection === "lower" ? lineParams?.pivot2 : lineParams?.pivot1;
    if (!pivot) return;

    if (event.dx !== 0 || event.dy !== 0) {
      let isVertical = false;
      // The dragPivot will be the point on the line section where it is being dragged.
      const dragPivot = { x: xScaleCopy.current.invert(event.x), y: yScaleCopy.current.invert(event.y) };

      // If the line is perfectly vertical, set the dragPivot's x coordinate to the x coordinate of the
      // original pivot. If the line is perfectly horizontal, set the dragPivot's y coordinate to the y
      // coordinate of the original pivot.
      if (Math.abs(xScaleCopy.current(dragPivot.x) - xScaleCopy.current(pivot.x)) < kTolerance) { // vertical
        dragPivot.x = pivot.x;
        isVertical = true;
      } else if (Math.abs(yScaleCopy.current(dragPivot.y) - yScaleCopy.current(pivot.y)) < kTolerance) { // horizontal
        dragPivot.y = pivot.y;
      }

      let newSlope, newIntercept;
      if (isVertical) {
        newSlope = Number.POSITIVE_INFINITY;
        newIntercept = pivot.x;
      } else {
        newSlope = lineSection === "lower"
          ? (pivot.y - dragPivot.y) / (pivot.x - dragPivot.x)
          : (dragPivot.y - pivot.y) / (dragPivot.x - pivot.x);
        newIntercept = dragPivot.y - newSlope * dragPivot.x;
      }

      lineObject.handleLower?.classed('negative-slope', newSlope < 0);
      lineObject.handleUpper?.classed('negative-slope', newSlope < 0);

      model.dragLine(newIntercept, newSlope, lineObject.key);
      const lineModel = model.lines.get(lineObject.key);
      if (lineSection === "lower") {
        lineModel!.setPivot1(dragPivot);
      } else {
        lineModel!.setPivot2(dragPivot);
      }
    }
    refreshLines();
  }, [model, refreshLines]);

  const endRotation = useCallback((lineKey: string) => {
    const lineParams = model.lines.get(lineKey);
    model.saveLine(lineKey);
    lineParams?.setPivot1(kInfinitePoint);
    lineParams?.setPivot2(kInfinitePoint);
    refreshLines();
  }, [model, refreshLines]);

  const moveEquation = useCallback((
    event: { x: number, y: number, dx: number, dy: number }, index: number, lineKey: string
  ) => {
    if (event.dx !== 0 || event.dy !== 0) {
      const equation =
        select<HTMLElement,unknown>(`.${equationClassName(lineKey, instanceId)} p`),
        equationNode = equation.node() as Element,
        equationWidth = equationNode?.getBoundingClientRect().width || 0,
        equationHeight = equationNode?.getBoundingClientRect().height || 0,
        left = event.x - equationWidth / 2,
        top = event.y - equationHeight / 2,
        // Get the percentage of plotWidth of the equation box's coordinates
        // for a more accurate placement of the equation box.
        x = left / plotWidth,
        y = top / plotHeight;

      positionEquation(equation, { x: left, y: top }, index, lineObjects.current[index].key);
      model.dragEquation({x, y}, lineObjects.current[index].key);
    }
  }, [instanceId, plotWidth, plotHeight, positionEquation, model]);

  const endMoveEquation = useCallback((lineKey: string) => {
    model.saveEquationCoords(lineKey);
  }, [model]);

  const addBehaviors = useCallback(() => {
    lineObjects.current.forEach((lineObject, index) => {
      const behaviors: {
        cover: DragBehavior<SVGLineElement, unknown, unknown>,
        lower: DragBehavior<SVGCircleElement, unknown, unknown>,
        upper: DragBehavior<SVGCircleElement, unknown, unknown>,
        equation: DragBehavior<HTMLDivElement, unknown, unknown>
      } = {
        cover: drag<SVGLineElement, unknown>()
          .on("drag", (e) => continueTranslate(e, lineObject.key))
          .on("end", () => endTranslate(lineObject.key)),
        lower: drag<SVGCircleElement, unknown>()
          .on("start", (e) => startRotation(e, "lower", index))
          .on("drag", (e) => continueRotation(e, "lower", index))
          .on("end", () => endRotation(lineObject.key)),
        upper: drag<SVGCircleElement, unknown>()
          .on("start", (e) => startRotation(e, "upper", index))
          .on("drag", (e) => continueRotation(e, "upper", index))
          .on("end", () => endRotation(lineObject.key)),
        equation: drag<HTMLDivElement, unknown>()
          .on("drag", (e) => moveEquation(e, index, lineObject.key))
          .on("end", () => endMoveEquation(lineObject.key))
      };

      lineObject.cover?.call(behaviors.cover);
      lineObject.cover?.on("click", () => toggleLineSelection(lineObject.key));
      lineObject.cover?.on("mouseover", () => updateClasses(lineObject.line!, lineObject.key, true));
      lineObject.cover?.on("mouseout", () => updateClasses(lineObject.line!, lineObject.key, false));
      lineObject.handleLower?.call(behaviors.lower);
      lineObject.handleUpper?.call(behaviors.upper);
      lineObject.equation?.call(behaviors.equation);
    });
  }, [continueRotation, continueTranslate, endMoveEquation, endRotation, endTranslate, moveEquation, startRotation,
      toggleLineSelection, updateClasses]);

  // Build the lines and their cover segments and handles
  useEffect(function createElements() {
    return autorun(() => {
      if (!model.lines) return;

      // Clear any previously added elements
      lineObjects.current = [];
      const selection = select(lineRef.current);
      selection.html(null);
      select(`#${containerId}`).selectAll("div").remove();

      model.lines.forEach((line, _key) => {
        const key = String(_key);
        const newLineObject: ILineObject = { key };
        if (graphModel.getColorForId(key) === "#000000") {
          graphModel.setColorForId(key);
        }
        const lineColor = graphModel.getColorForId(key);
        // Set up the line and its cover segments and handles
        const lineClassNames = classNames("movable-line", lineClassName(key), { selected: line.isSelected });
        newLineObject.line = selection.append('line')
          .attr('class', lineClassNames)
          .attr('data-testid', `movable-line`)
          .attr('stroke', lineColor);
        newLineObject.arrowLower = selection.append('polygon')
          .attr('class', 'movable-line-arrow')
          .attr('points', '0 0 -7 -14 7 -14 0 0')
          .attr('fill', lineColor);
        newLineObject.arrowUpper = selection.append('polygon')
          .attr('class', 'movable-line-arrow')
          .attr('points', '0 0 -7 -14 7 -14 0 0')
          .attr('fill', lineColor);
        newLineObject.cover = selection.append('line')
          .attr('class', 'movable-line-cover');
        newLineObject.handleLower = selection.append('circle')
          .attr('r', kHandleSize/2)
          .attr('class', 'movable-line-handle movable-line-lower-handle')
          .attr('fill', lineColor)
          .attr('stroke', lineColor);
        newLineObject.handleUpper = selection.append('circle')
          .attr('r', kHandleSize/2)
          .attr('class', 'movable-line-handle movable-line-upper-handle')
          .attr('fill', lineColor)
          .attr('stroke', lineColor);

        // Set up the corresponding equation box
        // Define the selector that corresponds with this specific movable line's adornment container
        const equationDivClass = classNames(
          equationContainerClass,
          "movable-line-equation-container",
          equationClassName(key, instanceId)
        );
        const equationDiv = select(`#${containerId}`).append('div')
          .attr('class', equationDivClass)
          .attr('data-testid', equationContainerClass)
          .style('width', `${plotWidth}px`)
          .style('height', `${plotHeight}px`);

        equationDiv
          .append<HTMLElement>('p')
          .attr('class', 'movable-line-equation')
          .attr('data-testid', `movable-line-equation-${key}`);

        newLineObject.equation = equationDiv;
        lineObjects.current.push(newLineObject);
      });
      refreshLines();
      if (!readOnly) {
        addBehaviors();
      }
    }, { name: "MovableLine.createElements" });
  }, [addBehaviors, containerId, equationContainerClass, graphModel, instanceId, model.lines, plotHeight, plotWidth,
      readOnly, refreshLines]);

  return (
    <svg
      className={`line-${model.classNameFromKey(subPlotKey)}`}
      style={{height: `${plotHeight}px`, width: `${plotWidth}px`}}
      x={0}
      y={0}
    >
        <g>
          <g ref={lineRef}/>
        </g>
    </svg>
  );
});
