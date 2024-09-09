import React, { useMemo } from "react";
import { observer } from "mobx-react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar, BarGroup } from "@visx/shape";
import { useBarGraphModelContext } from "./bar-graph-content-context";
import { CategoryPulldown } from "./category-pulldown";
import EditableAxisLabel from "./editable-axis-label";
import { roundTo5 } from "./bar-graph-utils";

const margin = {
  top: 7,
  bottom: 70,
  left: 70,
  right: 10,
};

interface IProps {
  width: number;
  height: number;
}

// Consider: rotating labels if needed
// angle: -45, textAnchor: 'end'
// https://github.com/airbnb/visx/discussions/1494


export const ChartArea = observer(function BarGraphChart({ width, height }: IProps) {

  const model = useBarGraphModelContext();
  const primary = model?.primaryAttribute || "";
  const secondary = model?.secondaryAttribute;

  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  function setPrimaryAttribute(id: string) {
    model?.setPrimaryAttribute(id);
    model?.setSecondaryAttribute(undefined);
  }

  function barColor(key: string) {
    if (!model) return "black";
    return model.getColorForSecondaryKey(key);
  }

  // Count cases and make the data array
  const data = model?.dataArray || [];

  const primaryKeys = useMemo(() => model?.primaryKeys || [], [model?.primaryKeys]);
  const secondaryKeys = useMemo(() => model?.secondaryKeys || [], [model?.secondaryKeys]);

  // find the maximum data value
  const maxValue = model?.maxDataValue || 0;

  const primaryScale = useMemo(
    () =>
      scaleBand<string>({
        domain: primaryKeys,
        paddingInner: (secondary ? 0.2 : .66),
        paddingOuter: (secondary ? 0.2 : .33),
        range: [0, xMax]}),
    [secondary, xMax, primaryKeys]);

  const secondaryScale = useMemo(
    () =>
      scaleBand<string>({
        domain: secondaryKeys,
        padding: 0.4,
        range: [0, primaryScale.bandwidth()]}),
    [primaryScale, secondaryKeys]);

  const countScale = useMemo(
    () =>
      scaleLinear<number>({
      domain: [0, roundTo5(maxValue)],
      range: [yMax, 0],
    }),
    [yMax, maxValue]);

  if (xMax <= 0 || yMax <= 0) return <span>Tile too small to show graph ({width}x{height})</span>;

  const ticks = data.length > 0
    ? Math.min(4, Math.floor(yMax/40))  // leave generous vertical space (>=40 px) between ticks
    : 0;                                // no ticks or grid for empty graph

  const labelWidth = (xMax/primaryKeys.length)-10; // setting width will wrap lines when needed

  function simpleBars() {
    const color = barColor(primary);
    return (
      <Group>
        {data.map((d) => {
          const key = d[primary] as string;
          const val = d.value as number;
          return (
            <Bar
              key={key}
              className="bar"
              x={primaryScale(key) || 0}
              y={countScale(val)}
              width={primaryScale.bandwidth()}
              height={yMax - countScale(val)}
              fill={color}
            />
          );
        })}
      </Group>
    );
  }

  function groupedBars() {
    return (
      <BarGroup
        data={data}
        color={barColor}
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
                  if (!bar.value) return null;
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
    );
  }

  return (
    <svg width={width} height={height} className="bar-graph-svg" data-testid="bar-graph-svg">
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
        { secondary ? groupedBars() : simpleBars() }
      </Group>
      <EditableAxisLabel
        x={20}
        y={margin.top + yMax/2}
        text={model?.yAxisLabel}
        setText={(text) => model?.setYAxisLabel(text)}
      />
      <CategoryPulldown
        setCategory={setPrimaryAttribute}
        x={margin.left}
        y={height-35}
        width={xMax}
        height={30}
      />
    </svg>
  );
});
