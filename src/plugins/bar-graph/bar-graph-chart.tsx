import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";
import React, { useMemo } from "react";

const margin = {
  top: 60,
  bottom: 60,
  left: 80,
  right: 80,
};

const data: Record<string, number> = {
  'New York': 121,
  'San Francisco': 20,
  'Austin': 38,
};

const keys = Object.keys(data);

interface IBarGraphChartProps {
  width: number;
  height: number;
}

export function BarGraphChart({ width, height }: IBarGraphChartProps) {

  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  const cityScale = useMemo(
    () =>
      scaleBand<string>({
        domain: keys,
        padding: 0.1,
        range: [0, xMax]}),
    [xMax]);

  const countScale = useMemo(
    () =>
      scaleLinear<number>({
      domain: [0, Math.max(...keys.map(key => data[key]))],
      range: [yMax, 0],
    }),
    [yMax]);

  if (xMax <= 0 || yMax <= 0) return null;

  return (
    <svg width={width} height={height}>
      <Group top={margin.top} left={margin.left}>
        {/* <text x={0} y={0}>{`width: ${width}, height: ${height}`}</text> */}
        {/* <rect x={0} y={0} width={xMax} height={yMax} fill="none" stroke="grey"/> */}
        <GridRows
          scale={countScale}
          width={xMax}
          numTicks={Math.min(4, yMax/15)}
        />
        <AxisBottom
          top={countScale(0)}
          scale={cityScale}
        />
        <AxisLeft
          left={0}
          scale={countScale}
          numTicks={Math.min(4, yMax/15)}
        />
        {
          Object.keys(data).map((city) => {
            return (
              <Bar
                key={`bar-${city}`}
                x={cityScale(city) ?? 0}
                y={countScale(data[city])}
                width={cityScale.bandwidth()}
                height={yMax - (countScale(data[city]) ?? 0)}
                fill="orange"
              />
            );
          })
        }
      </Group>
    </svg>
  );
}
