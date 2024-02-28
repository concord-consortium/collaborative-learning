import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { axisBottom, drag, pointer, scaleLinear, select } from 'd3';
import { observer } from 'mobx-react';
import { useUIStore } from '../../../hooks/use-stores';
import { kSmallAnnotationNodeRadius } from '../../../components/annotations/annotation-utilities';
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { useToolbarTileApi } from "../../../components/tiles/hooks/use-toolbar-tile-api";
import { ITileProps } from "../../../components/tiles/tile-component";
import { OffsetModel } from '../../../models/annotations/clue-object';
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { HotKeys } from "../../../utilities/hot-keys";
import { NumberlineContentModelType, PointObjectModelType,  } from "../models/numberline-content";
import {
  kAxisStyle, kAxisWidth, kContainerWidth, kNumberLineContainerHeight,
  tickHeightDefault, tickStyleDefault, tickWidthDefault, tickWidthZero,
  innerPointRadius, outerPointRadius, numberlineYBound, yMidPoint, kTitleHeight, kArrowheadTop,
  kArrowheadOffset, kPointButtonRadius, tickTextTopOffsetDefault, tickTextTopOffsetMinAndMax
} from '../numberline-tile-constants';
import { NumberlineToolbar } from "./numberline-toolbar";
import NumberlineArrowLeft from "../../../assets/numberline-arrow-left.svg";
import NumberlineArrowRight from "../../../assets/numberline-arrow-right.svg";
import { EditableNumberlineValue } from './editable-numberline-value';

import "./numberline-tile.scss";

// - Guidelines -
// - As students, we want to express both closed form counting and inequalities which end with an open circle point.
// - add an open circle point to the toolbar
// - revise other toolbar buttons to the latest versions
// - when the open circle point is used, create an open circle point
// - point types are saved and restored and can be used in curriculum.


