import "@babel/polyfill"; // errors about missing `regeneratorRuntime` without this
import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import * as React from "react";
import Rete, { NodeEditor, Node, Input } from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ReactRenderPlugin from "rete-react-render-plugin";
import { autorun, observable } from "mobx";
import { SensorSelectControl } from "./nodes/controls/sensor-select-control";
import { RelaySelectControl } from "./nodes/controls/relay-select-control";
import { NumberReteNodeFactory } from "./nodes/factories/number-rete-node-factory";
import { MathReteNodeFactory } from "./nodes/factories/math-rete-node-factory";
import { TransformReteNodeFactory } from "./nodes/factories/transform-rete-node-factory";
import { LogicReteNodeFactory } from "./nodes/factories/logic-rete-node-factory";
import { SensorReteNodeFactory } from "./nodes/factories/sensor-rete-node-factory";
import { RelayReteNodeFactory } from "./nodes/factories/relay-rete-node-factory";
import { GeneratorReteNodeFactory } from "./nodes/factories/generator-rete-node-factory";
import { DataStorageReteNodeFactory } from "./nodes/factories/data-storage-rete-node-factory";
import { NodeChannelInfo, NodeGeneratorTypes, ProgramRunTimes, DEFAULT_PROGRAM_TIME } from "../utilities/node";
import { uploadProgram, fetchProgramData, deleteProgram } from "../utilities/aws";
import { PlotButtonControl } from "./nodes/controls/plot-button-control";
import { NumControl } from "./nodes/controls/num-control";
import { safeJsonParse } from "../../utilities/js-utils";
import { DataflowProgramToolbar } from "./dataflow-program-toolbar";
import { DataflowProgramTopbar } from "./dataflow-program-topbar";
import { DataflowProgramCover } from "./dataflow-program-cover";
import { SizeMeProps } from "react-sizeme";
import { ProgramZoomType } from "../models/tools/dataflow/dataflow-content";
import { DataflowProgramGraph, DataPoint, DataSequence, DataSet } from "./dataflow-program-graph";
import { DataflowProgramZoom } from "./dataflow-program-zoom";

import "./dataflow-program.sass";

interface NodeNameValuePair {
  name: string;
  val: number;
}
interface NodeValueMap {
  [key: string]: NodeNameValuePair;
}
type NodeValue = number | NodeValueMap;

interface NodeSequenceNameMap {
  [key: number]: string;
}

enum ProgramRunStates {
  Ready,
  Running,
  Complete
}

enum ProgramDisplayStates {
  Program,
  Graph,
  SideBySide
}

interface IProps extends SizeMeProps {
  modelId: string;
  readOnly?: boolean;
  program?: string;
  onProgramChange: (program: any) => void;
  onStartProgram: (title: string, id: string, startTime: number, endTime: number) => void;
  onSetProgramRunId: (id: string) => void;
  programRunId: string;
  onSetProgramStartTime: (time: number) => void;
  programStartTime: number;
  onSetProgramEndTime: (time: number) => void;
  programEndTime: number;
  onSetProgramStartEndTime: (startTime: number, endTime: number) => void;
  programRunTime: number;
  onProgramRunTimeChange: (programRunTime: number) => void;
  programZoom?: ProgramZoomType;
  onZoomChange: (dx: number, dy: number, scale: number) => void;
}

interface IState {
  disableDataStorage: boolean;
  programRunState: ProgramRunStates;
  programDisplayState: ProgramDisplayStates;
  graphDataSet: DataSet;
  editorContainerWidth: number;
}

const numSocket = new Rete.Socket("Number value");
const RETE_APP_IDENTIFIER = "dataflow@0.1.0";
export const MAX_NODE_VALUES = 16;
const HEARTBEAT_INTERVAL = 1000;
const MAX_ZOOM = 2;
const MIN_ZOOM = .1;

@inject("stores")
@observer
export class DataflowProgram extends BaseComponent<IProps, IState> {
  private toolDiv: HTMLElement | null;
  private channels: NodeChannelInfo[] = [];
  private sequenceNames: NodeSequenceNameMap;
  private intervalHandle: any;
  private programEditor: NodeEditor;
  private programEngine: any;
  private editorDomElement: HTMLElement | null;

