import * as React from "react";
import { Line } from "react-chartjs-2";
import { ChartOptions, ChartData, ChartDataSets } from "chart.js";
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
  startTime: number;
  endTime: number;
}

interface IProps {
  dataSet: DataSet;
  onToggleShowProgram: () => void;
  programVisible: boolean;
}
interface IState {
  stacked: boolean;
  scatter: boolean;
  allData: boolean;
}

export class DataflowProgramGraph extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      stacked: true,
      scatter: true,
      allData: true,
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
  public handleDataModeClick = () => {
    const allData = !this.state.allData;
    this.setState({allData});
  }
  public handleShowProgramClick = () => {
    this.props.onToggleShowProgram();
  }

  public render() {
    const graphClass = `program-graph ${(!this.props.programVisible && "full")}`;
    return (
      <div className={graphClass} data-test="program-graph">
        { this.state.stacked
          ? this.renderStackedGraphs()
          : this.renderOverlappedGraphs()
        }
        <button className="graph-button program" onClick={this.handleShowProgramClick}>
          { this.props.programVisible ? "graph" : "program" }
        </button>
        <button className="graph-button type" onClick={this.handleTypeClick}>
          { this.state.scatter ? "line" : "scatter" }
        </button>
        <button className="graph-button layout" onClick={this.handleLayoutClick}>
          { this.state.stacked ? "overlap" : "stack" }
        </button>
        <button className="graph-button data" onClick={this.handleDataModeClick}>
          { this.state.allData ? "current data" : "all data" }
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
    const {dataSet} = this.props;
    const chartDataSets: ChartDataSets[] = this.chartDataSets();
    const stackedCharts: ChartData[] = [];
    chartDataSets.forEach( (chartDataSet, i) => {
      const axisLabels: string[] = [];
      dataSet.sequences[i].data.forEach( (dataPoint) => {
        axisLabels.push(new Date(dataPoint.x).toISOString());
      });
      const chartDataSetStacked: ChartDataSets[] = [];
      chartDataSetStacked.push(chartDataSet);
      const chartData: ChartData = {
        labels: axisLabels,
        datasets: chartDataSetStacked
      };
      stackedCharts.push(chartData);
    });
    return stackedCharts;
  }

  private chartDataOverlapped() {
    const {dataSet} = this.props;
    const chartDataSets: ChartDataSets[] = this.chartDataSets();
    const axisLabels: string[] = [];
    dataSet.sequences[0].data.forEach( (dataPoint) => {
      axisLabels.push(new Date(dataPoint.x).toISOString());
    });
    const chartData: ChartData = {
      labels: axisLabels,
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
          pointRadius: 2,
          showLine: !this.state.scatter,
          lineTension: 0,
          data: [0],
          fill: false,
        };
        chartDataSets.push(chartDataSet);
        const chdata: any[] = [];
        seq.data.forEach((datapt: DataPoint) => {
          // note: chart.js will take the raw number value but throws a deprecation warning
          // convert to Date or moment to eliminate warning
          chdata.push({t: new Date(datapt.x), y: datapt.y });
        });
        chartDataSets[i].data = chdata;
      });
    }
    return chartDataSets;
  }

  private chartOptions() {
    const {dataSet} = this.props;
    let dataMin = 0;
    let dataMax = 0;
    if (this.state.allData) {
      dataMin = this.props.dataSet ? this.props.dataSet.startTime : 0;
      dataMax = this.props.dataSet ? this.props.dataSet.endTime : 0;
    } else {
      if (dataSet.sequences.length) {
        dataMin = dataSet.sequences[0].data[0].x;
        dataMax = dataSet.sequences[0].data[dataSet.sequences[0].data.length - 1].x;
      }
    }
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
            maxTicksLimit: 5,
            minRotation: 0,
            maxRotation: 0,
          },
          gridLines: {
            display: true
          }
        }],
        xAxes: [{
          id: "x-axis-0",
          type: "time",
          distribution: "linear",
          ticks: {
            source: "auto",
            fontSize: 9,
            display: true,
            minRotation: 0,
            maxRotation: 0,
          },
          time: {
            min: new Date(dataMin).toISOString(),
            max: new Date(dataMax).toISOString(),
          },
          scaleLabel: {
            display: true,
            labelString: "Time"
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
