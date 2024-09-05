import React, { useMemo } from "react";
import { observer } from "mobx-react";
import { isNumber } from "lodash";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar, BarGroup } from "@visx/shape";
import { clueDataColorInfo } from "../../utilities/color-utils";
import { useBarGraphModelContext } from "./bar-graph-content-context";
import { CategoryPulldown } from "./category-pulldown";
import EditableAxisLabel from "./editable-axis-label";

const margin = {
  top: 60,
  bottom: 60,
  left: 80,
  right: 80,
};

const demoCases: Record<string,string>[] = [
  { date: '6/23/24', location: 'deck' },
  { date: '6/23/24', location: 'porch' },
  { date: '6/23/24', location: 'tree' },
  { date: '6/24/24', location: 'porch' },
  { date: '6/24/24', location: 'porch' },
  { date: '6/25/24', location: 'backyard' },
  { date: '6/25/24', location: 'deck' },
  { date: '6/25/24', location: 'deck' },
  { date: '6/25/24', location: 'deck' },
  { date: '6/25/24', location: 'tree' },
  { date: '6/26/24', location: 'backyard' },
  { date: '6/26/24', location: 'deck' },
  { date: '6/26/24', location: 'deck' },
  { date: '6/26/24', location: 'porch' },
  { date: '6/26/24', location: 'tree' }
];

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


export const BarGraphChart = observer(function BarGraphChart({ width, height }: IBarGraphChartProps) {

  const model = useBarGraphModelContext();
  const primary = model?.primaryAttribute || "date";
  const secondary = model?.secondaryAttribute || "location";

  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  function setDemoCategory(catname: string) {
    if (catname === "date") {
      model?.setPrimaryAttribute("date");
      model?.setSecondaryAttribute("location");
    } else{
      model?.setPrimaryAttribute("location");
      model?.setSecondaryAttribute("date");
    }
  }

  // Count cases and make the data array
  const data = useMemo(
    () => demoCases.reduce((acc, row) => {
        const cat = primary in row ? row[primary] : "";
        const subCat = row[secondary] || "";
        const index = acc.findIndex(r => r[primary] === cat);
        if (index >= 0) {
          const cur = acc[index][subCat];
          acc[index][subCat] = (isNumber(cur) ? cur : 0) + 1;
        } else {
          const newRow = { [primary]: cat, [subCat]: 1 };
          acc.push(newRow);
        }
        return acc;
      }, [] as { [key: string]: number|string }[]),
    [primary, secondary]);

  const primaryKeys: string[]
    = useMemo(() => data.map(d => d[primary] as string),
      [data, primary]);
  const secondaryKeys: string[]
    = useMemo(() => Array.from(new Set(data.flatMap(d => Object.keys(d)).filter(k => k !== primary))),
      [data, primary]);

  // find the maximum data value
  const maxValue = data.reduce((acc, row) => {
    const rowValues = Object.values(row).slice(1) as (string | number)[];
    const maxInRow = Math.max(...rowValues.map(v => isNumber(v) ? v : 0));
    return Math.max(maxInRow, acc);
  }, 0);

  const primaryScale = useMemo(
    () =>
      scaleBand<string>({
        domain: primaryKeys,
        padding: 0.2,
        range: [0, xMax]}),
    [xMax, primaryKeys]);

  const secondaryScale = useMemo(
    () =>
      scaleBand<string>({
        domain: secondaryKeys,
        padding: 0.2,
        range: [0, primaryScale.bandwidth()]}),
    [primaryScale, secondaryKeys]);

  const countScale = useMemo(
    () =>
      scaleLinear<number>({
      domain: [0, roundTo5(maxValue)],
      range: [yMax, 0],
    }),
    [yMax, maxValue]);

  if (xMax <= 0 || yMax <= 0) return <span>Too small</span>;

  const ticks = Math.min(4, Math.floor(yMax/40));  // leave generous vertical space (>=40 px) between ticks
  const labelWidth = (xMax/primaryKeys.length)-10; // setting width will wrap lines in labels when needed

  return (
    <svg width={width} height={height} data-testid="bar-graph-svg">
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
          tickLabelProps={{ dx: -5, fontSize: 14, fontFamily: 'Lato', fill: '#3f3f3f' }}
          tickFormat={(value) => Number(value).toFixed(0)}
        />
        <BarGroup
          data={data}
          color={(d, i) => barColor(i)}
          className="bar"
          keys={secondaryKeys}
          height={yMax}
          x0={(d) => d[primary] as string}
          x0Scale={primaryScale}
          x1Scale={secondaryScale}
          yScale={countScale}
        >
          {(barGroups) =>
            <Group className="visx-bar-group">
              {barGroups.map((barGroup) => (
                <Group key={`bar-group-${barGroup.index}-${barGroup.x0}`} left={barGroup.x0}>
                  {barGroup.bars.map((bar) => {
                    if(!bar.value) return null;
                    return <Bar
                      key={`bar-group-bar-${barGroup.index}-${bar.index}-${bar.value}-${bar.key}`}
                      x={bar.x}
                      y={bar.y}
                      width={bar.width}
                      height={bar.height}
                      fill={bar.color}
                    />;
                  })}
                </Group>
              ))}
            </Group>
          }
        </BarGroup>
      </Group>
      <EditableAxisLabel
        x={20}
        y={margin.top + yMax/2}
        text={model?.yAxisLabel}
        setText={(text) => model?.setYAxisLabel(text)}
      />
      <CategoryPulldown
        categoryList={["date", "location"]}
        category={primary}
        setCategory={setDemoCategory}
        x={margin.left}
        y={height-35}
        width={xMax}
        height={30}
      />
    </svg>
  );
});