  constructor(props: IProps) {
    super(props);
    this.state = {
      disableDataStorage: false,
      programRunState: ProgramRunStates.Ready,
      graphDataSet: { sequences: [], startTime: 0, endTime: 0 },
      editorContainerWidth: 0,
      programDisplayState: ProgramDisplayStates.Program
    };
  }

  public render() {
    const editorClass = `editor ${(this.isSideBySide() ? "half" : "full")} ${(this.isGraphOnly() && "hidden")}`;
    const isTesting = ["qa", "test"].indexOf(this.stores.appMode) >= 0;
    return (
      <div className="dataflow-program-container">
        <DataflowProgramTopbar
            onRunProgramClick={this.runProgram}
            onStopProgramClick={this.stopProgram}
            onProgramTimeSelectClick={this.setProgramRunTime}
            programRunTimes={ProgramRunTimes}
            programDefaultRunTime={this.props.programRunTime || DEFAULT_PROGRAM_TIME}
            isRunEnabled={this.isReady()}
            runningProgram={this.isRunning() && !this.props.readOnly}
            readOnly={this.props.readOnly || !this.isReady()}
        />
        <div className="toolbar-editor-container">
          { !this.isGraphOnly() && <DataflowProgramToolbar
            onNodeCreateClick={this.addNode}
            onResetClick={this.resetNodes}
            onClearClick={this.clearProgram}
            isTesting={isTesting}
            isDataStorageDisabled={this.state.disableDataStorage}
            disabled={this.props.readOnly || !this.isReady()}
          /> }
          <div className="editor-graph-container">
            <div
              className={editorClass}
              ref={(elt) => this.editorDomElement = elt}
            >
              <div className="flow-tool" ref={elt => this.toolDiv = elt} />
                <DataflowProgramZoom
                  onZoomInClick={this.zoomIn}
                  onZoomOutClick={this.zoomOut}
                  disabled={this.props.readOnly || !this.isReady()}
                />
                { (this.isSideBySide() || (!this.isReady() && this.isProgramOnly()) || this.props.readOnly) &&
                  <DataflowProgramCover sideBySide={this.isSideBySide()}/>
                }
            </div>
            {!this.isProgramOnly() &&
              <DataflowProgramGraph
                dataSet={this.state.graphDataSet}
                onToggleShowProgram={this.toggleShowProgram}
                programVisible={this.isSideBySide()}
              />
            }
          </div>
        </div>
      </div>
    );
  }

  public componentDidMount() {
    if (!this.programEditor && this.toolDiv) {
      this.initProgramEditor();
    }
  }

  public componentWillUnmount() {
    clearInterval(this.intervalHandle);
  }

  public componentDidUpdate(prevProps: IProps) {
    if (this.programEditor && this.programEditor.view) {
      if (this.editorDomElement && this.state.editorContainerWidth !== this.editorDomElement.clientWidth) {
        this.setState({ editorContainerWidth: this.editorDomElement.clientWidth });
        this.programEditor.view.resize();
      } else if (this.props.size !== prevProps.size) {
        this.programEditor.view.resize();
      }

      if ((this.props.modelId !== prevProps.modelId) ||
          (this.props.programRunId !== prevProps.programRunId)) {
        this.updateRunAndGraphStates();
      }
    }

    if (!this.programEditor && this.toolDiv) {
      this.initProgramEditor();
    }
  }

