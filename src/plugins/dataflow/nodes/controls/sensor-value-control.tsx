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

    this.component = (compProps: { value: number; units: string; }) => {

      const sensorType = NodeSensorTypes.find((s: any) => s.type === this.node.data.type);
      const decimalPlaces = sensorType?.decimalPlaces ? sensorType.decimalPlaces : 0;
      const displayValue = isNaN(compProps.value)
        ? kEmptyValueString
        : compProps.value.toFixed(decimalPlaces);

      return (
        <div className="sensor-value" title={"Node Value"}>
          <div className="value-container">
            {displayValue}
          </div>
          <div className={`units-container ${compProps.units.length > 4 ? "small" : ""}`}>
            {compProps.units}
          </div>
        </div>
      );
    };
  }

  public setValue = (val: number) => {
    if (isFinite(val)) {
      this.props.value = val;
      this.putData(this.key, val);
      this.updateUnits();
      (this as any).update();
    }
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
