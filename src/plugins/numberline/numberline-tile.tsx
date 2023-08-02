import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { scaleLinear, select, selectAll, pointer, axisBottom } from "d3";
import { useGraphLayoutContext } from "../graph/models/graph-layout";
import { useGraphModelContext } from "../graph/models/graph-model";

import "./numberline-tile.scss";

export const NumberlineToolComponent: React.FC<ITileProps> = observer((props) => {
  console.log("NumberlineToolComponent with props:", props);

  const tileId = props.model.id;
  const axisClass = "axis-" + tileId;


  //--------------------------------------------------------
  //// attempt 1 - ResizeObserver
  //what is setting documentScrollerRef.current??, also it only works with starred Tab
  // const documentScrollerRef = useRef<HTMLDivElement>(null);
  // const [panelWidth, setPanelWidth] = useState(0);

  //attempt 1
  // // Keep track of the size of the containing element
  // useEffect(() => {
  //   let obs: ResizeObserver;
  //   if (documentScrollerRef.current) {
  //     obs = new ResizeObserver(() => {
  //       setPanelWidth(documentScrollerRef.current?.clientWidth ?? 0);
  //     });
  //     obs.observe(documentScrollerRef.current);
  //   }
  //   return () => obs?.disconnect();
  // }, []);
  // console.log("panelWidth:", panelWidth);
  //------------------------------------------------------

  // attempt 2 - getComputedBounds
  //useObserver.js:122 Uncaught TypeError: layout.getAxisScale is not a function
  //The above error occurred in the <NumberlineToolComponent> component
  //at observerComponent

  // const graphModel = useGraphModelContext();
  // const layout = useGraphLayoutContext();
  // const xScale = layout.getAxisScale("bottom");
  // const plotAreaSVGRef = useRef<SVGSVGElement>(null);

  // useEffect(function setupPlotArea() {
  //   if (xScale && xScale?.length > 0) {
  //     const plotBounds = layout.getComputedBounds('plot');
  //     select(plotAreaSVGRef.current)
  //       .attr('x', plotBounds?.left || 0)
  //       .attr('y', plotBounds?.top || 0)
  //       .attr('width', layout.plotWidth > -1 ? layout.plotWidth : 0)
  //       .attr('height', layout.plotHeight > -1 ? layout.plotHeight : 0);
  //   }
  // }, [plotAreaSVGRef, layout, layout.plotHeight, layout.plotWidth, xScale, graphModel]);

  // console.log("plotAreaSVGRef.current:", plotAreaSVGRef.current);

  //-----------------------------------------------------------
  const totalWidth = 900; //TODO: calculate global width so it's always 90% of total width
  const width0 = (totalWidth * 0.9) - 30;
  const xShift = "10px";  //calculate based on 30

  //Create numberline axis
  useEffect(()=>{
    const linearScale = scaleLinear()
      .domain([-5, 5])
      .range([0, width0]);
    const clickArea = select('.click-area').node();
    function printNum(e: Event) {
      const pos = pointer(e, clickArea);
      const xPos = pos[0];
      const value = linearScale.invert(xPos);
      console.log("You clicked: ", value);
    }
    // Construct axis and remove two end ticks
    const axis = axisBottom(linearScale).tickSizeOuter(0);
    (select(`.${axisClass}`) as d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>).call(axis);

    // After the axis is drawn, select all the tick lines - only show tick for x = 0
    selectAll("g.num-axis g.tick line")
    .attr("y2", function(x){ return (x === 0) ? 20 : 0; });

    select('.click-area')
      .attr('width', width0)
      .attr('height', 40)
      .on('click', (e) => printNum(e));

  },[axisClass, width0]);

  // attempt 3 - getBoundingClientRect????


  //Guidelines ✓
  //double arrowhead access is shown along bottom of tile
  //regular increments are marked every 1 unit, labeled on every increment/tick
  //axis extends from -5 to 5
  //0 tick is highlighted more heavily
  //build infrastructre to make axis limits variable
  //axis should extend across 90% of tile and be resizable as the tile resizes

  //TODO why is transform={`translateX(${xShift})`

  return (
    <div className="numberline-tool">
      <div className="numberline-tool-container">
        <div className="num-axis-title-container">
          <div className="title-box">
            Number Line #
          </div>
        </div>

        <div className="num-axis-container">
          <svg>
            <g transform="translate(0, 20)">
              <g className={`${axisClass} num-axis`} style={{'transform':`translateX(${xShift})`}}></g>
              {/* <g className={`${axisClass} num-axis`}></g> */}

              {/* <rect className="click-area"></rect> */}
            </g>
          </svg>
          <div className="click-area" style={{'width': width0, 'transform':`translateX(${xShift})`}}>
          </div>
            <i className="arrow right" style={{'right': xShift, 'top': '14px'}}></i>
            <i className="arrow left" style={{'left': xShift, 'top': '14px'}}></i>



        </div>

      </div>

    </div>
  );
});
NumberlineToolComponent.displayName = "NumberlineToolComponent";
