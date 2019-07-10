import * as React from "react";
import Rete from "rete";
import "./sensor-select-control.sass";
import { NodeSensorTypes, NodeChannelInfo } from "../../../utilities/node";

export class SensorSelectControl extends Rete.Control {
  private emitter: any;
  private component: any;
  private props: any;
  constructor(emitter: any, key: string, node: any, readonly = false) {
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
                                   channels: NodeChannelInfo[]
                                  }) => (
      <div className="sensor-box">
        <select
          className="type-dropdown"
          value={compProps.type}
          onChange={handleChange(compProps.onTypeChange)}
          onPointerMove={handlePointerMove}>
          {NodeSensorTypes.map((val: any, i: any) => (
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
          {compProps.channels ? compProps.channels.filter((ch: NodeChannelInfo) => (
            ch.type === compProps.type
          ))
          .map((ch: NodeChannelInfo, i: any) => (
            <option key={i} value={ch.hubId + "/" + ch.channelId}>
              {ch.hubName + ":" + ch.type}
            </option>
          )) : null}
        </select>
        <div className="value">
          <input
            value={compProps.value}
          />
          <label className="units">
            {NodeSensorTypes.find((s: any) => s.name === compProps.type)!.units}
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
      channels: []
    };
  }

  public setChannels = (channels: NodeChannelInfo[]) => {
    this.props.channels = channels;

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
