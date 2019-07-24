import * as React from "react";
import Rete from "rete";
import { Line } from "react-chartjs-2";
import { ChartOptions, ChartData, ChartDataSets } from "chart.js";
import { MAX_NODE_VALUES } from "../../dataflow-program";
import { NodePlotColors } from "../../../utilities/node";
import "./plot-control.sass";

export class PlotControl extends Rete.Control {
  private emitter: any;
  private component: any;
  private props: any;
  private node: any;
  private stepY = 5;

  constructor(emitter: any, key: string, node: any) {
    super(key);
    this.emitter = emitter;
    this.key = key;
    this.node = node;

    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(e.target.value); };
    };

    this.component = (compProps: {showgraph: any; onGraphButtonClick: any; }) => (
      <div className="node-graph-container">
        <button
          className="graph-button"
          onClick={handleChange(compProps.onGraphButtonClick)}>
          {compProps.showgraph ? "hide plot" : "show plot"}
        </button>
        {compProps.showgraph ?
          <div className="node-graph">
            < Line
              data={lineData()}
              options={lineOptions()}
              redraw={true}
            />
          </div>
          : null }
      </div>
    );

    const lineData = () => {
      const chartDataSets: ChartDataSets[] = [];

      // determine how many datasets will be in graph
      const recentValuesKey = "recentValues";
      const recentValues: any = node.data[recentValuesKey];
      const graphKeys: string[] = [];
      if (recentValues && recentValues.length) {
        Object.keys(recentValues[recentValues.length - 1]).forEach((objKey: any) => {
          graphKeys.push(objKey);
        });
      }

      let dsMax = 0;
      let dsMin = 0;
      if (graphKeys && graphKeys.length) {
        graphKeys.forEach((graphKey: any, index: number) => {
          // set up a new dataset to be graphed
          const plotColor = NodePlotColors[index % NodePlotColors.length];
          const dataset: ChartDataSets = {
            backgroundColor: plotColor,
            borderColor: plotColor,
            borderWidth: 2,
            pointRadius: 2,
            data: [0],
            fill: false,
          };
          chartDataSets.push(dataset);

          // get all values for this key
          const chdata: any[] = [];
          recentValues.forEach((recVal: any) => {
            recVal[graphKey] ? chdata.push(recVal[graphKey].val) : chdata.push(Number.NaN);
            if (chdata && chdata.length && !isNaN(chdata[chdata.length - 1])) {
              dsMax = Math.max(dsMax, chdata[chdata.length - 1]);
              dsMin = Math.min(dsMin, chdata[chdata.length - 1]);
            }
          });
          // put values in dataset
          chartDataSets[index].data = chdata;
        });
        this.stepY = (dsMax - dsMin) / 2;
      }

      const chartData: ChartData = {
        labels: Array.apply(null, {length: MAX_NODE_VALUES}).map(Number.call, Number),
        datasets: chartDataSets
      };

      return chartData;
    };

    const lineOptions = () => {
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
              stepSize: this.stepY,
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
    };

    this.props = {
      showgraph: false,
      onGraphButtonClick: () => {
        this.setGraph();
        // needed to force connections to update
        this.emitter.trigger("process");
      }
    };
  }

  public setGraph = () => {
    this.props.showgraph = !this.props.showgraph;
    (this as any).update();
  }

}
