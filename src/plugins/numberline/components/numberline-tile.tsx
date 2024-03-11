import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { axisBottom, drag, pointer, scaleLinear, select } from 'd3';
import { observer } from 'mobx-react';
import { useUIStore } from '../../../hooks/use-stores';
import { kSmallAnnotationNodeRadius } from '../../../components/annotations/annotation-utilities';
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { OffsetModel } from '../../../models/annotations/clue-object';
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { HotKeys } from "../../../utilities/hot-keys";
import { NumberlineContentModelType, PointObjectModelType,  } from "../models/numberline-content";
import {
  kAxisStyle, kAxisWidth, kContainerWidth, kNumberLineContainerHeight,
  tickHeightDefault, tickStyleDefault, tickWidthDefault, tickWidthZero,
  innerPointRadius, outerPointRadius, numberlineYBound, yMidPoint, kTitleHeight, kArrowheadTop,
  kArrowheadOffset, kPointButtonRadius, tickTextTopOffsetDefault, tickTextTopOffsetMinAndMax,
  kPointValueLineLength, kPointValueLabelWidth, kPointValuelabelPadding, kPointValuelabelHeight
} from '../numberline-tile-constants';
import NumberlineArrowLeft from "../../../assets/numberline-arrow-left.svg";
import NumberlineArrowRight from "../../../assets/numberline-arrow-right.svg";
import { EditableNumberlineMinOrMax } from './editable-numberline-min-or-max';
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { INumberlineToolbarContext, NumberlineToolbarContext } from './numberline-toolbar-context';
import "./numberline-toolbar-registration";

import "./numberline-tile.scss";

export enum CreatePointType {
  Selection = "selection",
  Filled = "filled",
  Open = "open"
}

//**********************✔️•↳******************* GUIDELINES ************************************************

//•points are given a descender line and a label with their numerical value to two dec places
//•as the user slides the point around, the value updates
//•when no point is selected, the last label is on top
//•when a point is selected, it's label is on top
//•when points are deleted the indicator disappears
//•indicators save, synchronize, and are authorable


