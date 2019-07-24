import * as React from "react";
import Rete from "rete";
import "./sensor-select-control.sass";
import { NodeSensorTypes, NodeChannelInfo } from "../../../utilities/node";

export class SensorSelectControl extends Rete.Control {
  private emitter: any;
  private component: any;
  private props: any;
  private node: any;

  constructor(emitter: any, key: string, node: any, readonly = false) {
    super(key);
    this.emitter = emitter;
    this.key = key;
    this.node = node;

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
            <option key={i} value={val.type}>
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
            <option key={i} value={ch.channelId}>
              {ch.hubName + ":" + ch.type}
            </option>
          )) : null}
        </select>
        <div className="value">
          <input
            readOnly={true}
            value={compProps.value}
          />
          <label className="units">
            {displayedUnits(compProps.sensor, compProps.channels, compProps.type)}
          </label>
        </div>
      </div>
    );

    const displayedUnits = (id: string, channels: NodeChannelInfo[], type: string) => {
      let units = "";
      const sensor = channels.find((ch: any) => ch.channelId === id);
      if (sensor && sensor.units) {
        units = sensor.units;
        units = units.replace(/_/g, "");
        units = units.replace(/degrees/g, "°");
        units = units.replace(/percent/g, "%");
      } else {
        const sensorType = NodeSensorTypes.find((s: any) => s.type === type);
        if (sensorType && sensorType.units) {
          units = sensorType.units;
        }
      }
      return units;
    };

    const initialType = node.data.type || "temperature";
    const initialSensor = node.data.sensor || "none";
    node.data.type = initialType;
    node.data.sensor = initialSensor;
    node.data.nodeValue = 0;

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
    if (this.node.data.sensor && this.node.data.sensor !== "none") {
      if (!channels.find(ch => ch.channelId === this.node.data.sensor)) {
        this.props.value = 0;
        this.putData("nodeValue", 0);
        this.props.sensor = "none";
        this.putData("sensor", "none");
      }
    }
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
    const nch: NodeChannelInfo = this.props.channels.find((ch: any) => ch.channelId === val);
    this.setSensorValue(nch ? nch.value : 0);

    this.props.sensor = val;
    this.putData("sensor", val);
    (this as any).update();
  }

  public setSensorValue = (val: any) => {
    this.props.value = val;
    this.putData("nodeValue", val);
    (this as any).update();
  }

  public getSensorValue = () => {
    return this.props.value;
  }
}
