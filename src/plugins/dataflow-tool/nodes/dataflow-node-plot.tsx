import React from "react";
import { Line } from "react-chartjs-2";
import { ChartOptions, ChartData, ChartDataSets } from "chart.js";
import { MAX_NODE_VALUES } from "../components/dataflow-program";
import { NodePlotColor } from "../model/utilities/node";
import "./dataflow-node.scss";

interface NodePlotProps {
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

export const DataflowNodePlot = (props: NodePlotProps) => {
  if (!props.display) return null;

  return (
    <div className="node-graph">
      <Line
        data={lineData(props.data)}
        options={lineOptions()}
        redraw={true}
      />
    </div>
  );
};

function lineData(node: any) {
  const chartDataSets: ChartDataSets[] = [];

  let dsMax = 0;
  let dsMin = 0;
  Object.keys(node.data.watchedValues).forEach((valueKey: string) => {
    const recentValues: any = node.data.recentValues[valueKey];
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
          dsMax = Math.max(dsMax, val);
          dsMin = Math.min(dsMin, val);
        }
      });
      dataset.data = chData;
      chartDataSets.push(dataset);
    }
  });
  stepY = (dsMax - dsMin) / 2;

  const chartData: ChartData = {
    labels: new Array(MAX_NODE_VALUES).fill(undefined).map((val,idx) => idx),
    datasets: chartDataSets
  };

  return chartData;
}

function lineOptions() {
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
          maxTicksLimit: 3,
          minRotation: 0,
          maxRotation: 0,
        },
        gridLines: {
          display: false
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
