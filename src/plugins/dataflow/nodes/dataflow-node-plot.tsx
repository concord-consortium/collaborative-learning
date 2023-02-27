import React from "react";
import { Line } from "react-chartjs-2";
import { ChartOptions, ChartData, ChartDataSets } from "chart.js";
import { MAX_NODE_VALUES } from "../components/dataflow-program";
import { NodePlotColor } from "../model/utilities/node";
import "./dataflow-node.scss";

interface INodePlotProps {
  display: boolean;
  data: any;
}

export interface MinigraphOptions {
  backgroundColor?: string;
  borderColor?: string;
}

enum Zoom {
  In,
  Out
}

export const defaultMinigraphOptions: MinigraphOptions = {
  backgroundColor: NodePlotColor,
  borderColor: NodePlotColor
};

let stepY = 5;

export const DataflowNodePlot: React.FC<INodePlotProps> = (props) => {
  if (!props.display) return null;

  const handleClickOffset = (zoomDir: Zoom) => {
    const max = props.data.data.tickMax || props.data.data.dsMax;
    const min = props.data.data.tickMin || props.data.data.dsMin;
    const difference = Math.abs(max - min);
    const offset = 0.1 * difference;

    if (zoomDir === Zoom.In ){
      props.data.data.tickMax = max - offset;
      props.data.data.tickMin = min + offset;
    }

    if (zoomDir === Zoom.Out){
      props.data.data.tickMax = max + offset;
      props.data.data.tickMin = min - offset;
    }
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

  stepY = (node.data.dsMax  - node.data.dsMin) / 2;

  const chartData: ChartData = {
    labels: new Array(MAX_NODE_VALUES).fill(undefined).map((val,idx) => idx),
    datasets: chartDataSets
  };

  return chartData;
}


function lineOptions(node: any) {
  const max = node.data.tickMax || node.data.dsMax;
  const min = node.data.tickMin || node.data.dsMin;

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
