import React, { useRef, useEffect, useState } from 'react';
import { select, scaleLinear, axisBottom, drag, pointer } from 'd3';
import { observer } from 'mobx-react';
import { ITileProps } from "../../components/tiles/tile-component";
import { NumberlineContentModelType, PointObjectModelType,  } from "./models/numberline-content";
import { kAxisStyle, kAxisWidth, kContainerWidth, kNumberLineContainerHeight,
         numberlineDomainMax, numberlineDomainMin, tickHeightDefault,
         tickHeightZero, tickStyleDefault, tickStyleZero, tickWidthDefault,
         tickWidthZero, innerPointRadius, outerPointRadius } from './numberline-tile-constants';

import "./numberline-tile.scss";

export const NumberlineToolComponent: React.FC<ITileProps> = observer((props) => {
  const { model, readOnly } = props;
  const content = model.content as NumberlineContentModelType;

  //---------------- Create Unique ClassName For Axis -----------------------------------------------
  const readOnlyState = (readOnly) ? "readOnly" : "readWrite";
  const tileId = model.id;
  const axisClass = `axis-${tileId}-${readOnlyState}`;

  //---------------- Calculate Width Of Tile / Scale ------------------------------------------------
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [tileWidth, setTileWidth] = useState(0);
  const containerWidth = (tileWidth * kContainerWidth);
  const axisWidth = (tileWidth * kAxisWidth);
  const xShiftNum = ((containerWidth - axisWidth)/2);
  const numToPx = (num: number) => num.toFixed(2) + "px";
  const yMidPoint = (kNumberLineContainerHeight / 2);
  const xScale = scaleLinear()
  .domain([numberlineDomainMin, numberlineDomainMax])
  .range([0, axisWidth]); // Adjusted range based on svg width


  useEffect(() => {
    let obs: ResizeObserver;
    if (documentScrollerRef.current) {
      obs = new ResizeObserver(() => {
        setTileWidth(documentScrollerRef.current?.clientWidth ?? 0);
      });
      obs.observe(documentScrollerRef.current);
    }
    return () => obs?.disconnect();
  }, []);

  //--------------------  SVG Ref / Properties ------------------------------------------
  const svgRef = useRef<SVGSVGElement | any>(null);
  const svg = select(svgRef.current);
  const svgNode = svg.node();
  const axisRef = useRef<SVGGElement | any>(null);
  const axis = select(axisRef.current);


  //-------------------- Mouse State ----------------------------------------------------
  const [mouseIsDragging, setMouseIsDragging] = useState(false); //only within numberline
  const [mousePosX, setMousePosX] = useState(0); //used to retrigger useEffect


  /* ============================= [ Handlers/Utility Functions ]  =============================== */

  const mouseInBoundingBox = (e: Event) => {
    const pos = pointer(e, svgNode);
    const xPos = pos[0];
    const yPos = pos[1];
    const yTopBound = yMidPoint + 15;
    const yBottomBound = yMidPoint - 15;
    const isBetweenYBounds = (yPos >= yBottomBound && yPos <= yTopBound);
    const isBetweenXBounds = (xPos >= 0 && xPos <= axisWidth);
    if (isBetweenYBounds && isBetweenXBounds ){
      content.isMouseHoverOverPoint(xPos, axisWidth); //detect if hovered over an existing point
      setMousePosX(xPos);
      return true;
    } else {
      return false;
    }
  };

  const handleClickCreatePoint = (e: Event) => {
    const pos = pointer(e, svgNode);
    const xPos = pos[0];
    const xValue = xScale.invert(xPos);
    const newPoint = {xValue};
    content.createNewPoint(newPoint);
  };

  const handleMouseClick = (e: Event) => {
    if (!content.isHoveringOverPoint){
      if (mouseInBoundingBox(e)){

        handleClickCreatePoint(e); //only create point if we are not hovering over a point and within bounding box
      }
    } else{
      content.toggleIsSelected(content.indexOfPointHovered);
    }
  };

  const givenIDFindIndexPoint = (id: string)=> {
    return content.axisPoints.findIndex((p)=> p.id === id);
  };

  const handleDrag = drag<SVGCircleElement, PointObjectModelType>()
  .on('drag', (e, p) => {
      if (mouseInBoundingBox(e)){
        setMouseIsDragging(true);
        const idxPointDragged = givenIDFindIndexPoint(p.id);
        content.toggleIsSelected(idxPointDragged);//make the dragged point as the only one selected.
        const oldAxisWidth = axisWidth;
        const newAxisWidth = svgNode.getBoundingClientRect().width;
        const isAxisResized = !!(Math.abs(oldAxisWidth - newAxisWidth) > 2);
        const xMousePos = pointer(e, svgNode)[0];
        let newScale;
        if (isAxisResized){
          newScale = scaleLinear()
          .domain([numberlineDomainMin, numberlineDomainMax])
          .range([0, newAxisWidth]);
        } else {
          newScale = xScale;
        }
        const xValue = newScale.invert(xMousePos);
        const newPointCoordinates = {xValue};
        content.isDraggingUseIdReplacePointCoordinates(p, newPointCoordinates); //p is the old point
      }
  })
  .on("end", () => setMouseIsDragging(false));


  const handleMouseMove = (e: Event) => {
    const radius = (mouseInBoundingBox(e) && !content.isHoveringOverPoint) ? innerPointRadius : 0;
    drawMousePoint(e, radius);
    if (!mouseInBoundingBox(e)){
      content.setAllHoversFalse();
    }
  };

  const drawMousePoint = (e: Event, r: number) => {
    const pos = pointer(e, svgNode);
    const xPos = pos[0];
    svg.selectAll(".mouseXCircle").remove();
    svg.append('circle') //create a temp hover circle that follows the mouse
    .attr('cx', xPos)
    .attr('cy', yMidPoint)
    .attr('r', r)
    .classed("mouseXCircle", true)
    .classed("defaultPointInnerCircle", true);
  };

  svg.on("click", handleMouseClick);
  svg.on("mousemove", handleMouseMove);

  // * ============================ [ useEffect - construct Numberline ] ========================= */
  useEffect(() => {
    if (axisWidth !== 0) {
      const numOfTicks = numberlineDomainMax - numberlineDomainMin;
      axis
      .attr("class", `${axisClass} num-line`)
      .attr("style", `${kAxisStyle}`) //move down
      .call(axisBottom(xScale).tickSizeOuter(0).ticks(numOfTicks)) //remove side ticks
      .selectAll("g.tick line") //customize 0 ticks
      .attr("y2", function(x){ return (x === 0) ? tickHeightZero : tickHeightDefault;})
      .attr("stroke-width", function(x){ return (x === 0) ? tickWidthZero : tickWidthDefault;})
      .attr("style", function(x){ return (x === 0) ? tickStyleZero : tickStyleDefault;});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisWidth]);

  /* =========================== [ useEffect Numberline ] ======================================== */
  useEffect(() => {
    if (axisWidth !== 0){
      const updateNumberline = () => {

        /* =========================== [ Outer Hover Circles ] ======================= */
        //---- Initialize outer hover circles
        const outerPoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.outer-point')
        .data(content.axisPoints, p => p.id);

        outerPoints.enter()
        .append("circle").attr("class", "outer-point")
        .attr('cx', (p) => {
          const xValue = p.pointCoordinates?.xValue;
          return xScale(xValue || numberlineDomainMin); //mapped to axis width
        }).attr('cy', yMidPoint).attr('r', outerPointRadius).attr('id', p => p.id)
        .classed("showPointOuterCircle", true)
        .classed("disabled", (p, idx) => !(idx === content.indexOfPointHovered));


        // --- Update functions outer hover circles
        outerPoints
        .attr('cx', (p) => {
          const xValue = p.pointCoordinates?.xValue;
          return xScale(xValue || numberlineDomainMin); //mapped to axis width
        })
        .classed("disabled", (p, idx) => {
          if (!mouseInBoundingBox) {
            return true; // Disable all points when mouse is outside bounding box
          }
          if (p.isHovered || (idx === content.indexOfPointHovered && mouseIsDragging)) {
            return false; // Show blue outer circle when hovering or dragging the hovered point
          }
          return true; // Otherwise, disable the point
        });

        outerPoints.exit().remove(); //cleanup

        /* =========================== [ Inner Circles ] ============================= */
        //---- Initialize inner hover circles
        const innerPoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.inner-point')
        .data(content.axisPoints, p => p.id);

        // Initialize Attributes
        innerPoints.enter()
        .append("circle")
        .attr("class", "inner-point")
        .attr('cx', (p) => {
          const xValue = p.pointCoordinates?.xValue;
          return xScale(xValue || numberlineDomainMin); //mapped to axis width
        })
        .attr('cy', yMidPoint).attr('r', innerPointRadius).attr('id', p => p.id)
        .classed("defaultPointInnerCircle", true).classed("selected", (p)=>!!p.isSelected)
        .call(handleDrag as any ); // Attach drag behavior to newly created circles

        // --- Update functions inner circles
        innerPoints
        .attr('cx', (p) => {
          const xValue = p.pointCoordinates?.xValue;
          return xScale(xValue || numberlineDomainMin);
        })
        .classed("selected", (p)=>!!p.isSelected);

        innerPoints.exit().remove(); //cleanup

      }; //end updateNumberline()

      updateNumberline();

      // Attach the updateNumberline function to the window resize event
      window.addEventListener('resize', ()=>{
        updateNumberline();
      });

      // Cleanup event listener on component unmount
      return () => {
        window.removeEventListener('resize', updateNumberline);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisWidth, mousePosX, content.pointsIsHoveredArr]);

  return (
    <div
      className="numberline-tool"
      ref={documentScrollerRef}
      data-testid="numberline-tool"
      style={{"height": `${kNumberLineContainerHeight}`}}
    >
      <div className="numberline-tool-container" >
          <svg ref={svgRef} width={axisWidth}>
            {/* <g className={`${axisClass}`}></g> */}
            <g ref={axisRef}></g>
          </svg>
          <i className="arrow left" style={{'left': numToPx(xShiftNum - 3), 'top': '53px'}}/>
          <i className="arrow right" style={{'right': numToPx(xShiftNum - 3), 'top': '53px'}}/>
      </div>
    </div>
  );
});

export default NumberlineToolComponent;
