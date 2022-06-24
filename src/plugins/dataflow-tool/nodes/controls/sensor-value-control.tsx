import React from "react";
import Rete, { NodeEditor, Node } from "rete";
import { NodeSensorTypes } from "../../model/utilities/node";
import { kEmptyValueString } from "../factories/dataflow-rete-node-factory";
import "./sensor-value-control.sass";
import "./value-control.sass";

export class SensorValueControl extends Rete.Control {
  private component: any;
  private props: any;
  private node: Node;

  constructor(emitter: NodeEditor, key: string, node: Node, readonly = false) {
    console.log("NOTE [ 9 ] instantiating SensorValueControl")
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
      <div className="sensor-value" title={"Node Value"}>
        <div className="value-container">
          {isNaN(compProps.value) ? kEmptyValueString : compProps.value}
        </div>
        <div className={`units-container ${compProps.units.length > 4 ? "small" : ""}`}>
          {compProps.units}
        </div>
      </div>
    );
  }

  public setValue = (val: number) => {
    console.log("NOTE [8] setValue called from sensor-value-control, passed", val)
    this.props.value = val;
    this.putData(this.key, val);
    this.updateUnits();
    (this as any).update();
  };

  public getValue = () => {
    return this.props.value;
  };

  private updateUnits = () => {
    const type = this.node.data.type as string;
    let units = "";
    const sensorType = NodeSensorTypes.find((s: any) => s.type === type);
    if (sensorType && sensorType.units) {
      units = sensorType.units;
    }
    this.props.units = units;
  };
}
