import "@babel/polyfill"; // errors about missing `regeneratorRuntime` without this
import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import * as React from "react";
import Rete, { NodeEditor, Node } from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ReactRenderPlugin from "rete-react-render-plugin";
import ContextMenuPlugin from "rete-context-menu-plugin";
import { autorun, observable } from "mobx";
import "./dataflow-program.sass";
import { SensorSelectControl } from "./nodes/controls/sensor-select-control";
import { RelaySelectControl } from "./nodes/controls/relay-select-control";
import { NumberReteNodeFactory } from "./nodes/factories/number-rete-node-factory";
import { MathReteNodeFactory } from "./nodes/factories/math-rete-node-factory";
import { TransformReteNodeFactory } from "./nodes/factories/transform-rete-node-factory";
import { LogicReteNodeFactory } from "./nodes/factories/logic-rete-node-factory";
import { SensorReteNodeFactory } from "./nodes/factories/sensor-rete-node-factory";
import { RelayReteNodeFactory } from "./nodes/factories/relay-rete-node-factory";
import { NodeChannelInfo } from "../utilities/node";
import { PlotControl } from "./nodes/controls/plot-control";

interface IProps extends IBaseProps {}

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
      <div className="flow-tool" ref={elt => this.toolDiv = elt} />
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
        new RelayReteNodeFactory(numSocket)];
      if (!this.toolDiv) return;

      this.programEditor = new Rete.NodeEditor(RETE_APP_IDENTIFIER, this.toolDiv);
      this.programEditor.use(ConnectionPlugin);
      this.programEditor.use(ReactRenderPlugin);
      this.programEditor.use(ContextMenuPlugin);

      this.programEngine = new Rete.Engine(RETE_APP_IDENTIFIER);

      components.map(c => {
        this.programEditor.register(c);
        this.programEngine.register(c);
      });

      const n1 = await components[4].createNode();
      const n2 = await components[0].createNode({ num: 10 });
      const logic = await components[3].createNode();

      n1.position = [80, 80];
      n2.position = [80, 440];
      logic.position = [450, 200];

      this.programEditor.addNode(n1);
      this.programEditor.addNode(n2);
      this.programEditor.addNode(logic);

      this.programEditor.connect(n1.outputs.get("num")!, logic.inputs.get("num1")!);
      this.programEditor.connect(n2.outputs.get("num")!, logic.inputs.get("num2")!);

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
        let newChannel = false;
        hubStore.hubs.forEach(hub => {
          hub.hubChannels.forEach(ch => {
            if (!this.channels.find( ci => ci.hubId === hub.hubId && ci.channelId === ch.id )) {
              const nci: NodeChannelInfo = {hubId: hub.hubId,
                                            hubName: hub.hubName,
                                            channelId: ch.id,
                                            type: ch.type,
                                            units: ch.units};
              this.channels.push(nci);
              newChannel = true;
            }
          });
        });
        // update any existing blocks since we found a new sensor or relay
        if (newChannel) {
          this.programEditor.nodes.forEach((n: Node) => {
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
          });
        }
      });

      // Can this auto-call processing and be in the sensor component instead of doing this n^2 loop
      autorun(() => {
        const { hubStore } = this.stores;
        let change = false;
        hubStore.hubs.forEach(hub => {
          hub.hubChannels.forEach(ch => {
            const chValue = Number.parseFloat(ch.value);
            if (!Number.isNaN(chValue) && ch.type !== "relay") {
              const hubSensorId = hub.hubId + "/" + ch.id;
              const nodes = this.programEditor.nodes.filter((n: Node) => n.data.sensor === hubSensorId);
              if (nodes) {
                nodes.forEach((n: Node) => {
                  const sensorSelect = n.controls.get("sensorSelect") as SensorSelectControl;
                  if (sensorSelect && sensorSelect.getSensorValue() !== chValue) {
                    sensorSelect.setSensorValue(chValue);
                    change = true;
                  }
                });
              }
            }
          });
        });
        if (change) {
          (async () => {
            await this.programEngine.abort();
            await this.programEngine.process(this.programEditor.toJSON());
          })();
        }
      });

      this.programEditor.view.resize();
      this.programEditor.trigger("process");

      this.intervalHandle = setInterval(this.heartBeat, HEARTBEAT_INTERVAL);

    })();
  }

  private heartBeat = () => {
    this.programEditor.nodes.forEach((n: Node) => {
      if (n.data.hasOwnProperty("nodeValue")) {
        this.updateNodeRecentValues(n);
      }
    });
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
}
