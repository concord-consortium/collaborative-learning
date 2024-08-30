import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { BarGroup } from "@visx/shape";
import { isNumber } from "lodash";
import React, { useMemo } from "react";
import { clueDataColorInfo } from "../../utilities/color-utils";
import { useBarGraphModelContext } from "./bar-graph-content-context";
import EditableAxisLabel from "./editable-axis-label";

const margin = {
  top: 60,
  bottom: 60,
  left: 80,
  right: 80,
};

const data = [
  { date: '6/23/24', 'backyard': 0, 'deck': 1, 'porch': 1, 'tree': 1 },
  { date: '6/24/24', 'backyard': 0, 'deck': 0, 'porch': 2, 'tree': 2 },
  { date: '6/25/24', 'backyard': 1, 'deck': 3, 'porch': 0, 'tree': 1 },
  { date: '6/26/24', 'backyard': 1, 'deck': 2, 'porch': 1, 'tree': 1 }
];
// find the maximum data value
const maxValue = data.reduce((acc, row) => {
  const rowValues = Object.values(row).slice(1) as (string | number)[];
  const maxInRow = Math.max(...rowValues.map(v => isNumber(v) ? v : 0));
  return Math.max(maxInRow, acc);
}, 0);

const primaryKeys = data.map(d => d.date);
const secondaryKeys = Object.keys(data[0]).filter(key => key !== 'date');

function roundTo5(n: number): number {
  return Math.ceil(n/5)*5;
}

function barColor(n: number) {
  return clueDataColorInfo[n % clueDataColorInfo.length].color;
}



interface IBarGraphChartProps {
  width: number;
  height: number;
}

// TODO rotate labels if needed
// angle: -45, textAnchor: 'end'
// https://github.com/airbnb/visx/discussions/1494


export function BarGraphChart({ width, height }: IBarGraphChartProps) {

  const model = useBarGraphModelContext();

  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  const primaryScale = useMemo(
    () =>
      scaleBand<string>({
        domain: primaryKeys,
        padding: 0.2,
        range: [0, xMax]}),
    [xMax]);

  const secondaryScale = useMemo(
    () =>
      scaleBand<string>({
        domain: secondaryKeys,
        padding: 0.2,
        range: [0, primaryScale.bandwidth()]}),
    [primaryScale]);

  const countScale = useMemo(
    () =>
      scaleLinear<number>({
      domain: [0, roundTo5(maxValue)],
      range: [yMax, 0],
    }),
    [yMax]);

  if (xMax <= 0 || yMax <= 0) return <span>Too small</span>;

  const ticks = Math.min(4, Math.floor(yMax/40)); // leave generous vertical space
  const labelWidth = (xMax/primaryKeys.length)-10;       // setting width will wrap words in labels when needed

  return (
    <svg width={width} height={height}>
      <Group top={margin.top} left={margin.left}>
        <GridRows
          scale={countScale}
          width={xMax}
          numTicks={ticks}
          stroke="#bfbfbf"
          strokeWidth={1.5}
        />
        <AxisBottom
          top={countScale(0)}
          scale={primaryScale}
          strokeWidth={2}
          stroke="#707070"
          tickLineProps={{ stroke: '#bfbfbf', strokeWidth: 1.5, height: 5 }}
          tickLabelProps={{ dy: -7, fontSize: 14, fontFamily: 'Lato', fill: '#3f3f3f',
            verticalAnchor: "start", width: labelWidth}}
        />
        <AxisLeft
          left={0}
          scale={countScale}
          strokeWidth={2}
          stroke="#707070"
          numTicks={ticks}
          tickLineProps={{ stroke: '#bfbfbf', strokeWidth: 1.5, width: 5 }}
          tickLabelProps={{ dx: -5, fontSize: 14, fontFamily: 'Lato', fill: '#3f3f3f', }}
          tickFormat={(value) => Number(value).toFixed(0)}
        />
        <BarGroup
          data={data}
          color={(d, i) => barColor(i)}
          className="bar"
          keys={secondaryKeys}
          height={yMax}
          x0={(d) => d.date}
          x0Scale={primaryScale}
          x1Scale={secondaryScale}
          yScale={countScale}
        />
      </Group>
      <EditableAxisLabel
        x={20}
        y={margin.top + yMax/2}
        text={model?.yAxisLabel}
        setText={(text) => model?.setYAxisLabel(text)}
      />
    </svg>
  );
}
