import * as React from "react";
import Rete from "rete";
import "./plot-control.sass";
import { Line } from "react-chartjs-2";
import { ChartOptions } from "chart.js";
import { cloneDeep } from "lodash";
import { MAX_NODE_VALUES } from "../../dataflow-program";

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
      const data = {
        labels: Array.apply(null, {length: MAX_NODE_VALUES}).map(Number.call, Number),
        datasets: [{
          backgroundColor: "rgb(5, 146, 175)",
          borderColor: "rgb(5, 146, 175)",
          borderWidth: 2,
          pointRadius: 2,
          data: [0],
          fill: false,
        }]
      };
      const valKey = "recentValues";
      const values: any = node.data[valKey];
      if (values) {
        const chdata: any[] = cloneDeep(values) as any[];
        data.datasets[0].data = chdata;
        const max = Math.max.apply(Math, chdata);
        const min = Math.min.apply(Math, chdata);
        const maxY = Math.ceil(max + 1);
        const minY = Math.floor(min >= 1 || min < 0 ? min - 1 : min);
        this.stepY = (maxY - minY) / 2;
      }
      return data;
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
