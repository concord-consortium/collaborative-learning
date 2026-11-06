import React, { useState } from "react";
import { Line } from "react-chartjs-2";
import { ChartOptions, ChartData, ChartDataset } from "chart.js";
import "chart.js/auto";
import { kMaxNodeValues, NodePlotColor } from "../model/utilities/node";

import "./dataflow-node.scss";
import { IBaseNodeModel } from "./base-node";
import { observer } from "mobx-react";
import { useStopEventPropagation } from "./controls/custom-hooks";
import { IPlotScale } from "./dataflow-node-plot-types";

interface INodePlotProps {
  model: IBaseNodeModel;
  recordedTicks: string[];
  plotScale?: PlotScaleFn;
}

type PlotScaleFn = (valueKey: string) => IPlotScale | undefined;
const noPlotScale: PlotScaleFn = () => undefined;

interface IDeclaredExtent { min: number; max: number }

let stepY = 5;

// Half-height of the axis a zoom falls back to when the plotted values give it nothing to
// scale. One unit of total span suits the 0-1 devices that hit this most often.
const kMinZoomHalfSpan = 0.5;

/**
 * The axis a node declares, or undefined to scale to the data.
 *
 * The axis belongs to `nodeValue`: that is the block's own value, the one its field reads out, and
 * the only series any node declares a scale for. Another watched series would be drawn on that
 * axis, wherever its values fell.
 */
function declaredExtent(plotScale: PlotScaleFn): IDeclaredExtent | undefined {
  const scale = plotScale("nodeValue");
  if (scale?.min == null || scale?.max == null) return undefined;
  return { min: scale.min, max: scale.max };
}

// resetGraph clears the zoom, which returns the axis to the declared range.
// CHECKME: dsMax defaults to -Infinity this might cause a problem
function maxY(model: IBaseNodeModel, declared?: IDeclaredExtent) {
  return model.tickMax ?? declared?.max ?? model.dsMax;
}
// CHECKME: dsMin defaults to Infinity this might cause a problem
function minY(model: IBaseNodeModel, declared?: IDeclaredExtent) {
  return model.tickMin ?? declared?.min ?? model.dsMin;
}

enum Zoom {
  In,
  Out
}

export const DataflowNodePlot: React.FC<INodePlotProps> = observer(
  function DataflowNodePlot({model, recordedTicks, plotScale = noPlotScale})
{
  const declared = declaredExtent(plotScale);
  const [plotEl, setPlotEl] = useState<HTMLDivElement | null>(null);
  useStopEventPropagation(plotEl, "pointerdown");
  useStopEventPropagation(plotEl, "dblclick");

  const handleClickOffset = (zoomDir: Zoom) => {
    const max = maxY(model, declared);
    const min = minY(model, declared);
    const haveRange = isFinite(max) && isFinite(min);
    const halfRange = haveRange ? Math.abs(max - min) / 2 : 0;
    const midpoint = haveRange ? (max + min) / 2 : 0;
    // Scaling zero leaves it at zero, so a block whose value never moves, or one with nothing
    // plotted yet, would have dead zoom buttons forever.
    const distanceFromMidpoint = halfRange > 0 ? halfRange : kMinZoomHalfSpan;
    const scalar = (zoomDir === Zoom.In) ? 0.8 : 1.25;
    const newDistanceFromMidpoint = scalar * distanceFromMidpoint;
    model.setTickMax(midpoint + newDistanceFromMidpoint);
    model.setTickMin(midpoint - newDistanceFromMidpoint);
  };

  const scaleBtnColorClass= model.type.charAt(0).toLowerCase() + model.type.slice(1);

  // FIXME: for some reason onClick doesn't work on these buttons but onMouseDown does
  return (
    <div className="node-bottom-section" ref={setPlotEl} >
      <div className="node-bottom-buttons">
        <button
          className={`scale-buttons ${scaleBtnColorClass} plus`} onMouseDown={() => handleClickOffset(Zoom.In)}>
          +
        </button>
        <button
          className={`scale-buttons ${scaleBtnColorClass} minus`} onMouseDown={() => handleClickOffset(Zoom.Out)}>
          -
        </button>
      </div>
      <div className="node-graph">
        <Line
          data={lineData(model, recordedTicks, plotScale, declared)}
          options={lineOptions(model, declared)}
        />
      </div>
    </div>
  );
});

function lineData(
  model: IBaseNodeModel, recordedTicks: string[], plotScale: PlotScaleFn,
  declared?: IDeclaredExtent
): ChartData<"line", number[], number> {
  const chartDataSets: ChartDataset<"line", number[]>[] = [];
  const recordedEntries = model.getTickEntries(recordedTicks);
  Object.keys(model.watchedValues).forEach((valueKey: string) => {
    const recentValues = recordedEntries.map(entry => {
      // If the entry is open we ignore it. This can happen if the node is
      // restored from the history. See the "Undo Support" section of
      // `dataflow.md`.
      if (entry?.open) return;

      // TODO: can we improve this typing here and still support the multiple
      // values we want to graph?
      return (entry as any)?.[valueKey];
    });
    if (recentValues !== undefined) {
      const customOptions = model.watchedValues?.[valueKey] || {};
      const dataset: ChartDataset<"line", number[]> = {
        backgroundColor: NodePlotColor,
        borderColor: NodePlotColor,
        borderWidth: 2,
        pointRadius: 2,
        data: [0],
        fill: false,
        clip: false,
        // The watchedValues value can be used to customize the minigraph
        ...customOptions
      };

      // Per series, and applied even when nothing declares an axis: the trace is in the node's
      // display units whether the axis came from a declaration or from the data.
      const toPlot = plotScale(valueKey)?.toPlot;
      const chData: number[] = [];
      recentValues.forEach((val) => {
        if (val != null && isFinite(val)) {
          chData.push(toPlot ? toPlot(val) : val);
        }
      });

      // CHECKME: if chData is empty, this will result in Infitity for the min and
      // max. Which will probably break the graph.
      model.setDsMax(Math.max(...chData, model.dsMax));
      model.setDsMin(Math.min(...chData, model.dsMin));
      dataset.data = chData;
      chartDataSets.push(dataset);
    }
  });

  stepY = (maxY(model, declared) - minY(model, declared)) / 2;

  return {
    labels: new Array(kMaxNodeValues).fill(undefined).map((val, idx) => idx),
    datasets: chartDataSets
  };
}

function lineOptions(model: IBaseNodeModel, declared?: IDeclaredExtent): ChartOptions<"line"> {
  const max = maxY(model, declared);
  const min = minY(model, declared);

  return {
    animation: {
      duration: 0
    },
    plugins: {
      legend: {
        display: false,
        position: "bottom",
      },
    },
    maintainAspectRatio: true,
    scales: {
      y: {
        type: "linear",
        max: (max === min) ? max + 1 : max,
        min: (max === min) ? min - 1 : min,
        ticks: {
          font: { size: 9 },
          display: true,
          stepSize: stepY,
          maxTicksLimit: 3,
          minRotation: 0,
          maxRotation: 0,
          callback: (value) => Number(Number(value).toFixed(1))
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        }
      },
      x: {
        ticks: {
          display: false,
        },
        grid: {
          display: false
        },
        border: {
          display: false,
        }
      }
    },
  };
}
