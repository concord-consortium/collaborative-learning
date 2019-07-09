import "@babel/polyfill"; // errors about missing `regeneratorRuntime` without this
import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import * as React from "react";
import Rete from "rete";
import { Node } from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ReactRenderPlugin from "rete-react-render-plugin";
import ContextMenuPlugin from "rete-context-menu-plugin";
import { autorun, observable } from "mobx";
import "./dataflow-program.sass";
import { SensorSelectControl } from "./nodes/controls/sensor-select-control";
import { DropdownListControl } from "./nodes/controls/dropdown-list-control";
import { NumReteNodeFactory } from "./nodes/factories/num-rete-node-factory";
import { ArithmeticReteNodeFactory } from "./nodes/factories/arithmetic-rete-node-factory";
import { UnaryArithmeticReteNodeFactory } from "./nodes/factories/unary-arithmetic-rete-node-factory";
import { LogicReteNodeFactory } from "./nodes/factories/logic-rete-node-factory";
import { ComparisonReteNodeFactory } from "./nodes/factories/comparison-rete-node-factory";
import { SensorReteNodeFactory } from "./nodes/factories/sensor-rete-node-factory";
import { RelayReteNodeFactory } from "./nodes/factories/relay-rete-node-factory";

interface IProps extends IBaseProps {}

interface IState {}

const numSocket = new Rete.Socket("Number value");

@inject("stores")
@observer
export class DataflowProgram extends BaseComponent<IProps, IState> {
  private toolDiv: HTMLElement | null;
  private hubSensorIds: string[] = [];
  private hubRelayIds: string[] = ["none"];

  public render() {
    return (
      <div className="flow-tool" ref={elt => this.toolDiv = elt} />
    );
  }

  public componentDidMount() {
    (async () => {
      const components = [new NumReteNodeFactory(numSocket),
        new ArithmeticReteNodeFactory(numSocket),
        new UnaryArithmeticReteNodeFactory(numSocket),
        new ComparisonReteNodeFactory(numSocket),
        new LogicReteNodeFactory(numSocket),
        new SensorReteNodeFactory(numSocket),
        new RelayReteNodeFactory(numSocket)];
      if (!this.toolDiv) return;

      const editor = new Rete.NodeEditor("demo@0.1.0", this.toolDiv);
      editor.use(ConnectionPlugin);
      editor.use(ReactRenderPlugin);
      editor.use(ContextMenuPlugin);

      const engine = new Rete.Engine("demo@0.1.0");

      components.map(c => {
        editor.register(c);
        engine.register(c);
      });

      const n1 = await components[0].createNode({ num: 6 });
      const n2 = await components[0].createNode({ num: 3 });
      const math = await components[1].createNode();

      n1.position = [80, 200];
      n2.position = [80, 400];
      math.position = [500, 240];

      editor.addNode(n1);
      editor.addNode(n2);
      editor.addNode(math);

      editor.connect(n1.outputs.get("num")!, math.inputs.get("num1")!);
      editor.connect(n2.outputs.get("num")!, math.inputs.get("num2")!);

      (editor as any).on(
        "process nodecreated noderemoved connectioncreated connectionremoved",
        async () => {
          await engine.abort();
          await engine.process(editor.toJSON());
        }
      );

      editor.on("nodecreate", node => {
        // trigger after each of the first six events
        // add the current set of sensors or relays to node controls
        if (node.name === "Sensor") {
          const sensorSelect = node.controls.get("sensorSelect") as SensorSelectControl;
          sensorSelect.setSensorOptions(this.hubSensorIds);
        } else if (node.name === "Relay") {
          const relayList = node.controls.get("relayList") as DropdownListControl;
          relayList.setOptions(this.hubRelayIds);
        }
        return true;
      });

      // remove rete double click zoom
      editor.on("zoom", ({ source }) => {
        return source !== "dblclick";
      });

      // Can this be in a control with stores injected?
      autorun(() => {
        const { hubStore } = this.stores;
        let newSensor = false;
        let newRelay = false;
        hubStore.hubs.forEach(hub => {
          hub.hubChannels.forEach(ch => {
            const hubChannelId = hub.hubName + "/" + ch.id;
            if (ch.type !== "relay" && !this.hubSensorIds.includes(hubChannelId)) {
              this.hubSensorIds.push(hubChannelId);
              newSensor = true;
            } else if (ch.type === "relay" && !this.hubRelayIds.includes(hubChannelId)) {
              this.hubRelayIds.push(hubChannelId);
              newRelay = true;
            }
          });
        });
        // update any existing blocks since we found a new sensor or relay
        if (newSensor || newRelay) {
          editor.nodes.forEach((n: Node) => {
            const sensorSelect = n.controls.get("sensorSelect") as SensorSelectControl;
            const relayList = n.controls.get("relayList") as DropdownListControl;
            if (sensorSelect && newSensor) {
              sensorSelect.setSensorOptions(this.hubSensorIds);
              (sensorSelect as any).update();
            }
            if (relayList && newRelay) {
              relayList.setOptions(this.hubRelayIds);
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
              const hubSensorId = hub.hubName + "/" + ch.id;
              const nodes = editor.nodes.filter((n: Node) => n.data.sensor === hubSensorId);
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
            await engine.abort();
            await engine.process(editor.toJSON());
          })();
        }
      });

      editor.view.resize();
      (editor as any).trigger("process");
    })();
  }
}
