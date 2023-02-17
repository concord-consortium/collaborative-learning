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
  console.log("dataFlowNodePlot with props.data:", props.data);
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


//new

// interface ILineDataProps {
//   node: any;
// }


// export const LineData: React.FC<ILineDataProps> = ({node}) =>{

//   const chartDataSets: ChartDataSets[] = [];

//   // const [localMax, setLocalMax] = useState(0);

//   console.log("node:", node.name);

//   //instantiate a local state

//   let node.data.dsMax = 0;
//   let dsMin = 0;

//   Object.keys(node.data.watchedValues).forEach((valueKey: string) => {
//     // console.log("map function where valueKey:", valueKey);
//     const recentValues: any = node.data.recentValues?.[valueKey];
//     if (recentValues !== undefined) {
//       const customOptions = node.data.watchedValues?.[valueKey] || {};
//       const dataset: ChartDataSets = {
//         backgroundColor: NodePlotColor,
//         borderColor: NodePlotColor,
//         borderWidth: 2,
//         pointRadius: 2,
//         data: [0],
//         fill: false,
//         ...customOptions
//       };

//       const chData: any[] = [];

//       recentValues.forEach((val: any) => {
//         if (isFinite(val)) {
//           chData.push(val);
//           //find global max
//           dsMax = Math.max(...recentValues);
//           yMax = (dsMax > yMax) ? dsMax : yMax; //yMax stores the global max
//           dsMax = yMax;
//           //find global min
//           dsMin = Math.min(...recentValues);
//           yMin = (dsMin < yMin) ? dsMin : yMin;
//           dsMin = yMin;
//         }
//       });

//       dataset.data = chData;
//       chartDataSets.push(dataset);
//     }
//   });

//   stepY = (dsMax - dsMin) / 2;

//   const chartData: ChartData = {
//     labels: new Array(MAX_NODE_VALUES).fill(undefined).map((val,idx) => idx),
//     datasets: chartDataSets
//   };
//   if (chartData.datasets){
//     console.log("lineData() returns chartData:", chartData.datasets[0].data);
//   }
//   console.log("function lineData() > dsMax:", dsMax);
//   console.log("function lineData() > dsMin:", dsMin);
//   console.log("RETURN chartData:", chartData);
//   console.log("--------------------");

//   return chartData;
// };




//old
const globalYAxisMaxMin = {};
let yMax = 0;
let yMin = 0;



function lineData(node: any) {
  const chartDataSets: ChartDataSets[] = [];

  console.log("node:", node);
  // const nodeId = node.id as keyof typeof globalYAxisMaxMin; //used as lookup key for globalYAxisMaxMin


  // node.data.dsMax = node.data.dsMax || 0;
  // node.data.dsMin = node.data.dsMin || 0;

  Object.keys(node.data.watchedValues).forEach((valueKey: string) => {
    console.log("map function where valueKey:", valueKey);
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
      //check if index 0 is nan

      // if (recentValues[]
      console.log("recentValues:", recentValues);
      recentValues.forEach((val: any) => {
        if (isFinite(val)) {
          chData.push(val);
          //find global max
        }
      });
      const localMax = Math.max(...chData);
      node.data.dsMax = (node.data.dsMax) ? Math.max(localMax, node.data.dsMax) : localMax;
      const localMin = Math.min(...chData);
      node.data.dsMin = (node.data.dsMin) ? Math.min(localMin, node.data.dsMin) : localMin;
      dataset.data = chData;
      chartDataSets.push(dataset);
    }
  });

  stepY = (node.data.dsMax - node.data.dsMin) / 2;

  const chartData: ChartData = {
    labels: new Array(MAX_NODE_VALUES).fill(undefined).map((val,idx) => idx),
    datasets: chartDataSets
  };
  if (chartData.datasets){
    console.log("lineData() returns chartData:", chartData.datasets[0].data);
  }
  console.log("RETURN chartData:", chartData);
  console.log("--------------------");

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
