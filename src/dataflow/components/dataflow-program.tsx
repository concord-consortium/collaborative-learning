import "@babel/polyfill"; // errors about missing `regeneratorRuntime` without this
import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import * as React from "react";
import Rete, { NodeEditor, Node } from "rete";
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
import { uploadProgram } from "../utilities/aws";
import { PlotControl } from "./nodes/controls/plot-control";
import { NumControl } from "./nodes/controls/num-control";
import { safeJsonParse } from "../../utilities/js-utils";
import { DataflowProgramToolbar } from "./dataflow-program-toolbar";
import { DataflowProgramTopbar } from "./dataflow-program-topbar";
import "./dataflow-program.sass";

interface NodeNameValuePair {
  name: string;
  val: number;
}
interface NodeValueMap {
  [key: string]: NodeNameValuePair;
}
type NodeValue = number | NodeValueMap;

interface IProps extends IBaseProps {
  program?: string;
}

interface IState {
  disableDataStorage: boolean;
  programRunTime: number;
  isProgramRunning: boolean;
}

const numSocket = new Rete.Socket("Number value");
const RETE_APP_IDENTIFIER = "dataflow@0.1.0";
export const MAX_NODE_VALUES = 16;
const HEARTBEAT_INTERVAL = 1000;

@inject("stores")
@observer
export class DataflowProgram extends BaseComponent<IProps, IState> {
  private toolDiv: HTMLElement | null;
  private channels: NodeChannelInfo[] = [];
  private intervalHandle: any;
  private programEditor: NodeEditor;
  private programEngine: any;

  constructor(props: IProps) {
    super(props);
    this.state = {
      disableDataStorage: false,
      programRunTime: DEFAULT_PROGRAM_TIME,
      isProgramRunning: false
    };
  }

  public render() {
    return (
      <div className="program-editor-container">
        <div className="vertical-container">

          <DataflowProgramTopbar
            onRunProgramClick={this.runProgram}
            onStopProgramClick={this.stopProgram}
            onProgramTimeSelectClick={this.setProgramRunTime}
            programRunTimes={ProgramRunTimes}
            programDefaultRunTime={DEFAULT_PROGRAM_TIME}
            isRunEnabled={this.state.isProgramRunning}
          />

          <div className="horizontal-container">
            <DataflowProgramToolbar
              onNodeCreateClick={this.addNode}
              onDeleteClick={this.deleteSelectedNodes}
              onResetClick={this.resetNodes}
              onClearClick={this.clearProgram}
              isDataStorageDisabled={this.state.disableDataStorage}
            />
            <div className="full">
              <div className="flow-tool" ref={elt => this.toolDiv = elt} />
            </div>
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

  public componentDidUpdate() {
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

      (this.programEditor as any).on(
        "process nodecreated noderemoved connectioncreated connectionremoved",
        async () => {
          await this.programEngine.abort();
          await this.programEngine.process(this.programEditor.toJSON());
        }
      );

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
        return source !== "dblclick";
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

      this.intervalHandle = setInterval(this.heartBeat, HEARTBEAT_INTERVAL);

    })();
  }

  private runProgram = () => {
    const programData: any = this.generateProgramData();
    uploadProgram(programData);
    this.setState({isProgramRunning: true});
  }
  private stopProgram = () => {
    this.setState({isProgramRunning: false});
  }
  private setProgramRunTime = (time: number) => {
    this.setState({programRunTime: time});
  }
  private generateProgramData = () => {
    let programName: any = "my-program";
    let interval: any =  1000;
    const endTimePad = 24 * 60 * 60 * 1000;
    const newTimestamp = Date.now() + endTimePad;
    const hubs: string[] = [];
    const sensors: string[] = [];
    this.programEditor.nodes.forEach((n: Node) => {
      if (n.name === "Sensor" && n.data.sensor) {
        const chInfo = this.channels.find(ci => ci.channelId === n.data.sensor);
        if (chInfo) {
          hubs.push(chInfo.hubId);
          sensors.push(`${chInfo.hubId}_${chInfo.channelId}`);
        }
      } else if (n.name === "Data Storage") {
        programName = n.data.datasetName;
        interval = n.data.interval;
      }
    });
    const program = this.programEditor.toJSON();
    const programData = {
      program: {
        endTime: newTimestamp,
        hubs,
        program: program,
        programId: programName,
        runInterval: interval * 1000,
        sensors
      }
    };
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
  private deleteSelectedNodes = () => {
    const selectedNodes = this.programEditor.selected.list.slice();
    this.programEditor.selected.clear();
    selectedNodes.forEach((n: Node) => {
      if (n.name === "Data Storage") {
        this.setState({disableDataStorage: false});
      }
      this.programEditor.removeNode(n);
    });
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
    if (processNeeded) {
        // if we've updated values on 1 or more nodes (such as a generator),
        // we need to abort any current processing and reprocess all
        // nodes so current values are up to date
      (async () => {
        await this.programEngine.abort();
        await this.programEngine.process(this.programEditor.toJSON());
      })();
    }
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
    if (sensorSelect) {
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
    const plotControl = n.controls.get("plot") as PlotControl;
    if (plotControl) {
      (plotControl as any).update();
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

}
