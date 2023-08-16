import React, { useRef, useEffect, useState } from 'react';
import { select, scaleLinear, axisBottom, drag, pointer } from 'd3';
import { observer } from 'mobx-react';
import { ITileModel } from "../../models/tiles/tile-model";
import { NumberlineContentModelType, PointObjectModelType,  } from "./models/numberline-content";
import { kAxisStyle, kAxisWidth, kContainerWidth, kNumberLineContainerHeight,
         numberlineDomainMax, numberlineDomainMin, tickHeightDefault,
         tickHeightZero, tickStyleDefault, tickStyleZero, tickWidthDefault,
         tickWidthZero, innerPointRadius, outerPointRadius } from './numberline-tile-constants';


import "./numberline-tile.scss";

interface IProps {
  model: ITileModel;
}

export const NumberlineToolComponent: React.FC<IProps> = observer(({ model }) => {
  const content = model.content as NumberlineContentModelType;

  //---------------- Create unique className for axis -------------------------
  const tileId = model.id;
  const axisClass = "axis-" + tileId;

  //---------------- Calculate width of tile ----------------------------------
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [tileWidth, setTileWidth] = useState(0);
  const containerWidth = (tileWidth * kContainerWidth);
  const axisWidth = (tileWidth * kAxisWidth); //used to set the svg
  const xShiftNum = ((containerWidth - axisWidth)/2);
  const numToPx = (num: number) => num.toFixed(2) + "px";

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

  //----------------- Mouse Point Circle State / Properties -------------------------
  const svgRef = useRef<SVGSVGElement | null>(null);
  const circleRef = useRef<SVGCircleElement | null>(null);
  const [hoverPointX, setHoverPointX] = useState(0); //used to retrigger useEffect below

  // ----------------- Create Numberline Axis | Hover Circle on Axis | Create Points--------------------------------
  useEffect(() => {
    if (axisWidth !== 0){ //after component has rendered
      const updateNumberline = () => {
        const indexOfPointHovered = content.indexOfPointHovered;
        const svg = select(svgRef.current);
        // ----------------------------- Construct Axis ---------------------------------------------
        const xScale = scaleLinear()
          .domain([numberlineDomainMin, numberlineDomainMax])
          .range([0, axisWidth]); // Adjusted range based on svg width

        // ---------------------  Customize Number Line Axis ----------------------------------------
        svg.select(`.${axisClass}`).remove(); // Remove the previous axis
        const numOfTicks = numberlineDomainMax - numberlineDomainMin;
        svg.append('g')
          .attr("class", `${axisClass} num-line`)
          .attr("style", `${kAxisStyle}`) //move down
          .call(axisBottom(xScale).tickSizeOuter(0).ticks(numOfTicks)); //remove side ticks

        // --------- After The Axis Is Drawn, Customize "x = 0 tick"---------------------------------
        svg.selectAll("g.tick line")
        .attr("y2", function(x){ return (x === 0) ? tickHeightZero : tickHeightDefault;})
        .attr("stroke-width", function(x){ return (x === 0) ? tickWidthZero : tickWidthDefault;})
        .attr("style", function(x){ return (x === 0) ? tickStyleZero : tickStyleDefault;});

        // ---------- Detect If Mouse Is Within Bounding Box Around Number Line ---------------------
        // ---------- Handlers to Draw Hover Point, Create New Points, Drag Existing ----------------
        const svgNode = svg.node();
        const yMidPoint = (kNumberLineContainerHeight / 2);

        const mouseInBoundingBox = (e: Event) => {
          const pos = pointer(e, svgNode);
          const xPos = pos[0];
          const yPos = pos[1];
          const yTopBound = yMidPoint + 10;
          const yBottomBound = yMidPoint - 10;
          const isBetweenYBounds = (yPos >= yBottomBound && yPos <= yTopBound);
          const isBetweenXBounds = (xPos >= 0 && xPos <= axisWidth);
          if (isBetweenYBounds && isBetweenXBounds ){
            content.mouseOverPoint(xPos); //detect if hovered over an existing point
            setHoverPointX(xPos);
            return true;
          } else {
            return false;
          }
        };
        const drawMousePoint = (e: Event, r: number) => {
          const pos = pointer(e, svgNode);
          const xPos = pos[0];
          if (circleRef.current) {
            select(circleRef.current)
              .attr("cx", xPos)
              .attr("cy", yMidPoint)
              .attr("r", r);
          }
        };

        const handleClickCreatePoint = (e: Event) => {
          const pos = pointer(e, svgNode);
          const xPos = pos[0];
          const newPoint = {xPos};
          content.createNewPoint(newPoint);
        };

        const handleDrag = drag<SVGCircleElement, PointObjectModelType>()
        .on('drag', (e, d) => {
            if (mouseInBoundingBox(e)){
              const pos = pointer(e, svgNode);
              const xPos = pos[0];
              const id = d.id;
              const newPoint = {xPos};
              content.givenIdReplacePointCoordinates(id, newPoint);
            }
        });

        // ---------- Assign handlers to SVG apply only when in bounding box ------------------------
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

        // ---------- Create Outer Hover Circles For Existing Points In Model  ----------------------
        const existingPointsOuterCircle = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.outer-points')
        .data(content.axisPoints, p => p.id)
        .classed("defaultPointOuterCircle", true)
        .classed("disabled", (d, idx)=> {
          //only show blue outer circle when we hover over an existing point
          return !(idx === indexOfPointHovered);
        });

        existingPointsOuterCircle.enter() // Enter selection for new data
          .append("circle")
          .attr("class", "outer-points")
          .attr('cx', (p) => p.pointCoordinates?.xPos || 0)
          .attr('cy', yMidPoint)
          .attr('r', outerPointRadius)
          .attr('id', p => p.id);

        existingPointsOuterCircle // Update existing circles
        .attr('cx', d => {
          return d.pointCoordinates?.xPos || 0;
        });
        existingPointsOuterCircle.exit().remove(); // Remove circles for data that no longer exists


        // ---------- Create Inner Circles For Existing Points In Model  ------------------------
        const existingPointsInnerCircle = svg.selectAll<SVGCircleElement, PointObjectModelType>('.circle,.inner-points')
          .data(content.axisPoints, p => p.id)
          .classed("defaultPointInnerCircle", true)
          .classed("selected", (p)=>{
            return !!p.isSelected;
          });

        existingPointsInnerCircle.enter() // Enter selection for new data
          .append("circle")
          .attr("class", "inner-points")
          .attr('cx', (p) => p.pointCoordinates?.xPos || 0)
          .attr('cy', yMidPoint)
          .attr('r', innerPointRadius)
          .attr('id', p => p.id)
          .call(handleDrag as any); // Attach drag behavior to newly created circles

        existingPointsInnerCircle // Update existing circles
          .attr('cx', d => {
            return d.pointCoordinates?.xPos || 0;
          });
        existingPointsInnerCircle.exit().remove(); // Remove circles for data that no longer exists

      }; //end updateNumberline

      updateNumberline();

      // Attach the updateNumberline function to the window resize event
      window.addEventListener('resize', updateNumberline);

      // Cleanup event listener on component unmount
      return () => {
        window.removeEventListener('resize', updateNumberline);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisWidth, hoverPointX, content.pointsIsHoveredArr]);

  // ---------------------- Render ----------------------------------------------------------------
  return (
    <div
      className="numberline-tool"
      ref={documentScrollerRef}
      data-testid="numberline-tool"
      style={{"height": `${kNumberLineContainerHeight}`}}
    >
      <div className="numberline-tool-container" >
          <svg ref={svgRef} width={axisWidth}>
            <circle className={"defaultPointInnerCircle"} ref={circleRef} cx={0} cy={0} r={innerPointRadius} />
          </svg>
          <i className="arrow left" style={{'left': numToPx(xShiftNum - 3), 'top': '53px'}}/>
          <i className="arrow right" style={{'right': numToPx(xShiftNum - 3), 'top': '53px'}}/>
      </div>
    </div>
  );
});

export default NumberlineToolComponent;
