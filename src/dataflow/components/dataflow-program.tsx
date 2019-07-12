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
import { RelaySelectControl } from "./nodes/controls/relay-select-control";
import { NumReteNodeFactory } from "./nodes/factories/num-rete-node-factory";
import { MathReteNodeFactory } from "./nodes/factories/math-rete-node-factory";
import { TransformReteNodeFactory } from "./nodes/factories/transform-rete-node-factory";
import { LogicReteNodeFactory } from "./nodes/factories/logic-rete-node-factory";
import { SensorReteNodeFactory } from "./nodes/factories/sensor-rete-node-factory";
import { RelayReteNodeFactory } from "./nodes/factories/relay-rete-node-factory";
import { NodeChannelInfo } from "../utilities/node";

interface IProps extends IBaseProps {}

interface IState {}

const numSocket = new Rete.Socket("Number value");

@inject("stores")
@observer
export class DataflowProgram extends BaseComponent<IProps, IState> {
  private toolDiv: HTMLElement | null;
  private channels: NodeChannelInfo[] = [];

  public render() {
    return (
      <div className="flow-tool" ref={elt => this.toolDiv = elt} />
    );
  }

  public componentDidMount() {
    (async () => {
      const components = [new NumReteNodeFactory(numSocket),
        new MathReteNodeFactory(numSocket),
        new TransformReteNodeFactory(numSocket),
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

      const n1 = await components[4].createNode();
      const n2 = await components[0].createNode({ num: 10 });
      const logic = await components[3].createNode();

      n1.position = [80, 200];
      n2.position = [80, 400];
      logic.position = [500, 240];

      editor.addNode(n1);
      editor.addNode(n2);
      editor.addNode(logic);

      editor.connect(n1.outputs.get("num")!, logic.inputs.get("num1")!);
      editor.connect(n2.outputs.get("num")!, logic.inputs.get("num2")!);

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
          sensorSelect.setChannels(this.channels);
        } else if (node.name === "Relay") {
          const relayList = node.controls.get("relayList") as RelaySelectControl;
          relayList.setChannels(this.channels);
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
          editor.nodes.forEach((n: Node) => {
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
