import { observer } from "mobx-react";
import React, { useEffect } from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { NumberlineContentModelType } from "./numberline-content";
import { scaleLinear, select, pointer, axisBottom } from "d3";

//TODO: import the exact functions we need.

import "./numberline-tile.scss";

export const NumberlineToolComponent: React.FC<ITileProps> = observer((props) => {
  // Note: capturing the content here and using it in handleChange() below may run the risk
  // of encountering a stale closure issue depending on the order in which content changes,
  // component renders, and calls to handleChange() occur. See the PR discussion at
  // (https://github.com/concord-consortium/collaborative-learning/pull/1222/files#r824873678
  // and following comments) for details. We should be on the lookout for such issues.
  const content = props.model.content as NumberlineContentModelType;

  useEffect(()=>{
    const width = 600;

    const linearScale = scaleLinear()
      .domain([-5, 5])
      .range([0, width]);

    const clickArea = select('.click-area').node();

    function sayNum(e: Event) {
      const pos = pointer(e, clickArea);
      const xPos = pos[0];
      const value = linearScale.invert(xPos);
      select('.info').text('You clicked ' + value.toFixed(2));
    }

    // Construct axis
    const axis = axisBottom(linearScale); //original
    // const axis = d3.axisBottom(linearScale) as any; //how to infer the type

    (select('.axis') as d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>).call(axis);
    // selection.call(axis);
    // d3.select('.axis').append('g').call(axis);

    select('.click-area')
      .attr('width', width)
      .attr('height', 40)
      .on('click', (e) => sayNum(e));

  },[]);



// // Hide the tick marks (optional, to make it more explicit)
// axis.tickSize(0);
//     //construct axis with only one tick at 0
//     const axis = d3.axisBottom(linearScale).ticks(1) as any; //how to infer the type


    // // Create the number line
    // const numberLine = svg.append("g")
    // .attr("transform", `translate(0,${innerHeight / 2})`);

    // // Add the tick for zero
    // numberLine.append("line")
    // .attr("x1", xScale(0))
    // .attr("x2", xScale(0))
    // .attr("y1", -10)
    // .attr("y2", 10)
    // .attr("stroke", "black");

    // // Hide the other ticks
    // numberLine.selectAll("line")
    // .data(data)
    // .enter()
    // .append("line")
    // .attr("x1", (d) => xScale(d))
    // .attr("x2", (d) => xScale(d))
    // .attr("y1", -10)
    // .attr("y2", 10)
    // .attr("stroke", "none");

  return (
    <div className="numberline-tool">
      <svg width="700" height="80">
        <g transform="translate(20, 10)">
        <g className="axis" transform="translate(0, 40)"></g>
        <rect className="click-area"></rect>
        </g>
      </svg>

      <div className="info">Click on the grey band</div>
    </div>
  );
});
NumberlineToolComponent.displayName = "NumberlineToolComponent";
