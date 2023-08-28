import React, { useRef, useEffect, useState } from 'react';
import { select, axisBottom, drag, pointer } from 'd3';
import { observer } from 'mobx-react';
import { ITileProps } from "../../components/tiles/tile-component";
import { NumberlineContentModelType, PointObjectModelType,  } from "./models/numberline-content";
import { kAxisStyle, kAxisWidth, kContainerWidth, kNumberLineContainerHeight,
         numberlineDomainMax, numberlineDomainMin, tickHeightDefault,
         tickHeightZero, tickStyleDefault, tickStyleZero, tickWidthDefault,
         tickWidthZero, innerPointRadius, outerPointRadius, numberlineYBound,
         yMidPoint, createXScale} from './numberline-tile-constants';

import "./numberline-tile.scss";

export const NumberlineTile: React.FC<ITileProps> = observer(function NumberlineTile(props){
  const { model, readOnly, context } = props;
  const content = model.content as NumberlineContentModelType;
  const readOnlyState = (readOnly) ? "readOnly" : "readWrite";
  const tileId = model.id;
  const axisClass = `axis-${tileId}-${readOnlyState}`;

  //---------------- Calculate Width Of Tile / Scale ----------------------------------------------
  const documentScrollerRef = useRef<HTMLDivElement>(null);

  const [tileWidth, setTileWidth] = useState(0);
  const containerWidth = (tileWidth * kContainerWidth);
  const isFourUpView = context.includes("four-up");
  const fourUpScalar = isFourUpView ? 0.5 : 1;

  const axisWidth = tileWidth * kAxisWidth;
  const xShiftNum = ((containerWidth - axisWidth)/2);
  const numToPx = (num: number) => num.toFixed(2) + "px";
  const xScale = createXScale(axisWidth);
  // console.log("axisClass:", axisClass);


  useEffect(() => {
    let obs: ResizeObserver;
    if (documentScrollerRef.current) {
      obs = new ResizeObserver(() => {
        if (documentScrollerRef.current?.clientWidth){
          console.log("------------in the observer-----");
          console.log("\tfourUpScalar : ", fourUpScalar);
          const newTileWidth  = documentScrollerRef.current?.clientWidth * fourUpScalar;
          setTileWidth(newTileWidth ?? 0);
        }
      });
      obs.observe(documentScrollerRef.current);
    }
    return () => obs?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //-------------------  SVG Ref to Numberline & SVG / Mouse State --------------------------------
  const svgRef = useRef<SVGSVGElement | any>(null);
  const svg = select(svgRef.current);
  const svgNode = svg.node();
  const axisRef = useRef<SVGGElement | any>(null);
  const axis = select(axisRef.current);
  const isMouseOverPoint = !!content.hoveredPoint;

  /* ============================ [ Handlers / Mouse Functions ]  ============================== */
  svg.on("click", (e) => handleMouseClick(e));
  svg.on("mousemove", (e) => handleMouseMove(e));
  const mousePosX = (e: Event) => pointer(e, svgNode)[0];
  const mousePosY = (e: Event) => pointer(e, svgNode)[1];

  const handleMouseClick = (e: Event) => {
    if (!readOnly){
      if (isMouseOverPoint){
        const pointHoveredOver = content.givenIdReturnPoint(content.hoveredPoint);
        content.setSelectedPoint(pointHoveredOver);
      } else{
        //only create point if we are not hovering over a point and within bounding box
        mouseInBoundingBox(mousePosX(e), mousePosY(e)) && handleClickCreatePoint(e);
      }
    }
  };

  const handleMouseMove = (e: Event) => {
    if (!readOnly){
      const isMouseInBoundingBox = mouseInBoundingBox(mousePosX(e), mousePosY(e));
      const radius = (isMouseInBoundingBox && !isMouseOverPoint) ? innerPointRadius : 0;
      isMouseInBoundingBox && content.analyzeXYPosDetermineHoverPoint(mousePosX(e), mousePosY(e), axisWidth);
      //mouse follow point disappears when hover over existing point, r set to 0
      drawMouseFollowPoint(e, radius);
    }
  };

  const mouseInBoundingBox = (mouseXPos: number,  mouseYPos: number) => {
    const yTopBound = yMidPoint + numberlineYBound;
    const yBottomBound = yMidPoint - numberlineYBound;
    const isBetweenYBounds = (mouseYPos >= yBottomBound && mouseYPos <= yTopBound);
    // console.log("mouseInBoundingBox: axisWidth set to:", axisWidth);
    const isBetweenXBounds = (mouseXPos >= 0 && mouseXPos <= axisWidth);
    if (isBetweenYBounds && isBetweenXBounds){
      // console.log("mouse in bounding BOX!");
      return true;
    } else {
      // console.log("mouse outta bounds");

      return false;
    }
  };

  const handleClickCreatePoint = (e: Event) => {
    if (!readOnly){
      const xValueClicked = xScale.invert(mousePosX(e));
      content.createNewPoint(xValueClicked);
    }
  };

  const handleDrag = drag<SVGCircleElement, PointObjectModelType>()
  .on('drag', (e, p) => {
      if (!readOnly && mouseInBoundingBox(mousePosX(e), mousePosY(e))){
        const pointHoveredOver = content.givenIdReturnPoint(content.hoveredPoint);
        content.setSelectedPoint(pointHoveredOver);
        const newXValue = xScale.invert(mousePosX(e));
        content.replaceXValueWhileDragging(p.id, newXValue);
      }
  })
  .on("end", (e, p) => {
    if (!readOnly){
      p.setXValueToDragValue();
    }
  });

  const drawMouseFollowPoint = (e: Event, r: number) => {
    const pos = pointer(e, svgNode);
    const xPos = pos[0];
    svg.selectAll(".mouseXCircle").remove();
    svg.append('circle') //create a circle that follows the mouse
    .attr('cx', xPos)
    .attr('cy', yMidPoint)
    .attr('r', r)
    .classed("mouseXCircle", true)
    .classed("defaultPointInnerCircle", true);
  };

  // * =============================== [ Construct Numberline ] ================================ */
  if (axisWidth !== 0) {
    console.log("<---------constructing numberline ------------> ");
    console.log("\t with axisWidth: ", axisWidth);
    console.log("\txScale: ", xScale);
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

  /* ========================== [ Construct/Update Circles ] =================================== */
  if (axisWidth !== 0){
    const updateCircles = () => {
      console.log("<---------updateCircles ------------> ");

      /* =========================== [ Outer Hover Circles ] ======================= */
      //---- Initialize outer hover circles
      const outerPoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.outer-point')
      .data(content.axisPointsSnapshot);

      outerPoints.enter()
      .append("circle").attr("class", "outer-point")
      .attr('cx', (p) => xScale(p.xValue || numberlineDomainMin)) //mapped to axis width
      .attr('cy', yMidPoint).attr('r', outerPointRadius).attr('id', p => p.id)
      .classed("showPointOuterCircle", true)
      .classed("disabled", true);

      // --- Update functions outer hover circles
      outerPoints
      .attr('cx', (p) => xScale(p.currentXValue || numberlineDomainMin)) //mapped to axis width
      .classed("disabled", (p, idx) => (content.hoveredPoint !== p.id));

      outerPoints.exit().remove(); //cleanup

      /* =========================== [ Inner Circles ] ============================= */
      //---- Initialize inner hover circles
      const innerPoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.inner-point')
      .data(content.axisPointsSnapshot);

      // Initialize Attributes
      innerPoints.enter()
      .append("circle")
      .attr("class", "inner-point")
      .attr('cx', (p) => xScale(p.xValue || numberlineDomainMin)) //mapped to axis width
      .attr('cy', yMidPoint).attr('r', innerPointRadius).attr('id', p => p.id)
      .classed("defaultPointInnerCircle", true)
      .classed("selected", (p)=> false)
      .call((e) => handleDrag(e)); // Attach drag behavior to newly created circles

      // --- Update functions inner circles
      innerPoints
      .attr('cx', (p, idx) => xScale(p.currentXValue || numberlineDomainMin))
      .classed("selected", (p)=> p.id in content.selectedPoints)
      .call((e) => handleDrag(e)); // pass again in case axisWidth changes


      innerPoints.exit().remove(); //cleanup
    };
    updateCircles();
  }

  return (
    <div
      className="numberline-tool"
      ref={documentScrollerRef}
      data-testid="numberline-tool"
      style={{"height": `${kNumberLineContainerHeight}`}}
    >
      <div className="numberline-tool-container" >
        {console.log("----------render function---------")}

        {console.log("\trender function > JSX our axisWidth is: ", axisWidth)}
        <svg ref={svgRef} width={axisWidth}>
          <g ref={axisRef}></g>
        </svg>
        <i className="arrow left" style={{'left': numToPx(xShiftNum - 3), 'top': '53px'}}/>
        <i className="arrow right" style={{'right': numToPx(xShiftNum - 3), 'top': '53px'}}/>
      </div>
    </div>
  );
});

export default NumberlineTile;
