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
  kAxisStyle, kAxisWidth, kContainerWidth, kNumberLineContainerHeight, numberlineDomainMax, numberlineDomainMin,
  tickHeightDefault, tickStyleDefault, tickWidthDefault, tickWidthZero,
  innerPointRadius, outerPointRadius, numberlineYBound, yMidPoint, kTitleHeight, kArrowheadTop,
  kArrowheadOffset, kPointButtonRadius, tickTextTopOffset
} from '../numberline-tile-constants';
import { NumberlineToolbar } from "./numberline-toolbar";
import NumberlineArrowLeft from "../assets/numberline-arrow-left.svg";
import NumberlineArrowRight from "../assets/numberline-arrow-right.svg";

import "./numberline-tile.scss";

export const NumberlineTile: React.FC<ITileProps> = observer(function NumberlineTile(props){
  const { documentContent, model, readOnly, scale, tileElt, onRegisterTileApi, onUnregisterTileApi } = props;

  const content = model.content as NumberlineContentModelType;
  const [hoverPointId, setHoverPointId] = useState("");
  const [_selectedPointId, setSelectedPointId] = useState(""); // Just used to rerender when a point is selected
  const ui = useUIStore();
  const isTileSelected = ui.isSelectedTile(model);
  const [min, setMin] = useState(-5);
  const [max, setMax] = useState(5);
  // if (!readOnly) console.log("\t🥩 isTileSelected:", isTileSelected);

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
  console.log("\t🥩 axisWidth:", axisWidth);
  console.log("\t🥩 containerWidth:", containerWidth);
  console.log("\t🥩 xShiftNum:", xShiftNum);

  const xScale = useMemo(() => {
    return scaleLinear()
      .domain([numberlineDomainMin, numberlineDomainMax])
      .range([0, axisWidth]);
  }, [axisWidth]);
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
// * ============================================ GUIDELINES ===================================== */
//console.log
//   - standard range shows edit boxes when numberline has focus
// - if rightmost value is entered that is smaller than leftmost value of range, then values are swapped
// - if nonnumeric value is entered, previous value is restored
// - numberline redraws after enter key or loss of focus
// - numberline always has 11 ticks (inclusive of range ends) evenly divided between new endpoints
// - if the 0 tick is present, it's darker/heavier than the rest
// - When the user clicks in the box for an end value, it aquires the same edit styling/Ibeam cursor as the title box
// - numbers from 1 to 3 digits are allowed, and the box should grow and shrink accordingly.
// - end ticks should be drawn so that their tickmark shows, meaning that they are slightly inside of the arrows on the line


  // * ================================ [ Construct Numberline ] =============================== */
  if (axisWidth !== 0) {
    const readOnlyState = readOnly ? "readOnly" : "readWrite";
    const axisClass = `axis-${model.id}-${readOnlyState}`;
    const numOfTicks = numberlineDomainMax - numberlineDomainMin;

    const tickFormatter = (value: number | { valueOf(): number }, index: number) => {
      // Hide the tick marks for -5 and 5
      if (typeof value === 'number' && value === -5) {
        return '';
      }
      if (typeof value === 'number' && value === 5) {
        return '';
      }
      return value.toString();
    };

    axis
      .attr("class", `${axisClass} num-line`)
      .attr("style", `${kAxisStyle}`)
      .call(axisBottom(xScale).tickSizeOuter(0).ticks(numOfTicks))
      // .tickFormat(tickFormatter).ticks(numOfTicks))
      .selectAll("g.tick line") // Customize tick marks
      .attr("class", (value)=> (value === 0) ? "zero-tick" : "default-tick")
      .attr("y2", tickHeightDefault)
      .attr("stroke-width", (value) => (value === 0) ? tickWidthZero : tickWidthDefault)
      .attr("style", tickStyleDefault);

    axis
      .selectAll("g.tick text") // Customize tick labels
      .attr("dy", (dy) => tickTextTopOffset);
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
  console.log("numberlineArrowLeft Style:", { left: xShiftNum + kArrowheadOffset, top: kArrowheadTop });

  return (
    <div
      className={classNames("numberline-wrapper", { "read-only": readOnly })}
      onKeyDown={(e) => hotKeys.current.dispatch(e)}
      tabIndex={0}
    >
      <div className={"numberline-title"}>
        <BasicEditableTileTitle readOnly={readOnly} />
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
          <NumberlineArrowLeft
            className="arrow"
            style={{ left: xShiftNum + kArrowheadOffset, top: kArrowheadTop }}
          />
          <NumberlineArrowRight
            className="arrow"
            style={{ right: xShiftNum + kArrowheadOffset, top: kArrowheadTop }}
          />
          <svg ref={svgRef} width={axisWidth}>
            <g ref={axisRef}></g>
          </svg>
          {/* {
            <>
              <EditableNumberlineValue
                value={min}
                minOrMax={"min"}
                axisWidth={axisWidth}
                readOnly={readOnly}
                isTileSelected={isTileSelected}
              />
              <EditableNumberlineValue
                value= {max}
                minOrMax={"max"}
                axisWidth={axisWidth}
                readOnly={readOnly}
                isTileSelected={isTileSelected}
              />
            </>
          } */}
        </div>
      </div>
    </div>
  );
});

export default NumberlineTile;
