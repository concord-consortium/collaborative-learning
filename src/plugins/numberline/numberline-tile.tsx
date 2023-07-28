import { observer } from "mobx-react";
import React from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { NumberlineContentModelType } from "./numberline-content";
import {scaleLinear, } from "d3";

import "./numberline-tile.scss";

export const NumberlineToolComponent: React.FC<ITileProps> = observer((props) => {
  // Note: capturing the content here and using it in handleChange() below may run the risk
  // of encountering a stale closure issue depending on the order in which content changes,
  // component renders, and calls to handleChange() occur. See the PR discussion at
  // (https://github.com/concord-consortium/collaborative-learning/pull/1222/files#r824873678
  // and following comments) for details. We should be on the lookout for such issues.
  const content = props.model.content as NumberlineContentModelType;

  // const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
  //   content.setText(event.target.value);
  // };

  const width = 600;

  const linearScale = scaleLinear()
    .domain([-5, 5])
    .range([0, width]);

  console.log("linearScale:", linearScale);

  // const clickArea = d3.select('.click-area').node();

  // function sayNum(e) {
  //   const pos = d3.pointer(e, clickArea);
  //   const xPos = pos[0];
  //   const value = linearScale.invert(xPos);
  //   d3.select('.info').text('You clicked ' + value.toFixed(2));
  // }

  // Construct axis
  // const axis = d3.axisBottom(linearScale);
  // console.log("axis:", axis);

  // d3.select('.axis').call(axis);

  // // Update click area size
  // d3.select('.click-area')
  //   .attr('width', width)
  //   .attr('height', 40)
  //   .on('click', ()=>sayNum(e));



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
