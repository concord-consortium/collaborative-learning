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

  //---------------- Create Unique ClassName For Axis ------------------------------------------------
  const readOnlyState = (readOnly) ? "readOnly" : "readWrite";
  const tileId = model.id;
  const axisClass = `axis-${tileId}-${readOnlyState}`;

  //---------------- Calculate Width Of Tile / Scale ------------------------------------------------
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [tileWidth, setTileWidth] = useState(0);
  const containerWidth = (tileWidth * kContainerWidth);
  const axisWidth = (tileWidth * kAxisWidth); //used to set the svg
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

  //------------------ Mouse Point Circle State / Properties ----------------------------------------
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverPointX, setHoverPointX] = useState(0); //used to retrigger useEffect below
  const svg = select(svgRef.current);
  const svgNode = svg.node();
  const yMidPoint = (kNumberLineContainerHeight / 2);
  /* ========================== [ Construct Numberline OnMount ] ================================= */

  const mouseInBoundingBox = (e: Event) => {
    const pos = pointer(e, svgNode);
    const xPos = pos[0];
    const yPos = pos[1];

    const yTopBound = yMidPoint + 10;
    const yBottomBound = yMidPoint - 10;
    const isBetweenYBounds = (yPos >= yBottomBound && yPos <= yTopBound);
    const isBetweenXBounds = (xPos >= 0 && xPos <= axisWidth);
    if (isBetweenYBounds && isBetweenXBounds ){
      content.mouseHoverOverPoint(xPos, axisWidth); //detect if hovered over an existing point
      setHoverPointX(xPos);
      return true;
    } else {
      return false;
    }
  };

  // ---- Handlers to Create New Points, Drag Existing, Draw Hover ----------------
  const handleClickCreatePoint = (e: Event) => {
    const pos = pointer(e, svgNode);
    const xPos = pos[0];
    const xValue = xScale.invert(xPos);
    const newPoint = {xValue};
    content.createNewPoint(newPoint);
  };

  const handleDrag = drag<SVGCircleElement, PointObjectModelType>()
  .on('drag', (e, p) => {
      if (mouseInBoundingBox(e)){
        const pos = pointer(e, svgNode);
        const xPos = pos[0];
        const id = p.id;
        const xValue = xScale.invert(xPos);
        const newPoint = {xValue};
        content.givenIdReplacePointCoordinates(id, newPoint);
      }
  });

  const drawMousePoint = (e: Event, r: number) => {
    const pos = pointer(e, svgNode);
    const xPos = pos[0];
    //create a fake hover circle that follows the mouse
    svg.selectAll(".mouseXCircle").remove();
    svg.append('circle')
    .attr('cx', xPos)
    .attr('cy', yMidPoint)
    .attr('r', r)
    .classed("mouseXCircle", true)
    .classed("defaultPointInnerCircle", true);
  };

  // --------- Assign handlers to SVG apply only when in bounding box -------------
  svg
  .on("click", (e) => {
    if (!content.isHoveringOverPoint){
      if (mouseInBoundingBox(e)){
        handleClickCreatePoint(e); //only create point if we are not hovering over a point and within bounding box
      }
    } else{
      content.toggleIsSelected(content.indexOfPointHovered);
    }
  })
  .on("mousemove", (e) => {
    const radius = (mouseInBoundingBox(e) && !content.isHoveringOverPoint) ? innerPointRadius : 0;
    drawMousePoint(e, radius);
    if (!mouseInBoundingBox(e)){
      content.setAllHoversFalse();
    }
  });

  /* ========================== [ Construct Numberline OnMount ] ================================= */
  useEffect(() => {
    if (axisWidth !== 0){ //after component has rendered
      console.log("----useEffect 1-------");
      const svg = select(svgRef.current);

      // ---------------------  Construct Number Line Axis ------------------------------
      svg.select(`.${axisClass}`).remove(); // Remove the previous axis
      const numOfTicks = numberlineDomainMax - numberlineDomainMin;
      svg.append('g')
      .attr("class", `${axisClass} num-line`)
      .attr("style", `${kAxisStyle}`) //move down
      .call(axisBottom(xScale).tickSizeOuter(0).ticks(numOfTicks)); //remove side ticks
      // --------- After The Axis Is Drawn, Customize "x = 0 tick"-----------------------
      svg.selectAll("g.tick line")
      .attr("y2", function(x){ return (x === 0) ? tickHeightZero : tickHeightDefault;})
      .attr("stroke-width", function(x){ return (x === 0) ? tickWidthZero : tickWidthDefault;})
      .attr("style", function(x){ return (x === 0) ? tickStyleZero : tickStyleDefault;});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisWidth]);

  /* =========================== [ Update Numberline ] =========================================== */
  useEffect(() => {
    if (axisWidth !== 0){ //after component has rendered
      console.log("----useEffect 2-------");
      // console.log("\t", content.pointsXValuesArr);
      // console.log("\t", content.pointsIsSelectedArr);

      const updateNumberline = () => {

        /* ================== [ P L O T   S T O R E D   P O I N T S ] ================ */

        // ---------- Create Outer Hover Circles For Existing Points In Model  ----------
        const existingPointsOuterCircle = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.outer-point')
        .data(content.axisPoints, p => p.id);
        // --- Initialize Attributes
        existingPointsOuterCircle.enter()
        .append("circle")
        .attr("class", "outer-point")
        .attr('cx', (p) => {
          const xValue = p.pointCoordinates?.xValue;
          return xScale(xValue || numberlineDomainMin); //mapped to axis width
        })
        .attr('cy', yMidPoint)
        .attr('r', outerPointRadius)
        .attr('id', p => p.id)
        .classed("defaultPointOuterCircle", true)
        .classed("disabled", (p, idx) =>!(idx === content.indexOfPointHovered));
        // --- Update Data for Existing circles
        existingPointsOuterCircle
        .attr('cx', (p) => {
          const xValue = p.pointCoordinates?.xValue;
          return xScale(xValue || numberlineDomainMin); //mapped to axis width
        })
        //only show blue outer circle when we hover over an existing point
        .classed("disabled", (p, idx)=> !(idx === content.indexOfPointHovered));

        // --- Remove circles for data that no longer exists
        existingPointsOuterCircle.exit().remove();

        // ------- Create Inner Circles For Existing Points In Model  -------------------
        const existingPointsInnerCircle = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.inner-point')
        .data(content.axisPoints, p => p.id);

        // Initialize Attributes
        existingPointsInnerCircle.enter()
        .append("circle")
        .attr("class", "inner-point")
        .attr('cx', (p) => {
          const xValue = p.pointCoordinates?.xValue;
          return xScale(xValue || numberlineDomainMin); //mapped to axis width
        })
        .attr('cy', yMidPoint)
        .attr('r', innerPointRadius)
        .attr('id', p => p.id)
        .classed("defaultPointInnerCircle", true)
        .classed("selected", (p)=>!!p.isSelected)
        .call(handleDrag as any); // Attach drag behavior to newly created circles

        // Update Data for Existing circles
        existingPointsInnerCircle
        .attr('cx', (p) => {
          const xValue = p.pointCoordinates?.xValue;
          return xScale(xValue || numberlineDomainMin);
        })
        .classed("selected", (p)=>!!p.isSelected);

        // Remove circles for data that no longer exists
        existingPointsInnerCircle.exit().remove();

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
  }, [axisWidth, hoverPointX, content.pointsIsHoveredArr]);

  return (
    <div
      className="numberline-tool"
      ref={documentScrollerRef}
      data-testid="numberline-tool"
      style={{"height": `${kNumberLineContainerHeight}`}}
    >
      <div className="numberline-tool-container" >
          <svg ref={svgRef} width={axisWidth}/>
          <i className="arrow left" style={{'left': numToPx(xShiftNum - 3), 'top': '53px'}}/>
          <i className="arrow right" style={{'right': numToPx(xShiftNum - 3), 'top': '53px'}}/>
          <button onClick={content.clearAllPoints}/>
      </div>
    </div>
  );
});

export default NumberlineToolComponent;