  private initProgramEditor = () => {
    (async () => {
      const components = [new NumberReteNodeFactory(numSocket),
        new MathReteNodeFactory(numSocket),
        new TransformReteNodeFactory(numSocket),
        new LogicReteNodeFactory(numSocket),
        new SensorReteNodeFactory(numSocket),
        new RelayReteNodeFactory(numSocket),
        new GeneratorReteNodeFactory(numSocket),
        new DataStorageReteNodeFactory(numSocket)];
      if (!this.toolDiv) return;

      this.programEditor = new Rete.NodeEditor(RETE_APP_IDENTIFIER, this.toolDiv);
      this.programEditor.use(ConnectionPlugin);
      this.programEditor.use(ReactRenderPlugin);

      this.programEngine = new Rete.Engine(RETE_APP_IDENTIFIER);

      components.map(c => {
        this.programEditor.register(c);
        this.programEngine.register(c);
      });

      const program = this.props.program && safeJsonParse(this.props.program);
      if (program) {
        const result = await this.programEditor.fromJSON(program);
        if (this.getNodeCount("Data Storage")) {
          this.setState({disableDataStorage: true});
        }
      }
      const { area } = this.programEditor.view;
      const { programZoom } = this.props;
      if (programZoom) {
        area.zoom(programZoom.scale, programZoom.dx, programZoom.dy, "wheel");
      }

      (this.programEditor as any).on(
        "process nodecreated noderemoved connectioncreated connectionremoved",
        async () => {
          await this.programEngine.abort();
          const programJSON = this.programEditor.toJSON();
          await this.programEngine.process(programJSON);
          if (!this.getNodeCount("Data Storage")) {
            this.setState({disableDataStorage: false});
          }
          this.props.onProgramChange(programJSON);
        }
      );

      this.programEditor.on("nodedraged", node => {
        this.props.onProgramChange(this.programEditor.toJSON());
      });

      this.programEditor.on("nodecreate", node => {
        // trigger after each of the first six events
        // add the current set of sensors or relays to node controls
        if (node.name === "Sensor") {
          const sensorSelect = node.controls.get("sensorSelect") as SensorSelectControl;
          sensorSelect.setChannels(this.channels);
        } else if (node.name === "Relay") {
          const relayList = node.controls.get("relayList") as RelaySelectControl;
          relayList.setChannels(this.channels);
        }
        return true;
      });

      // remove rete double click zoom
      this.programEditor.on("zoom", ({ source }) => {
        return false;
      });

      this.programEditor.on("translated", node => {
        const { transform } = this.programEditor.view.area;
        this.props.onZoomChange(transform.x, transform.y, transform.k);
      });

      // Can this be in a control with stores injected?
      autorun(() => {
        const { hubStore } = this.stores;
        // remove any channels that are no longer active
        this.channels = this.channels.filter(ch => {
          const hub = hubStore.hubs.get(ch.hubId);
          return hub && hub.hubChannels.find(hCh => hCh.id = ch.channelId);
        });

        hubStore.hubs.forEach(hub => {
          hub.hubChannels.forEach(ch => {
            // add channel if it is new
            if (!this.channels.find( ci => ci.hubId === hub.hubId && ci.channelId === ch.id )) {
              const nci: NodeChannelInfo = {hubId: hub.hubId,
                                            hubName: hub.hubName,
                                            channelId: ch.id,
                                            type: ch.type,
                                            units: ch.units,
                                            plug: ch.plug,
                                            value: Number(ch.value)};
              this.channels.push(nci);
            }
            // store sensor value for channel
            const chValue = Number.parseFloat(ch.value);
            const chInfo = this.channels.find(ci => ci.channelId === ch.id);
            if (chInfo && Number.isFinite(chValue)) {
              chInfo.value = chValue;
            }
          });
        });
      });

      this.programEditor.view.resize();
      this.programEditor.trigger("process");

      this.updateRunAndGraphStates();

      if (!this.props.readOnly && !this.isComplete()) {
        this.intervalHandle = setInterval(this.heartBeat, HEARTBEAT_INTERVAL);
      }

    })();
  }

  private updateRunAndGraphStates() {
    const programRunState: ProgramRunStates = this.getRunState();
    const hasDataStorage = this.getNodeCount("Data Storage") > 0;
    const programDisplayState = (programRunState !== ProgramRunStates.Ready) && hasDataStorage
                                  ? programRunState === ProgramRunStates.Running
                                                        ? ProgramDisplayStates.SideBySide
                                                        : ProgramDisplayStates.Graph
                                  : ProgramDisplayStates.Program;
    this.setState({ programRunState, programDisplayState });
    this.updateGraphDataSet();
    this.sequenceNames = this.getNodeSequenceNames();
  }

  private getRunState = () => {
    if (this.props.programRunId) {
      return (this.props.programEndTime > Date.now() ? ProgramRunStates.Running : ProgramRunStates.Complete);
    } else {
      return ProgramRunStates.Ready;
    }
  }

  private isReady = () => {
    return (this.state.programRunState === ProgramRunStates.Ready);
  }

  private isRunning = () => {
    return (this.state.programRunState === ProgramRunStates.Running);
  }

  private isComplete = () => {
    return (this.state.programRunState === ProgramRunStates.Complete);
  }

