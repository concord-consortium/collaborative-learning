import * as React from "react";
import Rete, { NodeEditor, Node } from "rete";
import { NodeSensorTypes } from "../../../utilities/node";
import "./sensor-value-control.sass";
import "./value-control.sass";

export class SensorValueControl extends Rete.Control {
  private component: any;
  private props: any;
  private node: Node;

  constructor(emitter: NodeEditor, key: string, node: Node, readonly = false) {
    super(key);
    this.key = key;
    this.node = node;

    const initial = node.data[key] || 0;

    this.props = {
      readonly,
      value: initial,
      units: ""
    };

    this.updateUnits();

    this.component = (compProps: { value: number; units: string; }) => (
      <div className="sensor-value">
        <div className="value-container">
          {compProps.value}
        </div>
        <div className="units-container">
          {compProps.units}
        </div>
      </div>
    );
  }

  public setValue = (val: number) => {
    this.props.value = val;
    this.putData(this.key, val);
    this.updateUnits();
    (this as any).update();
  }

  public getValue = () => {
    return this.props.value;
  }

  private updateUnits = () => {
    const type = this.node.data.type as string;
    let units = "";
    const sensorType = NodeSensorTypes.find((s: any) => s.type === type);
    if (sensorType && sensorType.units) {
      units = sensorType.units;
    }
    this.props.units = units;
  }
}
