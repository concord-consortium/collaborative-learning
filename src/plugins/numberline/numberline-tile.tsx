import { observer } from "mobx-react";
import React, { useEffect } from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { scaleLinear, select, selectAll, pointer, axisBottom } from "d3";

import "./numberline-tile.scss";

export const NumberlineToolComponent: React.FC<ITileProps> = observer((props) => {

  const tileId = props.model.id;
  const axisClass = "axis-" + tileId;

  //Guidelines ✓
  //double arrowhead access is shown along bottom of tile
  //regular increments are marked every 1 unit, labeled on every increment/tick
  //axis extends from -5 to 5
  //0 tick is highlighted more heavily
  //build infrastructre to make axis limits variable
  //axis should extend across 90% of tile and be resizable as the tile resizes

  useEffect(()=>{
    const width0 = 600; //TODO: calculate width so it's always 90%
    const width = "100%";

    const linearScale = scaleLinear()
      .domain([-5, 5])
      .range([0, width0]);

    const clickArea = select('.click-area').node();

    function printNum(e: Event) {
      const pos = pointer(e, clickArea);
      const xPos = pos[0];
      const value = linearScale.invert(xPos);
      // select('.info').text('You clicked ' + value.toFixed(2));
      console.log("You clicked: ", value);
    }

    // Construct axis and remove two end ticks
    const axis = axisBottom(linearScale).tickSizeOuter(0);
    (select(`.${axisClass}`) as d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>).call(axis);

    //After the axis is drawn, select all the tick lines - only show tick for x = 0
    selectAll("g.num-axis g.tick line")
    .attr("y2", function(x){ return (x === 0) ? 20 : 0; });


    select('.click-area')
      .attr('width', width0)
      .attr('height', 40)
      .on('click', (e) => printNum(e));

  },[axisClass]);

  return (
    <div className="numberline-tool">
      <svg className="num-axis-container">
        <g transform="translate(20, 10)">
          <g className={`${axisClass} num-axis` } ></g>
          <rect className="click-area"></rect>
        </g>
      </svg>
      {/* <div className="info">Click on the grey band</div> */}
    </div>
  );
});
NumberlineToolComponent.displayName = "NumberlineToolComponent";
