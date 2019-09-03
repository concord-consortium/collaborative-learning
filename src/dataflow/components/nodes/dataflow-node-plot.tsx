import * as React from "react";
import { Line } from "react-chartjs-2";
import { ChartOptions, ChartData, ChartDataSets } from "chart.js";
import { MAX_NODE_VALUES } from "../dataflow-program";
import { NodePlotColor } from "../../utilities/node";
import "./dataflow-node.sass";

interface NodePlotProps {
  display: boolean;
  data: any;
}

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
  const data = node.data.recentValues;
  const chartDataSets: ChartDataSets[] = [];

  let graphKeys: string[] = [];
  if (data && data.length) {
    graphKeys = Object.keys(data[data.length - 1]);
  }

  let dsMax = 0;
  let dsMin = 0;
  if (graphKeys && graphKeys.length) {
    graphKeys.forEach((graphKey, index: number) => {
      // set up a new dataset to be graphed
      const dataset: ChartDataSets = {
        backgroundColor: NodePlotColor,
        borderColor: NodePlotColor,
        borderWidth: 2,
        pointRadius: 2,
        data: [0],
        fill: false,
      };
      chartDataSets.push(dataset);

      // get all values for this key
      const chdata: any[] = [];
      data.forEach((recVal: any) => {
        recVal[graphKey] ? chdata.push(recVal[graphKey].val) : chdata.push(Number.NaN);
        if (chdata && chdata.length && isFinite(chdata[chdata.length - 1])) {
          dsMax = Math.max(dsMax, chdata[chdata.length - 1]);
          dsMin = Math.min(dsMin, chdata[chdata.length - 1]);
        }
      });
      // put values in dataset
      chartDataSets[index].data = chdata;
    });
    stepY = (dsMax - dsMin) / 2;
  }

  const chartData: ChartData = {
    labels: Array.apply(null, {length: MAX_NODE_VALUES}).map(Number.call, Number),
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