export const NumberlineTile: React.FC<ITileProps> = observer(function NumberlineTile(props){
  const { documentContent, model, readOnly, scale, tileElt, onRegisterTileApi, onUnregisterTileApi } = props;
  console.log("-------< Numberline >-----------");

  const content = model.content as NumberlineContentModelType;
  const [hoverPointId, setHoverPointId] = useState("");
  const [_selectedPointId, setSelectedPointId] = useState(""); // Just used to rerender when a point is selected
  const ui = useUIStore();
  const isTileSelected = ui.isSelectedTile(model);

  //---------------- Model Manipulation Functions -------------------------------------------------
  const deleteSelectedPoints = useCallback(() => {
    content.deleteSelectedPoints();
  }, [content]);

  const createPoint = (xValue: number) => {
    if (!readOnly) {
      const point = content.createAndSelectPoint(xValue);
      setHoverPointId(point.id);
    }
  };

  const handleMinMaxChange = (minOrMax: string, newValue: number) => {
    if (minOrMax === "min" && newValue < content.max){
      content.setMin(newValue);
    } else if (minOrMax === "max" && newValue > content.min){
      content.setMax(newValue);
    }
  };

  // Set up key handling
  const hotKeys = useRef(new HotKeys());
  useEffect(()=>{
    if (!readOnly) {
      hotKeys.current.register({
        "delete": deleteSelectedPoints,
        "backspace": deleteSelectedPoints,
      });
    }
  }, [deleteSelectedPoints, readOnly]);

  //---------------- Calculate Width Of Tile / Scale ----------------------------------------------
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [tileWidth, setTileWidth] = useState(0);
  const containerWidth = tileWidth * kContainerWidth;
  const axisWidth = tileWidth * kAxisWidth;
  const xShiftNum = (containerWidth - axisWidth) / 2;
  const arrowOffset = xShiftNum + kArrowheadOffset;

  const xScale = useMemo(() => {
    return scaleLinear()
      .domain([content.min, content.max])
      .range([0, axisWidth]);
  }, [axisWidth, content.min, content.max]);

  const axisLeft = useMemo(() => tileWidth * (1 - kAxisWidth) / 2, [tileWidth]);

  const pointPosition = useCallback((point: PointObjectModelType) => {
    const x = xScale(point.currentXValue);
    return { x, y: yMidPoint };
  }, [xScale]);

  useEffect(() => {
    let obs: ResizeObserver;
    if (documentScrollerRef.current) {
      obs = new ResizeObserver(() => {
        if (documentScrollerRef.current?.clientWidth){
          const newTileWidth  = documentScrollerRef.current?.clientWidth;
          setTileWidth(newTileWidth ?? 0);
        }
      });
      obs.observe(documentScrollerRef.current);
    }
    return () => obs?.disconnect();
  }, []);




  //----------------- Register Tile API functions -------------------------------------------------
  const annotationPointCenter = useCallback((pointId: string) => {
    const point = content.getPoint(pointId);
    if (!point) return undefined;
    const { x, y } = pointPosition(point);
    return { x: x + axisLeft, y: y + kTitleHeight };
  }, [axisLeft, content, pointPosition]);

  const getObjectBoundingBox = useCallback((objectId: string, objectType?: string) => {
    if (objectType === "point") {
      const coords = annotationPointCenter(objectId);
      if (!coords) return undefined;
      const { x, y } = coords;
      const boundingBox = {
        height: 2 * outerPointRadius,
        left: x - outerPointRadius,
        top: y - outerPointRadius,
        width: 2 * outerPointRadius
      };
      return boundingBox;
    }
  }, [annotationPointCenter]);

  useEffect(() => {
    onRegisterTileApi({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return content.exportJson(options);
      },
      getObjectBoundingBox,
      getObjectButtonSVG: ({ classes, handleClick, objectId, objectType }) => {
        if (objectType === "point") {
          const coords = annotationPointCenter(objectId);
          if (!coords) return;
          const { x, y } = coords;
          return (
            <circle
              className={classes}
              cx={x}
              cy={y}
              onClick={handleClick}
              r={kPointButtonRadius}
            />
          );
        }
      },
      getObjectDefaultOffsets: (objectId: string, objectType?: string) => {
        const offsets = OffsetModel.create({});
        if (objectType === "point") {
          offsets.setDy(-innerPointRadius);
        }
        return offsets;
      },
      getObjectNodeRadii(objectId: string, objectType?: string) {
        if (objectType === "point") {
          return {
            centerRadius: kSmallAnnotationNodeRadius / 2,
            highlightRadius: kSmallAnnotationNodeRadius
          };
        }
      },
    });
  }, [annotationPointCenter, content, getObjectBoundingBox, onRegisterTileApi]);

  //-------------------  SVG Ref to Numberline & SVG ----------------------------------------------
  const svgRef = useRef<SVGSVGElement | null>(null);
  const svg = select(svgRef.current);
  const svgNode = svg.node();
  const axisRef = useRef<SVGGElement | any>(null);
  const axis = select(axisRef.current);

  /* ============================ [ Handlers / Mouse Functions ]  ============================== */
  const mousePos = (e: Event) => pointer(e, svgNode);

  const mouseInBoundingBox = (mouseXPos: number,  mouseYPos: number) => {
    const yTopBound = yMidPoint + numberlineYBound;
    const yBottomBound = yMidPoint - numberlineYBound;
    const isBetweenYBounds = (mouseYPos >= yBottomBound && mouseYPos <= yTopBound);
    const isBetweenXBounds = (mouseXPos >= 0 && mouseXPos <= axisWidth);
    return isBetweenYBounds && isBetweenXBounds;
  };

  const handleMouseClick = (e: Event) => {
    if (!readOnly){
      if (hoverPointId) {
        const hoverPoint = content.getPoint(hoverPointId);
        if (hoverPoint) {
          content.setSelectedPoint(hoverPoint);
          setSelectedPointId(hoverPoint.id);
        }
      } else {
        // only create point if we are not hovering over a point and within bounding box
        const [mouseX, mouseY] = mousePos(e);
        if (mouseInBoundingBox(mouseX, mouseY)) {
          createPoint(xScale.invert(mouseX));
        }
      }
    }
  };

  function findHoverPoint(e: MouseEvent) {
    const [mouseX, mouseY] = mousePos(e);
    let hoverPoint: PointObjectModelType | undefined;
    content.pointsArr.forEach(point => {
      const { x, y } = pointPosition(point);
      const distanceSquared = (x - mouseX) ** 2 + (y - mouseY) ** 2;
      if (distanceSquared <= outerPointRadius ** 2) {
        hoverPoint = point;
      }
    });
    const id = hoverPoint?.id ?? "";
    setHoverPointId(id);
    return id;
  }

  const drawMouseFollowPoint = (mouseX: number) => {
    svg.append("circle") //create a circle that follows the mouse
      .attr("cx", mouseX)
      .attr("cy", yMidPoint)
      .attr("r", innerPointRadius)
      .classed("mouse-follow-point", true)
      .classed("point-inner-circle", true);
  };

  const clearMouseFollowPoint = () => svg.selectAll(".mouse-follow-point").remove();

  const handleMouseMove = (e: MouseEvent) => {
    if (!readOnly){
      const [mouseX, mouseY] = mousePos(e);
      const isMouseInBoundingBox = mouseInBoundingBox(mouseX, mouseY);
      const id = findHoverPoint(e);

      // Draw the follow point if no point is being hovered
      clearMouseFollowPoint();
      if (isMouseInBoundingBox && !id) drawMouseFollowPoint(mouseX);
    }
  };

  svg.on("click", (e) => handleMouseClick(e));
  svg.on("mousemove", (e) => handleMouseMove(e));

  // * ================================ [ Construct Numberline ] =============================== */
  const numOfTicks = 11;

  //Returns an equally divided array between min and max with numOfTick # of elements
  const generateTickValues = (min: number, max: number) => {
    const tickValues = [];
    const range = content.max - content.min;
    for (let i = 0; i < numOfTicks; i++) {
      const position = i / (numOfTicks - 1);
      const tickValue = content.min + (position * range);
      tickValues.push(tickValue);
    }
    return tickValues;
  };

  const tickFormatter = (value: number | { valueOf(): number }, index: number) => {
    if (typeof value !== 'number') {
      return value.toString();
    }
    if (value === content.min || value === content.max) {
      return '';
    }
    return value.toFixed(1);
  };

  if (axisWidth !== 0) {
    const readOnlyState = readOnly ? "readOnly" : "readWrite";
    const axisClass = `axis-${model.id}-${readOnlyState}`;
    const tickValues = generateTickValues(content.min, content.max);

    axis
      .attr("class", `${axisClass} num-line`)
      .attr("style", `${kAxisStyle}`)
      .call(axisBottom(xScale)
      .tickValues(tickValues)
      .tickFormat(tickFormatter))

      .selectAll("g.tick line") // Customize tick marks
      .attr("class", (value)=> (value === 0) ? "zero-tick" : "default-tick")
      .attr("y2", tickHeightDefault)
      .attr("stroke-width", (value) => (value === 0) ? tickWidthZero : tickWidthDefault)
      .attr("style", tickStyleDefault);

    axis
      .selectAll("g.tick text") // Customize tick labels
      .attr("dy", (dy) => {
        return (dy === content.min || dy === content.max) ? tickTextTopOffsetMinAndMax : tickTextTopOffsetDefault;
      });
  }

  /* ========================== [ Construct/Update Circles ] =================================== */
  if (axisWidth !== 0){
    const handleDrag = drag<SVGCircleElement, PointObjectModelType>()
      .on('drag', (e, p) => {
        const [mouseX, mouseY] = mousePos(e);
        if (!readOnly && mouseInBoundingBox(mouseX, mouseY)) {
          const hoverPoint = content.getPoint(hoverPointId);
          if (hoverPoint) content.setSelectedPoint(hoverPoint);
          const newXValue = xScale.invert(mouseX);
          p.setDragXValue(newXValue);
        }
      })
      .on("end", (e, p) => {
        if (!readOnly) {
          p.setXValueToDragValue();
        }
      });

    const updateCircles = () => {
      /* =========================== [ Outer Hover Circles ] ======================= */
      //---- Initialize outer hover circles
      const outerPoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.outer-point')
        .data(content.pointsArr);

      outerPoints.enter()
        .append("circle").attr("class", "outer-point")
        .attr('cx', (p) => xScale(p.currentXValue)) //mapped to axis width
        .attr('cy', yMidPoint).attr('r', outerPointRadius).attr('id', p => p.id)
        .classed("point-outer-circle", true)
        .call((e) => handleDrag(e)); // Attach drag behavior to newly created circles

      // --- Update functions outer hover circles
      outerPoints
        .attr('cx', (p) => xScale(p.currentXValue)) //mapped to axis width
        .classed("hovered", (p, idx) => (hoverPointId === p.id))
        .call((e) => handleDrag(e)); // pass again in case axisWidth changes

      outerPoints.exit().remove(); //cleanup

      /* =========================== [ Inner Circles ] ============================= */
      //---- Initialize inner hover circles
      const innerPoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.inner-point')
        .data(content.pointsArr);

      // Initialize Attributes
      innerPoints.enter()
        .append("circle")
        .attr("class", "inner-point")
        .attr('cx', (p) => xScale(p.currentXValue)) //mapped to axis width
        .attr('cy', yMidPoint).attr('r', innerPointRadius).attr('id', p => p.id)
        .classed("point-inner-circle", true)
        .call((e) => handleDrag(e)); // Attach drag behavior to newly created circles

      // --- Update functions inner circles
      innerPoints
        .attr('cx', (p, idx) => xScale(p.currentXValue))
        .classed("selected", (p)=> p.id in content.selectedPoints)
        .call((e) => handleDrag(e)); // pass again in case axisWidth changes

      innerPoints.exit().remove(); //cleanup
    };
    updateCircles();
  }
  // Set up toolbar props
  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });
  return (
    <div
      className={classNames("numberline-wrapper", { "read-only": readOnly })}
      onKeyDown={(e) => hotKeys.current.dispatch(e)}
      tabIndex={0}
    >
      <div className={"numberline-title"}>
        <BasicEditableTileTitle />
      </div>
      <NumberlineToolbar
        documentContent={documentContent}
        tileElt={tileElt}
        {...toolbarProps}
        scale={scale}
        handleClearPoints={() => content.deleteAllPoints()}
        handleDeletePoint={deleteSelectedPoints}
      />
      <div
        className="numberline-tool"
        ref={documentScrollerRef}
        data-testid="numberline-tool"
        style={{"height": `${kNumberLineContainerHeight}`}}
      >
        <div className="numberline-tool-container" >
          <svg ref={svgRef} width={axisWidth}>
            <g ref={axisRef}></g>
          </svg>
          <NumberlineArrowLeft
            className="arrow"
            style={{ left: arrowOffset, top: kArrowheadTop }}
          />
          <NumberlineArrowRight
            className="arrow"
            style={{ right: arrowOffset, top: kArrowheadTop }}
          />
          <EditableNumberlineValue
            value={content.min}
            minOrMax={"min"}
            offset={arrowOffset}
            readOnly={readOnly}
            isTileSelected={isTileSelected}
            onValueChange={(newValue) => handleMinMaxChange("min", newValue)}
          />
          <EditableNumberlineValue
            value= {content.max}
            minOrMax={"max"}
            offset={arrowOffset}
            readOnly={readOnly}
            isTileSelected={isTileSelected}
            onValueChange={(newValue) => handleMinMaxChange("max", newValue)}
          />
        </div>
      </div>
    </div>
  );
});

export default NumberlineTile;
