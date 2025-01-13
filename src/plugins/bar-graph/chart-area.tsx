import React, { useMemo } from "react";
import { observer } from "mobx-react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar, BarGroup } from "@visx/shape";
import { PositionScale } from "@visx/shape/lib/types";
import { getSnapshot } from "@concord-consortium/mobx-state-tree";
import { useBarGraphModelContext } from "./bar-graph-content-context";
import { CategoryPulldown } from "./category-pulldown";
import EditableAxisLabel from "./editable-axis-label";
import { displayValue, logBarGraphEvent, roundTo5 } from "./bar-graph-utils";
import { BarInfo } from "./bar-graph-types";
import { clueDataColorInfo } from "../../utilities/color-utils";

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
// For full control over presentation (eg, showing images on axis), see example here:
// https://github.com/airbnb/visx/pull/165


export const ChartArea = observer(function BarGraphChart({ width, height }: IProps) {

  const model = useBarGraphModelContext();
  const primary = model?.primaryAttribute || "";
  const secondary = model?.secondaryAttribute;

  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  function setPrimaryAttribute(id: string) {
    if (model) {
      model.setPrimaryAttribute(id);
      logBarGraphEvent(model, "setPrimaryAttribute", { attributeId: id });
    }
  }

  function barColor(key: string) {
    if (!model) return "blue";

    return model.secondaryAttribute
      ? clueDataColorInfo[model.colorForSecondaryKey(key)].color
      : clueDataColorInfo[model.primaryAttributeColor].color;
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

  function handleClick(primaryValue: string, secondaryValue?: string) {
    if (!model || !model.primaryAttribute) return;
    model.selectCasesByValues(primaryValue, secondaryValue);
    logBarGraphEvent(model, "selectCases", {
      attributeId:
        model.secondaryAttribute ? [model.primaryAttribute, model.secondaryAttribute] : model.primaryAttribute,
      attributeValue: secondaryValue ? [primaryValue, secondaryValue] : primaryValue
    });
  }

  function simpleBars() {
    const color = barColor(primary);
    return (
      <Group>
        {data.map((d) => {
          const key = d[primary] as string;
          const info = d.value as BarInfo;
          const x = primaryScale(key) || 0;
          const y = countScale(info.count);
          const w = primaryScale.bandwidth();
          const h = yMax - countScale(info.count);
          return (
            <BarWithHighlight key={key} x={x} y={y} width={w} height={h} color={color} selected={info.selected}
              onClick={() => handleClick(key)} />
          );
        })}
      </Group>
    );
  }

  function groupedBars() {
    // generate a unique value from the color map to force a re-render when the map changes
    const colorMapKey = model?.secondaryAttributeColorMap?.size
      ? JSON.stringify(getSnapshot(model.secondaryAttributeColorMap))
      : "no-color-map";

    return (
      <BarGroup
        data={data}
        color={barColor}
        key={colorMapKey}
        keys={secondaryKeys}
        height={yMax}
        x0={(d) => d[primary] as string}
        x0Scale={primaryScale}
        x1Scale={secondaryScale}
        yScale={((info: BarInfo) => countScale(info?.count||0)) as PositionScale}
      >
        {(barGroups) => {
            return (
              <Group className="visx-bar-group">
                {barGroups.map((barGroup) => {
                  const primaryValue = data[barGroup.index][primary] as string;
                  return (
                    <Group key={`bar-group-${barGroup.index}`} left={barGroup.x0}>
                      {barGroup.bars.map((bar) => {
                        if (!bar.value) return null;
                        // BarGroup really expects the values to be pure numeric, but we're using objects.
                        // Alternatively, we could drop BarGroup and build the bars manually.
                        const val = bar.value as unknown as BarInfo;
                        return <BarWithHighlight
                          key={`bar-group-bar-${barGroup.index}-${bar.index}`}
                          x={bar.x}
                          y={bar.y}
                          width={bar.width}
                          height={bar.height}
                          color={bar.color}
                          selected={val.selected}
                          onClick={() => handleClick(primaryValue, bar.key)} />;
                      })}
                    </Group>
                  );
                })}
              </Group>
            );
        }}
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
          tickFormat={(key) => displayValue(key)}
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

interface IBarHighlightProps {
  x: number;
  y: number;
  width: number;
  height: number;
}

function BarHighlight({ x, y, width, height }: IBarHighlightProps) {
  return(
    <rect
      x={x - 4}
      y={y - 4}
      width={width + 8}
      height={height + 8}
      fill="#14F49E"
      className="bar-highlight"
    />
  );
}

interface IBarWithHighlightProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  selected: boolean;
  onClick: () => void;
}

function BarWithHighlight({ x, y, width, height, color, selected, onClick }: IBarWithHighlightProps) {
  return (
    <Group>
      {selected && <BarHighlight x={x} y={y} width={width} height={height} />}
      <Bar onClick={onClick} x={x} y={y} width={width} height={height} fill={color} />
    </Group>
  );
}
