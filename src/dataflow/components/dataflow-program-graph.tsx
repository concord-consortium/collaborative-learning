import * as React from "react";
import { Line } from "react-chartjs-2";
import { ChartOptions, ChartData, ChartDataSets, Chart } from "chart.js";
import { SplitViewButtons } from "./split-view-buttons";
import { ChartPlotColors } from "./../utilities/node";
import { exportCSV } from "../utilities/export";
import { isEqual } from "lodash";
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

export enum ProgramDisplayStates {
  Program,    // 100% program -- editable program only
  Graph,      // 100% graph -- dataset document only
  Graph80,    //  80% graph -- dataset document only
  SideBySide  //  50% graph -- dataset document only
}

interface IProps {
  dataSet: DataSet;
  programDisplayState: ProgramDisplayStates;
  onClickSplitLeft?: () => void;
  onClickSplitRight?: () => void;
  onShowOriginalProgram: () => void;
}
interface IState {
  stacked: boolean;
  scatter: boolean;
  fullRun: boolean;
  dataSetHidden: boolean[];
}

export class DataflowProgramGraph extends React.Component<IProps, IState> {
  private graphContainerRef = React.createRef<HTMLDivElement>();
  constructor(props: IProps) {
    super(props);
    this.state = {
      stacked: true,
      scatter: true,
      fullRun: true,
      dataSetHidden: Array(this.props.dataSet.sequences.length).fill(false),
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
    const fullRun = !this.state.fullRun;
    this.setState({fullRun});
  }
  public handleExport = () => {
    const {dataSet} = this.props;
    exportCSV(dataSet.sequences);
  }

  public handleExportImage = () => {
    const node = this.graphContainerRef.current;
    // only get children of component container to avoid other graphs (thumbnails, 2-up)
    const charts = node && node.getElementsByClassName("chartjs-render-monitor");
    if (charts && charts.length) {
      let destHeight = 0;
      let destWidth = 0;
      Array.from(charts).forEach((chart, index) => {
        const src = chart as HTMLCanvasElement;
        destHeight += src.height;
        destWidth = Math.max(destWidth, src.width);
      });

      // create canvas to stitch together multiple graphs and display background color
      const destinationCanvas = document.createElement("canvas");
      destinationCanvas.width = destWidth;
      destinationCanvas.height = destHeight;
      const destCtx = destinationCanvas.getContext("2d");
      if (destCtx) {
        destCtx.fillStyle = "#FFFFFF";
        destCtx.fillRect(0, 0, destWidth, destHeight);
        // draw each graph canvas onto the destination canvas
        let currY = 0;
        Array.from(charts).forEach((chart, index) => {
          const src = chart as HTMLCanvasElement;
          destCtx.drawImage(src, 0, currY);
          currY += src.height;
        });
      }
      const image = destinationCanvas.toDataURL("image/jpg");
      const imageFilename = "dataflow-image-" + Date.now() + ".jpg";
      const link = document.createElement("a");
      link.href = image;
      link.setAttribute("download", imageFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  public shouldComponentUpdate(nextProps: IProps, nextState: IState) {
    if (!isEqual(nextState.dataSetHidden, this.state.dataSetHidden)) {
      // prevent render since allowing render after setting hidden state throws error:
      // Uncaught TypeError: Cannot read property 'clearRect' of null
      return false;
    }
    return true;
  }

  public render() {
    const { dataSet, programDisplayState } = this.props;
    const graphClass = programDisplayState === ProgramDisplayStates.Graph
                        ? "full"
                        : (programDisplayState === ProgramDisplayStates.Graph80
                            ? "most"
                            : "half");
    const wideClass = programDisplayState === ProgramDisplayStates.Graph ? "wide" : "";
    return (
      <div className={`program-graph ${graphClass}`} data-test="program-graph">
        {dataSet.sequences.length === 0 && <div className="graph-loading" />}
        { this.state.stacked
          ? this.renderStackedGraphs()
          : this.renderOverlappedGraphs()
        }
        <SplitViewButtons splitClass={graphClass}
                          onClickSplitLeft={this.props.onClickSplitLeft}
                          onClickSplitRight={this.props.onClickSplitRight} />
        <div className="graph-buttons">
          {
            this.props.onShowOriginalProgram &&
              <button className={`graph-button show-original ${wideClass}`}
                      onClick={this.props.onShowOriginalProgram} />
          }
          {this.props.programDisplayState !== ProgramDisplayStates.Graph
            ? <button className="graph-button export" onClick={this.handleExport}>Export (csv)</button>
            : <button className="graph-button export wide" onClick={this.handleExport}>Export Data (csv)</button>
          }
          <button className="graph-button export" onClick={this.handleExportImage}>Export Image</button>
          <button className="graph-button data" onClick={this.handleDataModeClick}>
            { this.state.fullRun ? "All Data" : "Full Run" }
          </button>
          <button className="graph-button layout" onClick={this.handleLayoutClick}>
            { this.state.stacked ? "Combined" : "Stacked" }
          </button>
          <button className="graph-button type" onClick={this.handleTypeClick}>
            { this.state.scatter ? "Line" : "Scatter" }
          </button>
        </div>
      </div>
    );
  }

  public renderOverlappedGraphs() {
    const chartData = this.chartDataOverlapped();
    return (
      <div className="overlapped-graph-container" ref={this.graphContainerRef}>
        <Line
          data={chartData}
          options={this.chartOptions(0)}
          redraw={true}
        />
      </div>
    );
  }

  public renderStackedGraphs() {
    const chartDataStacked = this.chartDataStacked();
    return (
      <div className="stacked-graph-container" ref={this.graphContainerRef}>
      {chartDataStacked.map((chartData: ChartData, index) => (
        <div className="stacked-graph" key={index}>
          <Line
            key={index}
            data={chartData}
            options={this.chartOptions(index)}
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
          hidden: this.state.dataSetHidden[i],
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

  private setDataSetHiddenState(i: number, hidden: boolean) {
    const dataSetHidden = this.state.dataSetHidden.slice();
    dataSetHidden[i] = hidden;
    this.setState({dataSetHidden});
  }

  private chartOptions(indexOffset: number) {
    const {dataSet} = this.props;
    const setDataSetHidden = (i: number, hidden: boolean) => {
      this.setDataSetHiddenState(i, hidden);
    };

    let dataMin = 0;
    let dataMax = 0;
    if (this.state.fullRun) {
      dataMin = this.props.dataSet ? this.props.dataSet.startTime : 0;
      dataMax = this.props.dataSet ? this.props.dataSet.endTime : 0;
      // final point might be greater than end time
      if (dataSet.sequences.length) {
        dataMax = Math.max(dataMax, dataSet.sequences[0].data[dataSet.sequences[0].data.length - 1].x);
      }
    } else {
      if (dataSet.sequences.length) {
        dataMin = dataSet.sequences[0].data[0].x;
        dataMax = dataSet.sequences[0].data[dataSet.sequences[0].data.length - 1].x;
      }
    }

    // By default, Chart.js often leaves the first vertical gridline unlabeled, even when there
    // is room for such a label. This function allows us to post-process the rendered ticks to
    // add the "missing" tick/label if there is room for it.
    function afterBuildTicks(axis: any, ticks: any): any {
      if ((axis?.type === "time") && (ticks?.length > 2)) {
        const tick0Value = ticks[0].value;
        const tickDiff = ticks[1].value - tick0Value;
        // only add the new tick if there's room
        if (dataMin < tick0Value - tickDiff / 2) {
          const _ticks = ticks.slice();
          _ticks.unshift({ value: tick0Value - tickDiff, major: false });
          return _ticks;
        }
      }
      return ticks;
    }
    // cast to any to override incorrect type declaration for afterBuildTicks() in @types/chart.js
    const _afterBuildTicks = afterBuildTicks as any;

    const options: ChartOptions = {
      animation: {
        duration: 0
      },
      legend: {
        display: true,
        position: "bottom",
        labels: {
          usePointStyle: true,
          boxWidth: 6,
          fontSize: 12,
          fontFamily: "'Ubuntu', 'Arial', sans-serif"
        },
        // TODO: this approach detects the legend click and then keeps
        // track of which dataset sequence is shown/hidden in the component state.
        // to prevents error, we must also stop thge subsequent render in shouldComponentUpdate.
        // in the future, we should investigate an alternative approach that doesn't require
        // keeping track of chart.js state in our component state.
        onClick(e, legendItem) {
          if (!legendItem?.datasetIndex) return;
          const index = legendItem.datasetIndex + indexOffset;
          const defaultLegendClickHandler = Chart.defaults.global.legend && Chart.defaults.global.legend.onClick;
          if (defaultLegendClickHandler) {
            defaultLegendClickHandler.call(this, e, legendItem);
          }
          if (legendItem.hidden !== undefined) {
            setDataSetHidden(index, !legendItem.hidden);
          }
        }
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
            min: new Date(dataMin).toISOString(),
            max: new Date(dataMax).toISOString(),
            source: "auto",
            fontSize: 9,
            display: true,
            minRotation: 0,
            maxRotation: 0,
          },
          scaleLabel: {
            display: true,
            labelString: "Time",
            fontSize: 12,
            fontFamily: "'Ubuntu', 'Arial', sans-serif"
          },
          gridLines: {
            display: true
          },
          afterBuildTicks: _afterBuildTicks
        }]
      },
    };
    return options;
  }
}