  private isProgramOnly = () => {
    return (this.state.programDisplayState === ProgramDisplayStates.Program);
  }

  private isGraphOnly = () => {
    return (this.state.programDisplayState === ProgramDisplayStates.Graph);
  }

  private isSideBySide = () => {
    return (this.state.programDisplayState === ProgramDisplayStates.SideBySide);
  }

  private toggleShowProgram = () => {
    const programDisplayState = this.state.programDisplayState === ProgramDisplayStates.SideBySide
                                ? ProgramDisplayStates.Graph
                                : ProgramDisplayStates.SideBySide;
    this.setState({programDisplayState});
    // process is needed or rete doesn't redrawn node connections when showing editor
    (async () => {
      await this.programEngine.abort();
      await this.programEngine.process(this.programEditor.toJSON());
    })();
  }

  private hasValidOutputNodes = () => {
    const { ui } = this.stores;
    if (!this.getNodeCount("Relay") && !this.getNodeCount("Data Storage")) {
      ui.alert("Program must contain a Relay or Data Storage node before it can be run.", "No Program Output");
      return false;
    } else if (!this.getNodeCount("Relay") &&
                this.programEditor.nodes.filter(n => (n.name === "Data Storage" && n.inputs.size <= 1)).length) {
      ui.alert("Data Storage node needs data inputs before program can be run.", "Missing Data Storage Inputs");
      return false;
    }
    return true;
  }

  private runProgram = () => {
    if (!this.hasValidOutputNodes()) {
      return;
    }
    const programData: any = this.generateProgramData();
    uploadProgram(programData);
    this.sequenceNames = this.getNodeSequenceNames();
    this.setState({programRunState: ProgramRunStates.Running,
                   programDisplayState: ProgramDisplayStates.Graph});
  }
  private stopProgram = () => {
    deleteProgram(this.props.programEndTime);
    const programEndTime = Date.now();
    this.props.onSetProgramEndTime(programEndTime);
    const hasDataStorage = this.getNodeCount("Data Storage") > 0;
    const programDisplayState = hasDataStorage ? ProgramDisplayStates.Graph : ProgramDisplayStates.Program;
    this.setState({programRunState: ProgramRunStates.Complete, programDisplayState});
  }
  private setProgramRunTime = (time: number) => {
    this.props.onProgramRunTimeChange(time);
  }
  private generateProgramData = () => {
    const { ui } = this.stores;
    let missingRelay = false;
    let missingSensor = false;
    let interval: number =  1;
    let datasetName = "";
    const programStartTime = Date.now();
    const programName = "dataflow-program-" + programStartTime;
    const programEndTime = programStartTime + (1000 * this.props.programRunTime);

    const hubs: string[] = [];
    const sensors: string[] = [];
    this.programEditor.nodes.forEach((n: Node) => {
      if (n.name === "Sensor" && n.data.sensor) {
        const chInfo = this.channels.find(ci => ci.channelId === n.data.sensor);
        if (chInfo) {
          // only add hubs once
          if (hubs.indexOf(chInfo.hubId) === -1) {
            hubs.push(chInfo.hubId);
          }
          if (sensors.indexOf(chInfo.channelId) === -1) {
            // only add sensors once
            sensors.push(chInfo.channelId);
          }
        } else if (!chInfo && n.data.sensor !== "none") {
          missingSensor = true;
        }
      } else if (n.name === "Relay" && n.data.relayList) {
        const chInfo = this.channels.find(ci => ci.channelId === n.data.relayList);
        if (chInfo) {
          if (hubs.indexOf(chInfo.hubId) === -1) {
            hubs.push(chInfo.hubId);
          }
        } else if (!chInfo && n.data.relayList !== "none") {
          missingRelay = true;
        }
      } else if (n.name === "Data Storage") {
        interval = n.data.interval as number;
        datasetName = `${n.data.datasetName as string}-${programStartTime}`;
      }
    });

    if (missingRelay) {
      ui.alert("Selected relay cannot be found. Try plugging your relay in.", "Relay Not Found");
      return;
    } else if (missingSensor) {
      ui.alert("Selected sensor cannot be found. Try plugging your sensor in.", "Sensor Not Found");
      return;
    }

    const rawProgram = this.programEditor.toJSON();
    // strip out recentValues for each node - not needed on the server
    const editedProgram = {
      id: rawProgram.id,
      nodes: Object.assign({}, rawProgram.nodes)
    };
    if (rawProgram.nodes) {
      for (const node of Object.values(rawProgram.nodes)) {
        const newNode = Object.assign({}, node);
        const nodeData = Object.assign({}, node.data);
        if (nodeData.recentValues) delete nodeData.recentValues;
        newNode.data = nodeData;
        if (newNode.position) delete newNode.position;
        editedProgram.nodes[newNode.id] = newNode;
      }
    }

    const programData = {
      program: {
        endTime: programEndTime,
        hubs,
        program: editedProgram,
        programId: programName,
        runInterval: interval * 1000,
        sensors
      }
    };

    this.props.onStartProgram(datasetName, programName, programStartTime, programEndTime);

    return programData;
  }

