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
import { NodeChannelInfo, NodeGeneratorTypes } from "../utilities/node";
import { PlotControl } from "./nodes/controls/plot-control";
import { NumControl } from "./nodes/controls/num-control";
import { safeJsonParse } from "../../utilities/js-utils";
import { DataflowProgramToolbar } from "./dataflow-program-toolbar";
import "./dataflow-program.sass";

interface IProps extends IBaseProps {
  program?: string;
}

interface IState {}

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

  public render() {
    return (
      <div className="editor-container">
        <DataflowProgramToolbar
          onNodeCreateClick={this.addNode}
          onDeleteClick={this.deleteSelectedNodes}
          onResetClick={this.resetNodes}
          onClearClick={this.clearProgram}
        />
        <div className="flow-tool" ref={elt => this.toolDiv = elt} />
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
        new GeneratorReteNodeFactory(numSocket)];

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

  private addNode = async (nodeType: string) => {
    const nodeFactory = this.programEditor.components.get(nodeType) as any;
    const n1 = await nodeFactory!.createNode();

    const numNodes = this.programEditor.nodes.length;
    n1.position = [100 + Math.floor(numNodes / 10) * 200 + numNodes % 10 * 15, 5 + numNodes % 10 * 15];
    this.programEditor.addNode(n1);
  }
  private clearProgram = () => {
    this.programEditor.clear();
  }
  private deleteSelectedNodes = () => {
    const selectedNodes = this.programEditor.selected.list.slice();
    this.programEditor.selected.clear();
    selectedNodes.forEach((n: Node) => {
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
    const val: any = n.data.nodeValue;
    if (n.data.recentValues) {
      const values: any = n.data.recentValues;
      if (values.length > MAX_NODE_VALUES) {
        values.shift();
      }
      values.push(val);
      n.data.recentValues = values;
    } else {
      const values: number[] = [val];
      n.data.recentValues = values;
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