export const NumberlineTile: React.FC<ITileProps> = observer(function NumberlineTile(props){
  const { model, readOnly, tileElt, onRegisterTileApi } = props;



  const content = model.content as NumberlineContentModelType;
  const [hoverPointId, setHoverPointId] = useState("");
  const [_selectedPointId, setSelectedPointId] = useState(""); // Just used to rerender when a point is selected
  const ui = useUIStore();
  const isTileSelected = ui.isSelectedTile(model);

  /* ========================== [ Determine Point is Open or Filled ]  ========================= */

  const toolbarOptionRef = useRef<CreatePointType>(CreatePointType.Selection); //"selection"

  const handleCreatePointType = (pointType: CreatePointType) => {
    toolbarOptionRef.current = pointType;
  };

  /* ============================ [ Model Manipulation Functions ]  ============================ */
  const createPoint = (xValue: number, _pointTypeIsOpen: boolean) => {
    if (!readOnly) {
      const point = content.createAndSelectPoint(xValue, _pointTypeIsOpen);
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

  const deleteSelectedPoints = useCallback(() => {
    content.deleteSelectedPoints();
  }, [content]);

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

  /* ============================ [ Calculate Width of Tile / Scale ]  ========================= */
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

  /* ============================ [ Register Tile API Functions ]  ============================= */
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

  /* ============================ [ SVG Ref to Numberline & SVG ]  ============================= */
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

  const handleMouseClick = (e: Event, _toolbarOption: CreatePointType) => {
    if (!readOnly){
      if (hoverPointId) {
        const hoverPoint = content.getPoint(hoverPointId);
        if (hoverPoint) {
          content.setSelectedPoint(hoverPoint);
          setSelectedPointId(hoverPoint.id);
        }
      } else {
        // Create point if we are not hovering over a point and within bounding box
        // and toolbarOption is either filled or open
        const [mouseX, mouseY] = mousePos(e);
        if (mouseInBoundingBox(mouseX, mouseY)) {
          if(_toolbarOption !== CreatePointType.Selection){
            const isPointOpen = _toolbarOption === CreatePointType.Open;
            createPoint(xScale.invert(mouseX), isPointOpen);
          }
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
    // When in selection mode - do not draw any hover circle
    if (toolbarOptionRef.current === CreatePointType.Selection) {
      clearMouseFollowPoint();
      return;
    }
    // For either open or filled mode, draw outer circle
    svg.append("circle")
      .attr("cx", mouseX)
      .attr("cy", yMidPoint)
      .attr("r", innerPointRadius)
      .classed("mouse-follow-point", true)
      .classed("point-inner-circle", true);

    //For open mode - draw inner white circle
    if (toolbarOptionRef.current === CreatePointType.Open) {
      svg.append("circle")
        .attr("fill", "white")
        .attr("cx", mouseX)
        .attr("cy", yMidPoint)
        .attr("r", innerPointRadius * 0.5)
        .attr("opacity", 1)
        .classed("mouse-follow-point", true);
    }
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

  svg.on("click", (e) => handleMouseClick(e, toolbarOptionRef.current));
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

  if (axisWidth !== 0){
    const handleDrag = drag<SVGCircleElement, PointObjectModelType>()
      .on('drag', (e, p) => {
        const [mouseX, mouseY] = mousePos(e);
        if (!readOnly && mouseInBoundingBox(mouseX, mouseY)) {
          const hoverPoint = content.getPoint(hoverPointId);
          if (hoverPoint) content.setSelectedPoint(hoverPoint);
          const newXValue = xScale.invert(mouseX);
          p.setDragXValue(newXValue);
          //Update vertical line + value label
          svg.selectAll(".point-line")
          .filter((d: any): d is PointObjectModelType => d.id === p.id)
          .attr("x1", xScale(newXValue))
          .attr('x2', xScale(newXValue));
        }
      })
      .on("end", (e, p) => {
        if (!readOnly) {
          p.setXValueToDragValue();
        }
      });

    /* ========================== [ Construct/Update Circles ] =================================== */

    const updateCircles = () => {
      /* =========================== [ Outer Hover Circles ] ======================= */
      //---- Initialize outer hover circles
      const outerPoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.outer-point')
        .data(content.pointsArr);

      outerPoints.enter()
        .append("circle").attr("class", "outer-point")
        .attr('cx', (p) => {
          return xScale(p.currentXValue);
        }) //mapped to axis width
        .attr('cy', yMidPoint).attr('r', outerPointRadius).attr('id', p => p.id)
        .classed("point-outer-circle", true)
        .call((e) => handleDrag(e)); // Attach drag behavior to newly created circles

      // --- Update functions outer hover circles
      outerPoints
        .attr('cx', (p) => xScale(p.currentXValue)) //mapped to axis width
        .classed("hovered", (p, idx) => (hoverPointId === p.id))
        .call((e) => handleDrag(e)); // pass again in case axisWidth changes

      outerPoints.exit().remove(); //cleanup

      //TODO: Revise inner circles back to original
      // create an innerPointsOpen that is white and append it to svg

      /* =========================== [ Inner Circles ] ============================= */
      const innerPoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.inner-point')
        .data(content.pointsArr);

      // Initialize Attributes
      innerPoints.enter()
        .append("circle")
        .attr("class", "inner-point")
        .attr('cx', (p) => {
          console.log("----------------");
          console.log("p where currXVal:", p.currentXValue);
          console.log("p where val:", p.xValue);

          return xScale(p.currentXValue);
        }) //mapped to axis width
        .attr('cy', yMidPoint)
        .attr('r', innerPointRadius)
        .attr('id', p => p.id)
        .classed("point-inner-circle", true) //may change
        .call((e) => handleDrag(e)); // Attach drag behavior to newly created circles

      // --- Update functions inner circles
      innerPoints
      .attr('cx', (p, idx) => xScale(p.currentXValue))
      .classed("selected", (p)=> p.id in content.selectedPoints)
      .call((e) => handleDrag(e)); // pass again in case axisWidth changes

      innerPoints.exit().remove();


      /* =========================== [ Blue White Circles] ===================================== */

      const openPoints = content.pointsArr.filter(p => p.isOpen); // Look for open points for inner white circle
      const innerWhitePoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.inner-white-point')
      .data(openPoints);

      innerWhitePoints.enter()
        .append("circle")
          .attr("class", "inner-white-point")
          .attr("cx", (p) => xScale(p.currentXValue))
          .attr("cy", yMidPoint)
          .attr("r", innerPointRadius * 0.5)
          .attr("fill", "white")
          .attr('id', (p) => `inner-white-${p.id}`);

      // Update circle positions
      innerWhitePoints
      .attr("cx", (p) => xScale(p.currentXValue))
      .attr("cy", yMidPoint);

      innerWhitePoints.exit().remove();

      /* ======================== [ Vertical Line + Point Values] ============================== */

      // ----- Draw vertical lines under each point
      const pointLines = svg.selectAll('.point-line')
      .data(content.pointsArr);

      pointLines.enter()
      .append("line")
      .attr("class", "point-line")
      .attr("x1", p => xScale(p.currentXValue))
      .attr("y1", yMidPoint + outerPointRadius - 5)  // y start just below the point
      .attr("x2", p => xScale(p.currentXValue))  // x position is same as point"s x
      .attr("y2", yMidPoint + outerPointRadius + kPointValueLineLength) // y end is lineLength below the start
      .style("stroke", "#949494") // Set the color of the line
      .style("stroke-width", 2); // Set the width of the line

      //Update line positions
      pointLines
      .attr("x1", (p) => xScale(p.currentXValue))
      .attr("x2", (p) => xScale(p.currentXValue));

      pointLines.exit().remove();

      // ----- Draw point labels under vertical lines
      const pointLabels = svg.selectAll(".point-label")
      .data(content.pointsArr);

      // Enter selection for the label groups
      const pointLabelEnter = pointLabels.enter().append("g")
      .attr("class", "point-label")
      .attr("transform", d => `translate(${xScale(d.currentXValue)},
      ${yMidPoint + outerPointRadius + kPointValueLineLength})`);


      // Append rect for each label as an oval background
      pointLabelEnter.append("rect")
      .attr("x", -kPointValueLabelWidth / 2) // Center the rect around the point
      .attr("y", kPointValuelabelPadding)
      .attr("rx", kPointValuelabelHeight / 2) // rx and ry give the rect rounded corners, creating an oval effect
      .attr("ry", kPointValuelabelHeight / 2)
      .attr("width", kPointValueLabelWidth)
      .attr("height", kPointValuelabelHeight)
      .attr("fill", "#949494"); // Set the fill or style as needed

      // Append text for each label
      pointLabelEnter.append("text")
      .attr("x", 0) // Center the text on the point
      .attr("y", kPointValuelabelHeight / 2 + kPointValuelabelPadding * 1.5) // Vertically center the text in the rect
      .attr("text-anchor", "middle") // Ensure the text is centered
      .attr("alignment-baseline", "middle") // Ensure the text is vertically centered
      .text(d => d.currentXValue); // Set the text to be the point"s value

      // Update selection for the label groups
      pointLabels.select("rect")
      .attr("x", d => xScale(d.currentXValue) - kPointValueLabelWidth / 2)
      .attr("y", d => yMidPoint + outerPointRadius + kPointValueLineLength + kPointValuelabelPadding);

      pointLabels.select("text")
      .attr("x", d => xScale(d.currentXValue))
      .attr("y", d => {
        return (
       yMidPoint + outerPointRadius + kPointValueLineLength + kPointValuelabelHeight / 2 + kPointValuelabelPadding * 1.5
        );
      })
      .text(d => d.currentXValue);

      // Exit selection for the label groups
      pointLabels.exit().remove();






    }; //end of updateCircles()

    updateCircles();
  }



  // * ================================= [ Register Toolbar ] ================================== */

  const toolbarFunctions: INumberlineToolbarContext = {
    handleResetPoints: () => content.deleteAllPoints(),
    handleDeletePoint: deleteSelectedPoints,
    handleCreatePointType,
    toolbarOption: toolbarOptionRef.current
  };

  return (
    <div
      className={classNames("numberline-wrapper", { "read-only": readOnly })}
      onKeyDown={(e) => hotKeys.current.dispatch(e)}
      tabIndex={0}
    >
      <div className={"numberline-title"}>
        <BasicEditableTileTitle />
      </div>
      <NumberlineToolbarContext.Provider value={toolbarFunctions}>
        <TileToolbar
          tileType="numberline"
          tileElement={tileElt}
          readOnly={!!readOnly}
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
            <EditableNumberlineMinOrMax
              value={content.min}
              minOrMax={"min"}
              offset={arrowOffset}
              readOnly={readOnly}
              isTileSelected={isTileSelected}
              onValueChange={(newValue) => handleMinMaxChange("min", newValue)}
            />
            <EditableNumberlineMinOrMax
              value= {content.max}
              minOrMax={"max"}
              offset={arrowOffset}
              readOnly={readOnly}
              isTileSelected={isTileSelected}
              onValueChange={(newValue) => handleMinMaxChange("max", newValue)}
            />
          </div>
        </div>
      </NumberlineToolbarContext.Provider>
    </div>
  );
});

export default NumberlineTile;