  private addNode = async (nodeType: string) => {
    const nodeFactory = this.programEditor.components.get(nodeType) as any;
    const n1 = await nodeFactory!.createNode();

    const numNodes = this.programEditor.nodes.length;
    n1.position = [5 + Math.floor((numNodes % 20) / 5) * 245 + Math.floor(numNodes / 20) * 15, 5 + numNodes % 5 * 90];
    this.programEditor.addNode(n1);
    if (nodeType === "Data Storage") {
      this.setState({disableDataStorage: true});
    }
  }
  private clearProgram = () => {
    this.programEditor.clear();
    this.setState({disableDataStorage: false});
  }
  private resetNodes = () => {
    this.programEditor.nodes.forEach((n: Node) => {
      if (n.data.recentValues) {
        let values: any = n.data.recentValues;
        values = [];
        n.data.recentValues = values;
        if (n.data.ticks) {
          n.data.ticks = 0;
        }
      }
    });
  }

  private getNodeCount = (type?: string) => {
    return (type ? this.programEditor.nodes.filter(n => (n.name === type)).length : this.programEditor.nodes.length);
  }

  private heartBeat = () => {
    const nodeProcessMap: { [name: string]: (n: Node) => void } = {
            Generator: this.updateGeneratorNode,
            Sensor: (n: Node) => {
                      this.updateNodeChannelInfo(n);
                      this.updateNodeSensorValue(n);
                    },
            Relay: this.updateNodeChannelInfo
          };

    let processNeeded = false;
    this.programEditor.nodes.forEach((n: Node) => {
      const nodeProcess = nodeProcessMap[n.name];
      if (nodeProcess) {
        processNeeded = true;
        nodeProcess(n);
      }
      if (n.data.hasOwnProperty("nodeValue")) {
        this.updateNodeRecentValues(n);
      }
    });
    if (this.isRunning() && this.props.programRunId) {
      this.updateGraphDataSet();
    }
    if (processNeeded) {
        // if we've updated values on 1 or more nodes (such as a generator),
        // we need to abort any current processing and reprocess all
        // nodes so current values are up to date
      (async () => {
        await this.programEngine.abort();
        await this.programEngine.process(this.programEditor.toJSON());
      })();
    }
    this.updateRunState();
  }

  private updateNodeChannelInfo = (n: Node) => {
    const sensorSelect = n.controls.get("sensorSelect") as SensorSelectControl;
    const relayList = n.controls.get("relayList") as RelaySelectControl;
    if (sensorSelect) {
      sensorSelect.setChannels(this.channels);
      (sensorSelect as any).update();
    }
    if (relayList) {
      relayList.setChannels(this.channels);
      (relayList as any).update();
    }
  }

  private updateNodeSensorValue = (n: Node) => {
    const sensorSelect = n.controls.get("sensorSelect") as SensorSelectControl;
    if (sensorSelect && !this.isComplete()) {
      const chInfo = this.channels.find(ci => ci.channelId === n.data.sensor);
      if (chInfo && chInfo.value) {
        sensorSelect.setSensorValue(chInfo.value);
      }
    }
  }

