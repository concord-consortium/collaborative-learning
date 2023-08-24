import React, { useRef, useEffect, useState } from 'react';
import { select, scaleLinear, axisBottom, drag, pointer } from 'd3';
import { observer } from 'mobx-react';
import { ITileProps } from "../../components/tiles/tile-component";
import { NumberlineContentModelType, PointObjectModelType,  } from "./models/numberline-content";
import { kAxisStyle, kAxisWidth, kContainerWidth, kNumberLineContainerHeight,
         numberlineDomainMax, numberlineDomainMin, tickHeightDefault,
         tickHeightZero, tickStyleDefault, tickStyleZero, tickWidthDefault,
         tickWidthZero, innerPointRadius, outerPointRadius, numberlineYBound,
         yMidPoint, createXScale} from './numberline-tile-constants';

import "./numberline-tile.scss";

export const NumberlineTile: React.FC<ITileProps> = observer((props) => {
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

  //--------------------  SVG Ref to Numberline & SVG / Mouse State ---------------------------------
  const svgRef = useRef<SVGSVGElement | any>(null);
  const svg = select(svgRef.current);
  const svgNode = svg.node();
  const axisRef = useRef<SVGGElement | any>(null);
  const axis = select(axisRef.current);
  const isMouseOverPoint = !!content.hoveredPoint;
  const [mousePosXTrigger, setMousePosXTrigger] = useState(0); //used to retrigger useEffect
  const [mousePosYTrigger, setMousePosYTrigger] = useState(0);
  const [manualTriggerUseEffect, setManualTriggerUseEffect] = useState(false);

  /* ============================= [ Handlers/Utility Functions ]  =============================== */

  const mousePosX = (e: Event) => pointer(e, svgNode)[0];
  const mousePosY = (e: Event) => pointer(e, svgNode)[1];

  const mouseInBoundingBox = (mouseXPos: number,  mouseYPos: number) => {
    const yTopBound = yMidPoint + numberlineYBound;
    const yBottomBound = yMidPoint - numberlineYBound;
    const isBetweenYBounds = (mouseYPos >= yBottomBound && mouseYPos <= yTopBound);
    const isBetweenXBounds = (mouseXPos >= 0 && mouseXPos <= axisWidth);
    if (isBetweenYBounds && isBetweenXBounds){
      setMousePosXTrigger(mouseXPos); // any changes to mousePosXTrigger & mmousePosYTrigger
      setMousePosYTrigger(mouseYPos); // trigger the useEffect to update the circles
      return true;
    } else {
      return false;
    }
  };

  const handleMouseClick = (e: Event) => {
    if (isMouseOverPoint){
      const pointHoveredOver = content.givenIdReturnPoint(content.hoveredPoint);
      content.setSelectedPoint(pointHoveredOver);
      setManualTriggerUseEffect((prevState) => !prevState);
    } else{
      //only create point if we are not hovering over a point and within bounding box
      mouseInBoundingBox(mousePosX(e), mousePosY(e)) && handleClickCreatePoint(e);
    }
  };

  const handleClickCreatePoint = (e: Event) => {
    const xValueClicked = xScale.invert(mousePosX(e));
    content.createNewPoint(xValueClicked);
  };

  const handleDrag = drag<SVGCircleElement, PointObjectModelType>()
  .on('drag', (e, p) => {
    if (mouseInBoundingBox(mousePosX(e), mousePosY(e))){
      const pointHoveredOver = content.givenIdReturnPoint(content.hoveredPoint);
      content.setSelectedPoint(pointHoveredOver);
      //need to account for if we change axisWidth then immediately drag
      const oldAxisWidth = axisWidth;
      const newAxisWidth = svgNode.getBoundingClientRect().width;
      const isAxisResized = (Math.abs(oldAxisWidth - newAxisWidth) > 2);
      const newScale = (isAxisResized) ? createXScale(newAxisWidth) : xScale;
      const newXValue = newScale.invert(mousePosX(e));
      content.replaceXValueWhileDragging(p.id, newXValue);
    }
  })
  .on("end", (e, p) => p.setXValueToDragValue());

  const handleMouseMove = (e: Event) => {
    const isMouseInBoundingBox = mouseInBoundingBox(mousePosX(e), mousePosY(e));
    const radius = (isMouseInBoundingBox && !isMouseOverPoint) ? innerPointRadius : 0;
    isMouseInBoundingBox && content.analyzeXYPosDetermineHoverPoint(mousePosX(e), mousePosY(e), axisWidth);
    //mouse follow point disappears when hover over existing point, r set to 0
    drawMouseFollowPoint(e, radius);
  };

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

  svg.on("click", (e) => !readOnly && handleMouseClick(e));
  svg.on("mousemove", (e) => !readOnly && handleMouseMove(e));

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

  /* ======================= [ useEffect Construct/Update Circles ] ============================== */
  useEffect(() => {
    if (axisWidth !== 0){
      const updateCircles = () => {
        /* =========================== [ Outer Hover Circles ] ======================= */
        //---- Initialize outer hover circles
        const outerPoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.outer-point')
        .data(content.axisPointsSnapshot, p => p.id);

        outerPoints.enter()
        .append("circle").attr("class", "outer-point")
        .attr('cx', (p) => xScale(p.xValue || numberlineDomainMin)) //mapped to axis width
        .attr('cy', yMidPoint).attr('r', outerPointRadius).attr('id', p => p.id)
        .classed("showPointOuterCircle", true)
        .classed("disabled", true);

        // --- Update functions outer hover circles
        outerPoints
        .attr('cx', (p) => {
          const xValue = p.currentXValue;
          return xScale(xValue || numberlineDomainMin); //mapped to axis width
        })
        .classed("disabled", (p, idx) => {
          return (content.hoveredPoint !== p.id);
        });

        outerPoints.exit().remove(); //cleanup

        /* =========================== [ Inner Circles ] ============================= */
        //---- Initialize inner hover circles
        const innerPoints = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.inner-point')
        .data(content.axisPointsSnapshot);

        // .data(content.axisPointsSnapshot, p => {
        //   return p.id;
        // });

        // Initialize Attributes
        innerPoints.enter()
        .append("circle")
        .attr("class", "inner-point")
        .attr('cx', (p) => xScale(p.xValue || numberlineDomainMin)) //mapped to axis width
        .attr('cy', yMidPoint).attr('r', innerPointRadius).attr('id', p => p.id)
        .classed("defaultPointInnerCircle", true)
        .classed("selected", (p)=> false)
        .call(handleDrag as any ); // Attach drag behavior to newly created circles

        // --- Update functions inner circles
        innerPoints
        .attr('cx', (p, idx) => {
          const xValue = p.currentXValue;
          return xScale(xValue || numberlineDomainMin);
        })
        .classed("selected", (p)=> p.id in content.selectedPoints);

        innerPoints.exit().remove(); //cleanup

      }; //end updateCircles()

      updateCircles();

      // Attach the updateCircles function to the window resize event
      window.addEventListener('resize', ()=>{
        updateCircles();
      });

      // Cleanup event listener on component unmount
      return () => {
        window.removeEventListener('resize', updateCircles);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisWidth, mousePosXTrigger, mousePosYTrigger,
      content.hasPoints,
      manualTriggerUseEffect, //accounts for case when you have change selected point - re-renders to show outer circle
      content.pointsArr //accounts for selecting point and deleting it - triggers a re-render
  ]);

  return (
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
          <i className="arrow left" style={{'left': numToPx(xShiftNum - 3), 'top': '53px'}}/>
          <i className="arrow right" style={{'right': numToPx(xShiftNum - 3), 'top': '53px'}}/>
      </div>
    </div>
  );
});

export default NumberlineTile;
