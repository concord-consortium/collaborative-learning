import React, { useRef, useEffect, useState } from 'react';
import { select, scaleLinear, axisBottom, drag, selectAll, pointer } from 'd3';
import { observer } from 'mobx-react';
import { ITileModel } from "../../models/tiles/tile-model";
import { NumberlineContentModelType, PointObjectModelType } from "./models/numberline-content";

import "./numberline-tile.scss";
import { kAxisStyle, kAxisWidth, kContainerWidth, numberlineContainerHeight,
         numberlineDomainMax, numberlineDomainMin, numberlinePadding, tickHeightDefault,
         tickHeightZero, tickStyleDefault, tickStyleZero, tickWidthDefault,
         tickWidthZero } from './numberline-tile-constants';

interface CircleData {
  value: number;
  id: string;
}

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

  //--------------------------organize below -----------------------

  const circlesData: CircleData[] = [
    { value: -4, id: 'circle1' },
    { value: 0, id: 'circle2' },
    { value: 3, id: 'circle3' },
  ];

  const svgRef = useRef<SVGSVGElement | null>(null);


  //----------------- Mouse Point Circle State / Properties -------------------------
  const [hoverPointRadius, setHoverPointRadius] = useState(0);
  const [mousePointX, setMousePointX] = useState(0);
  const pointRadius = 5;

  // ----------------- Create Numberline Axis | Hover Circle on Axis | Create Points--------------------------------
  useEffect(() => { //ends 195
    console.log("-------useEffect59 triggered with axisClass:", axisClass);
    console.log("\tmousePointX", mousePointX);

    const updateNumberline = () => {
      const svg = select(svgRef.current);
      // ----------------------------- Construct Axis ---------------------------------------------
      const xScale = scaleLinear()
        .domain([numberlineDomainMin, numberlineDomainMax])
        .range([0, axisWidth]); // Adjusted range based on svg width
      const axisSel = svg.select(`.${axisClass}`);
      // ---------------------  Customize number line axis ----------------------------------------
      axisSel.remove(); // Remove the previous axis
      const numOfTicks = numberlineDomainMax - numberlineDomainMin;
      svg.append('g')
        .attr("class", `${axisClass} num-line` )
        .attr("style", `${kAxisStyle}`) //move down
        .call(axisBottom(xScale).tickSizeOuter(0).ticks(numOfTicks)); //remove side ticks
      // --------- After the axis is drawn, customize "x = 0 tick"---------------------------------
      svg.selectAll("g.tick line")
      .attr("y2", function(x){ return (x === 0) ? tickHeightZero : tickHeightDefault;})
      .attr("stroke-width", function(x){ return (x === 0) ? tickWidthZero : tickWidthDefault;})
      .attr("style", function(x){ return (x === 0) ? tickStyleZero : tickStyleDefault;});

      // ------------------ Set Handlers on SVG -----------------------------------------------------
      svg.on('click', (e) => handleClickCreatePoint(e))
      .on('mousemove', (e) => trackMouse(e))
      .on("mouseout", () => setHoverPointRadius(0)); //hide circle

      axisSel.append("circle")
      .attr("class", "outer-hover-circle")
      .attr("r", hoverPointRadius)
      .attr("cx", mousePointX)
      .attr("cy", 0)
      .attr("style", "fill: #808080")
      .attr("opacity", 1);


      const handleClickCreatePoint = (e: Event) => {
        console.log("handleClickCreatePoint!");
      };

      const trackMouse = (e: Event) => {
        console.log("trackMouse!");
        const svgSel = select(svgRef.current);
        const pos = pointer(e, svgSel.node());
        const xPos = pos[0];
        const yPos = pos[1];
        const yTopBound = (numberlineContainerHeight / 2) + 10;
        const yBottomBound = (numberlineContainerHeight / 2) - 10;

        if (yPos >= yBottomBound && yPos <= yTopBound){
          content.mouseOverPoint(xPos);
          if (content.hasPointHovered){
            console.log("\thideHover!");
            setHoverPointRadius(0); //hide hover preview
          }
          else {
            console.log("\tshowHover!");
            setHoverPointRadius(pointRadius);
            setMousePointX(xPos);
          }
        }
      };


    // -------------------- Set invisible click-area mask to lay over axis ----------------------------------



      // Update or create circle elements
      const circles = svg.selectAll<SVGCircleElement, CircleData>('circle')
        .data(circlesData, d => d.id);

      circles.enter() // Enter selection for new data
        .append('circle')
        .attr('cx', d => xScale(d.value) + 50)
        .attr('cy', 50)
        .attr('r', 10)
        .attr('fill', 'blue')
        .attr('id', d => d.id)
        .call(dragHandler); // Attach drag behavior to newly created circles

      circles // Update existing circles
        .attr('cx', d => xScale(d.value) + 50);

      circles.exit().remove(); // Remove circles for data that no longer exists

    };


    const dragHandler = drag<SVGCircleElement, CircleData>()
      .on('drag', (event, d) => {
        const svg = select(svgRef.current);
        const svgWidth = svgRef.current?.clientWidth || 500;

        const xScale = scaleLinear()
          .domain([-5, 5])
          .range([0, svgWidth - 100]);

        const newValue = xScale.invert(event.x - 50);
        d.value = newValue;

        svg.select(`#${d.id}`)
          .attr('cx', xScale(d.value) + 50);
      });


    updateNumberline();

    // Attach the updateNumberline function to the window resize event
    window.addEventListener('resize', updateNumberline);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('resize', updateNumberline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisWidth, mousePointX]);







  return (
    <div
      className="numberline-tool"
      ref={documentScrollerRef}
      data-testid="numberline-tool"
      style={{"height": `${numberlineContainerHeight}`}}
    >
      <div className="numberline-tool-container" >
          <svg ref={svgRef} width={axisWidth} height={100}>
          {/* <circle ref={circleRef} cx={-10} cy={-10} r={0} fill="blue" /> */}
          </svg>
      </div>

      <div className="other-container">
        {tileWidth}
        <br/>
        {containerWidth}
        <br/>
        {axisWidth}
      </div>

    </div>
  );
});

export default NumberlineToolComponent;

