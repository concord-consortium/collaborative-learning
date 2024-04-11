import React, { useRef } from "react";
import { Line } from "react-chartjs-2";
import { ChartOptions, ChartData, ChartDataSets } from "chart.js";
import { kMaxNodeValues, NodePlotColor } from "../model/utilities/node";

import "./dataflow-node.scss";
import { IBaseNodeModel } from "./base-node";
import { observer } from "mobx-react";
import { useStopEventPropagation } from "./controls/custom-hooks";

interface INodePlotProps {
  display: boolean;
  model: IBaseNodeModel;
}

export interface MinigraphOptions {
  backgroundColor?: string;
  borderColor?: string;
}

export const defaultMinigraphOptions: MinigraphOptions = {
  backgroundColor: NodePlotColor,
  borderColor: NodePlotColor
};

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
  function DataflowNodePlot({display, model})
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
          data={lineData(model)}
          options={lineOptions(model)}
          redraw={true}
        />
      </div>
    </div>
  );
});

function lineData(model: IBaseNodeModel) {
  const chartDataSets: ChartDataSets[] = [];
  Object.keys(model.watchedValues).forEach((valueKey: string) => {
    const recentValues = model.recentValues?.get(valueKey);
    if (recentValues !== undefined) {
      const customOptions = model.watchedValues?.[valueKey] || {};
      const dataset: ChartDataSets = {
        backgroundColor: NodePlotColor,
        borderColor: NodePlotColor,
        borderWidth: 2,
        pointRadius: 2,
        data: [0],
        fill: false,
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

  const chartData: ChartData = {
    labels: new Array(kMaxNodeValues).fill(undefined).map((val,idx) => idx),
    datasets: chartDataSets
  };

  return chartData;
}

function lineOptions(model: IBaseNodeModel) {
  const max = maxY(model);
  const min = minY(model);

  const options: ChartOptions = {
    animation: {
      duration: 0
    },
    legend: {
      display: false,
      position: "bottom",
    },
    maintainAspectRatio: true,
    scales: {
      yAxes: [{
        id: "y-axis-0",
        type: "linear",
        ticks: {
          fontSize: 9,
          display: true,
          stepSize: stepY,
          max: (max === min) ? max + 1 : max,
          min: (max === min) ? min - 1 : min,
          maxTicksLimit: 3,
          minRotation: 0,
          maxRotation: 0,
          callback: (value: number) => {
            return Number(value.toFixed(1));
          }
        },
        gridLines: {
          display: false,
        }
      }],
      xAxes: [{
        id: "x-axis-0",
        ticks: {
          display: false,
        },
        gridLines: {
          display: false
        }
      }]
    },
  };

  return options;
}
