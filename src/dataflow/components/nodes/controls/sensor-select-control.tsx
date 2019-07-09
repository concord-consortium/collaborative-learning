import * as React from "react";
import Rete from "rete";
import "./sensor-select-control.sass";
import { NodeSensorInfo } from "../../../utilities/node";

export class SensorSelectControl extends Rete.Control {
  private emitter: any;
  private component: any;
  private props: any;
  constructor(emitter: any, key: string, node: any, sensorsArray: any, readonly = false) {
    super(key);
    this.emitter = emitter;
    this.key = key;

    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(e.target.value); };
    };
    const handlePointerMove = (e: any) => e.stopPropagation();

    this.component = (compProps: {
                                   type: any;
                                   sensor: any;
                                   value: any;
                                   onTypeChange: any;
                                   onSensorChange: any;
                                   onChange: any;
                                   sensorsArray: any;
                                  }) => (
      <div className="sensor-box">
        <select
          className="type-dropdown"
          value={compProps.type}
          onChange={handleChange(compProps.onTypeChange)}
          onPointerMove={handlePointerMove}>
          {NodeSensorInfo.map((val: any, i: any) => (
            <option key={i} value={val.name}>
              {val.name}
            </option>
          ))}
        </select>
        <select
          value={compProps.sensor}
          onChange={handleChange(compProps.onSensorChange)}
          onPointerMove={handlePointerMove}>
          <option value="none">none</option>
          {compProps.sensorsArray.filter((val: any) => (
            val.search(compProps.type.slice(0, 5)) >= 0
          ))
          .map((val: any, i: any) => (
            <option key={i} value={val}>
              {val}
            </option>
          ))}
        </select>
        <div className="value">
          <input
            type={"text"}
            value={compProps.value}
            onChange={handleChange(compProps.onChange)}
            onPointerMove={handlePointerMove}
          />
          <label className="units">
            {NodeSensorInfo.find((s: any) => s.name === compProps.type)!.units}
          </label>
        </div>
      </div>
    );

    const initialSensor = "none";
    node.data[key] = 0;
    const initialType = "temperature";

    this.props = {
      readonly,
      sensor: initialSensor,
      type: initialType,
      value: 0,
      onTypeChange: (v: any) => {
        this.setSensorType(v);
        this.emitter.trigger("process");
      },
      onSensorChange: (v: any) => {
        this.setSensor(v);
        this.emitter.trigger("process");
      },
      onChange: (v: any) => {
        this.setSensorValue(v);
        this.emitter.trigger("process");
      },
      sensorsArray
    };
  }

  public setSensorOptions = (sensors: any) => {
    this.props.sensorsArray = sensors;

    // problem, if called with event nodecreate, update doesn't exist
    // (this as any).update();
  }

  public setSensorType = (val: any) => {
    this.setSensor("none");

    this.props.type = val;
    this.putData("type", val);
    (this as any).update();
  }

  public setSensor = (val: any) => {
    this.setSensorValue(0);

    this.props.sensor = val;
    this.putData("sensor", val);
    (this as any).update();
  }

  public getSensor = () => {
    return this.props.value;
  }

  public setSensorValue = (val: any) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  }

  public getSensorValue = () => {
    return this.props.value;
  }
}