  private updateNodeRecentValues = (n: Node) => {
    const nodeValue: any = n.data.nodeValue;
    let recentValue: NodeValue = {};
    const nodeValueKey = "nodeValue";
    // Store recentValue as object with unique keys for each value stored in node
    // Needed for node types such as data storage that require more than a single value
    typeof nodeValue === "number" ?
      recentValue[nodeValueKey] = { name: n.name, val: nodeValue }
      : recentValue = nodeValue;
    if (n.data.recentValues) {
      const recentValues: any = n.data.recentValues;
      if (recentValues.length > MAX_NODE_VALUES) {
        recentValues.shift();
      }
      recentValues.push(recentValue);
      n.data.recentValues = recentValues;
    } else {
      const recentValues: NodeValue[] = [recentValue];
      n.data.recentValues = recentValues;
    }
    const plotControl = n.controls.get("plot") as PlotButtonControl;
    if (plotControl) {
      (n as any).update();
    }
  }

  private getNodeSequenceNames = () => {
    // returns a mapping of input block ids to user-specified sequence names
    const sequenceNames: NodeSequenceNameMap = {};
    this.programEditor.nodes.forEach((n: Node) => {
      if (n.name === "Data Storage" && n.inputs) {
        Array.from(n.inputs.values()).forEach((inp: Input) => {
          const nodeId = inp.connections && inp.connections[0] && inp.connections[0].output &&
                         inp.connections[0].output.node && inp.connections[0].output.node.id;
          const sequenceName: unknown = n.data[inp.key.replace("num", "sequence")];
          if (nodeId && typeof sequenceName === "string") {
            sequenceNames[nodeId] = sequenceName;
          }
        });
      }
    });
    return sequenceNames;
  }

  private updateGraphDataSet = () => {
    if (this.props.programRunId) {
      fetchProgramData(this.props.programRunId).then((result: any) => {
        // make a new dataset
        const graphDataSet: DataSet = {
          sequences: [],
          startTime: this.props.programStartTime,
          endTime: this.props.programEndTime
        };
        if (result.data) {
          result.data.forEach((timeData: any) => {
            timeData.values.forEach((value: any, i: number) => {
              if (graphDataSet.sequences.length < (i + 1)) {
                const name = this.sequenceNames[timeData.blockIds[i]];
                const graphSequence: DataSequence = { name: name || timeData.blockIds[i], units: "my-units", data: [] };
                graphDataSet.sequences.push(graphSequence);
              }
              const pt: DataPoint = { x: 0, y: 0 };
              pt.x = timeData.time;
              pt.y = value;
              graphDataSet.sequences[i].data.push(pt);
            });
          });
          this.setState({ graphDataSet });
        }
      });
    }
  }

  private updateGeneratorNode = (n: Node) => {
    const generatorType = n.data.generatorType;
    const period = Number(n.data.period);
    const amplitude = Number(n.data.amplitude);
    let ticks: any = n.data.ticks || 0;
    const nodeGeneratorType = NodeGeneratorTypes.find(gt => gt.name === generatorType);
    if (nodeGeneratorType && period && amplitude) {
      ticks = ticks + 1;
      n.data.ticks = ticks;
      const prevVal: any = n.data.nodeValue || 0;
      const val = nodeGeneratorType.method(ticks, period, amplitude, prevVal);
      const nodeValue = n.controls.get("nodeValue") as NumControl;
      if (nodeValue) {
        nodeValue.setValue(val);
      }
    }
  }

  private updateRunState = () => {
    if (this.isRunning()) {
      if (this.props.programEndTime && (Date.now() >= this.props.programEndTime)) {
        const hasDataStorage = this.getNodeCount("Data Storage") > 0;
        const programDisplayState = hasDataStorage ? ProgramDisplayStates.Graph : ProgramDisplayStates.Program;
        this.setState({programRunState: ProgramRunStates.Complete, programDisplayState});
      }
    }
  }

  private zoomIn = () => {
    const { k } = this.programEditor.view.area.transform;
    this.setZoom(Math.min(MAX_ZOOM, k + .05));
  }

  private zoomOut = () => {
    const { k } = this.programEditor.view.area.transform;
    this.setZoom(Math.max(MIN_ZOOM, k - .05));
  }

  private setZoom = (zoom: number) => {
    const currentTransform = this.programEditor.view.area.transform;
    this.programEditor.view.area.transform = {k: zoom, x: currentTransform.x, y: currentTransform.y};
    this.programEditor.view.area.update();
    const { transform } = this.programEditor.view.area;
    this.props.onZoomChange(transform.x, transform.y, transform.k);
  }

}
