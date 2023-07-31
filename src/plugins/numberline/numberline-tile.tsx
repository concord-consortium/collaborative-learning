import { observer } from "mobx-react";
import React, { useEffect } from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { NumberlineContentModelType } from "./numberline-content";
import { scaleLinear } from "d3";
import * as d3 from "d3";


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

    const clickArea = d3.select('.click-area').node();

    function sayNum() {
      console.log("sayNum invoked()");
      const pos = d3.pointer(clickArea);
      const xPos = pos[0];
      const value = linearScale.invert(xPos);
      d3.select('.info').text('You clicked ' + value.toFixed(2));
    }

    // Construct axis
    // const axis = d3.axisBottom(linearScale);
    // // const axisSelect = d3.select('svg');

    // const axis =
    // const axisSelect = d3.select<SVGElement, DataType>("axis");

    // d3.select('.axis').call(() => axisSelect);

    // Update click area size
    d3.select('.click-area')
      .attr('width', width)
      .attr('height', 40)
      .on('click', sayNum);
  },[]);

  return (
    <div className="numberline-tool">
      {/* <textarea value={content.text} onChange={handleChange} /> */}
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
