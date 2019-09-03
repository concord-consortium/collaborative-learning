import * as React from "react";
import { Line } from "react-chartjs-2";
import { ChartOptions, ChartData, ChartDataSets } from "chart.js";
import { MAX_NODE_VALUES } from "./dataflow-program";
import { ChartPlotColors } from "./../utilities/node";
import "./dataflow-program-graph.sass";

export interface DataPoint {
    x: number;
    y: number;
}
export interface DataSequence {
  name: string;
  units: string;
  data: DataPoint[];
}
export interface DataSet {
  sequences: DataSequence[];
}

interface IProps {
  dataSet: DataSet;
}
interface IState {
  stacked: boolean;
  scatter: boolean;
}

export class DataflowProgramGraph extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      stacked: true,
      scatter: true,
    };
  }

  public handleLayoutClick = () => {
    const stacked = !this.state.stacked;
    this.setState({stacked});
  }
  public handleTypeClick = () => {
    const scatter = !this.state.scatter;
    this.setState({scatter});
  }

  public render() {
    return (
      <div className="program-graph" data-test="program-graph">
        { this.state.stacked
          ? this.renderStackedGraphs()
          : this.renderOverlappedGraphs()
        }
        <button className="graph-button layout" onClick={this.handleLayoutClick}>
          { this.state.stacked ? "overlap" : "stack" }
        </button>
        <button className="graph-button type" onClick={this.handleTypeClick}>
          { this.state.scatter ? "line" : "scatter" }
        </button>
      </div>
    );
  }

  public renderOverlappedGraphs() {
    const chartData = this.chartDataOverlapped();
    const chartOptions = this.chartOptions();
    return (
      <div className="overlapped-graph-container">
        <Line
          data={chartData}
          options={chartOptions}
          redraw={true}
        />
      </div>
    );
  }

  public renderStackedGraphs() {
    const chartDataStacked = this.chartDataStacked();
    const chartOptions = this.chartOptions();
    return (
      <div className="stacked-graph-container">
      {chartDataStacked.map((chartData: ChartData, index) => (
        <div className="stacked-graph" key={index}>
          <Line
            key={index}
            data={chartData}
            options={chartOptions}
            redraw={true}
          />
        </div>
      ))}
      </div>
    );
  }

  private chartDataStacked() {
    const chartDataSets: ChartDataSets[] = this.chartDataSets();
    const stackedCharts: ChartData[] = [];
    const numValues = chartDataSets && chartDataSets[0] && chartDataSets[0].data ? chartDataSets[0].data.length : 0;
    chartDataSets.forEach( (chartDataSet) => {
      const chartDataSetStacked: ChartDataSets[] = [];
      chartDataSetStacked.push(chartDataSet);
      const chartData: ChartData = {
        labels: Array.apply(null, {length: numValues}).map(Number.call, Number),
        datasets: chartDataSetStacked
      };
      stackedCharts.push(chartData);
    });
    return stackedCharts;
  }

  private chartDataOverlapped() {
    const chartDataSets: ChartDataSets[] = this.chartDataSets();
    const numValues = chartDataSets && chartDataSets[0] && chartDataSets[0].data ? chartDataSets[0].data.length : 0;
    const chartData: ChartData = {
      labels: Array.apply(null, {length: numValues}).map(Number.call, Number),
      datasets: chartDataSets
    };
    return chartData;
  }

  private chartDataSets() {
    const chartDataSets: ChartDataSets[] = [];
    const {dataSet} = this.props;
    if (dataSet) {
      dataSet.sequences.forEach((seq: DataSequence, i: number) => {
        const plotColor = ChartPlotColors[i % ChartPlotColors.length];
        const chartDataSet: ChartDataSets = {
          label: seq.name,
          backgroundColor: plotColor,
          borderColor: plotColor,
          borderWidth: 2,
          pointRadius: this.state.scatter ? 3 : 2,
          showLine: !this.state.scatter,
          lineTension: 0,
          data: [0],
          fill: false,
        };
        chartDataSets.push(chartDataSet);
        const chdata: any[] = [];
        seq.data.forEach((datapt: DataPoint) => {
          chdata.push(datapt.y);
        });
        chartDataSets[i].data = chdata;
      });
    }
    return chartDataSets;
  }

  private chartOptions() {
    const options: ChartOptions = {
      animation: {
        duration: 0
      },
      legend: {
        display: true,
        position: "bottom",
      },
      maintainAspectRatio: false,
      responsive: true,
      scales: {
        yAxes: [{
          id: "y-axis-0",
          type: "linear",
          ticks: {
            fontSize: 9,
            display: true,
            maxTicksLimit: 3,
            minRotation: 0,
            maxRotation: 0,
          },
          gridLines: {
            display: true
          }
        }],
        xAxes: [{
          id: "x-axis-0",
          ticks: {
            display: false,
          },
          gridLines: {
            display: true
          }
        }]
      },
    };
    return options;
  }

}
