import React from "react";
import { Line } from "react-chartjs-2";
import { ChartOptions, ChartData, ChartDataSets } from "chart.js";
import { kMaxNodeValues, NodePlotColor } from "../model/utilities/node";
import "./dataflow-node.scss";

interface INodePlotProps {
  display: boolean;
  data: any;
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

const maxY = (node: any) => node.data.tickMax ?? node.data.dsMax;
const minY = (node: any) => node.data.tickMin ?? node.data.dsMin;

enum Zoom {
  In,
  Out
}

export const DataflowNodePlot: React.FC<INodePlotProps> = (props) => {
  if (!props.display) return null;

  const handleClickOffset = (zoomDir: Zoom) => {
    const max = maxY(props.data);
    const min = minY(props.data);
    const difference = Math.abs(max - min);
    const midpoint = (max + min)/2;
    const distanceFromMidpoint = difference / 2;
    const scalar = (zoomDir === Zoom.In) ? 0.8 : 1.25;
    const newDistanceFromMidpoint = scalar * distanceFromMidpoint;
    props.data.data.tickMax = (midpoint + newDistanceFromMidpoint);
    props.data.data.tickMin = (midpoint - newDistanceFromMidpoint);
  };

  const scaleBtnColorClass= props.data.name.charAt(0).toLowerCase() + props.data.name.slice(1);

  return (
    <div className="node-bottom-section">
      <div className="node-bottom-buttons">
        <button
          className={`scale-buttons ${scaleBtnColorClass} plus`} onClick={() => handleClickOffset(Zoom.In)}>
          +
        </button>
        <button
          className={`scale-buttons ${scaleBtnColorClass} minus`} onClick={() => handleClickOffset(Zoom.Out)}>
          -
        </button>
      </div>
      <div className="node-graph">
        <Line
          data={lineData(props.data)}
          options={lineOptions(props.data)}
          redraw={true}
        />
      </div>
    </div>
  );
};

function lineData(node: any) {
  const chartDataSets: ChartDataSets[] = [];
  Object.keys(node.data.watchedValues).forEach((valueKey: string) => {
    const recentValues: any = node.data.recentValues?.[valueKey];
    if (recentValues !== undefined) {
      const customOptions = node.data.watchedValues?.[valueKey] || {};
      const dataset: ChartDataSets = {
        backgroundColor: NodePlotColor,
        borderColor: NodePlotColor,
        borderWidth: 2,
        pointRadius: 2,
        data: [0],
        fill: false,
        ...customOptions
      };

      const chData: any[] = [];
      recentValues.forEach((val: any) => {
        if (isFinite(val)) {
          chData.push(val);
        }
      });
      const localMax = Math.max(...chData);
      node.data.dsMax = ((node.data.dsMax !== undefined) ? Math.max(localMax, node.data.dsMax) : localMax);
      const localMin = Math.min(...chData);
      node.data.dsMin = ((node.data.dsMin !== undefined) ? Math.min(localMin, node.data.dsMin) : localMin);
      dataset.data = chData;
      chartDataSets.push(dataset);
    }
  });

  stepY = (maxY(node) - minY(node)) / 2;

  const chartData: ChartData = {
    labels: new Array(kMaxNodeValues).fill(undefined).map((val, idx) => idx),
    datasets: chartDataSets
  };

  return chartData;
}

function lineOptions(node: any) {
  const max = maxY(node);
  const min = minY(node);

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
