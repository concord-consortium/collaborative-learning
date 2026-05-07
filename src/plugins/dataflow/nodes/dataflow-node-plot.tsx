import React, { useRef } from "react";
import { Line } from "react-chartjs-2";
import { ChartOptions, ChartData, ChartDataset } from "chart.js";
import "chart.js/auto";
import { kMaxNodeValues, NodePlotColor } from "../model/utilities/node";

import "./dataflow-node.scss";
import { IBaseNodeModel } from "./base-node";
import { observer } from "mobx-react";
import { useStopEventPropagation } from "./controls/custom-hooks";

interface INodePlotProps {
  display: boolean;
  model: IBaseNodeModel;
  recordedTicks: string[];
}

let stepY = 5;

// CHECKME: dsMax defaults to -Infinity this might cause a problem
function maxY(model: IBaseNodeModel) {
  return model.tickMax ?? model.dsMax;
}
// CHECKME: dsMin defaults to Infinity this might cause a problem
function minY(model: IBaseNodeModel) {
  return model.tickMin ?? model.dsMin;
}

enum Zoom {
  In,
  Out
}

export const DataflowNodePlot: React.FC<INodePlotProps> = observer(
  function DataflowNodePlot({display, model, recordedTicks})
{
  const divRef = useRef<HTMLDivElement>(null);
  useStopEventPropagation(divRef, "pointerdown");
  useStopEventPropagation(divRef, "dblclick");

  if (!display) return null;

  const handleClickOffset = (zoomDir: Zoom) => {
    const max = maxY(model);
    const min = minY(model);
    const difference = Math.abs(max - min);
    const midpoint = (max + min)/2;
    const distanceFromMidpoint = difference / 2;
    const scalar = (zoomDir === Zoom.In) ? 0.8 : 1.25;
    const newDistanceFromMidpoint = scalar * distanceFromMidpoint;
    model.setTickMax(midpoint + newDistanceFromMidpoint);
    model.setTickMin(midpoint - newDistanceFromMidpoint);
  };

  const scaleBtnColorClass= model.type.charAt(0).toLowerCase() + model.type.slice(1);

  // FIXME: for some reason onClick doesn't work on these buttons but onMouseDown does
  return (
    <div className="node-bottom-section" ref={divRef} >
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
          data={lineData(model, recordedTicks)}
          options={lineOptions(model)}
        />
      </div>
    </div>
  );
});

function lineData(model: IBaseNodeModel, recordedTicks: string[]): ChartData<"line", number[], number> {
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

      const chData: number[] = [];
      recentValues.forEach((val) => {
        if (val != null && isFinite(val)) {
          chData.push(val);
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

  stepY = (maxY(model) - minY(model)) / 2;

  return {
    labels: new Array(kMaxNodeValues).fill(undefined).map((val, idx) => idx),
    datasets: chartDataSets
  };
}

function lineOptions(model: IBaseNodeModel): ChartOptions<"line"> {
  const max = maxY(model);
  const min = minY(model);

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
