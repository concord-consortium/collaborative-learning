import * as React from "react";
import Rete from "rete";
import { NodeSensorTypes, NodeChannelInfo } from "../../../utilities/node";
import "./sensor-select-control.sass";
import "./value-control.sass";

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
                                   onSensorClick: any;
                                   onListClick: any;
                                   showList: any
                                   channels: NodeChannelInfo[]
                                  }) => (
      <div className="sensor-box">
        { renderSensorTypeList(compProps.type, compProps.showList, compProps.onSensorClick, compProps.onListClick) }
        { renderSensorList(compProps.sensor, compProps.channels, compProps.type, compProps.onSensorChange)}
        { renderSensorValue(compProps.value, compProps.sensor, compProps.channels, compProps.type)}
      </div>
    );

    const renderSensorTypeList = (type: string, showList: boolean, onItemClick: any, onListClick: any) => {
      let icon = "";
      const sensorType = NodeSensorTypes.find((s: any) => s.name === type);
      if (sensorType && sensorType.icon) {
        icon = `#${sensorType.icon}`;
      }
      return (
        <div className="node-select sensor">
          <div className="item top" onClick={handleChange(onItemClick)}>
            <svg className="icon top">
              <use xlinkHref={icon}/>
            </svg>
            <div className="label">{type}</div>
            <svg className="icon arrow">
              <use xlinkHref="#icon-down-arrow"/>
            </svg>
          </div>
          {showList ?
          <div className="option-list">
            {NodeSensorTypes.map((val: any, i: any) => (
              <div
              className={val.name === type ? "item sensor selected" : "item sensor selectable"}
                key={i}
                onClick={onListClick(val.name)}
              >
                <svg className="icon">
                  <use xlinkHref={`#${val.icon}`}/>
                </svg>
                <div className="label">{val.name}</div>
              </div>
            ))}
          </div>
          : null }
        </div>
      );
    };

    const renderSensorList = (id: string, channels: NodeChannelInfo[], type: string, onSensorChange: any) => {
      return (
        <select
          className="sensor"
          value={id}
          onChange={handleChange(onSensorChange)}
          onPointerMove={handlePointerMove}>
          <option value="none">none</option>
          {channels ? channels.filter((ch: NodeChannelInfo) => (
            ch.type === type
          ))
          .map((ch: NodeChannelInfo, i: any) => (
            <option key={i} value={ch.channelId} className="sensor">
              {ch.hubName + ":" + ch.type}
            </option>
          )) : null}
        </select>
      );
    };

    const renderSensorValue = (value: number, id: string, channels: NodeChannelInfo[], type: string) => {
      return (
        <div className="value-container sensor-value">
          {`${value} ${displayedUnits(id, channels, type)}`}
        </div>
      );
    };

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
      onSensorClick: (v: any) => {
        this.props.showList = !this.props.showList;
        (this as any).update();
      },
      onListClick: (v: any) => () => {
        this.props.showList = !this.props.showList;
        (this as any).update();
        this.setSensorType(v);
        this.emitter.trigger("process");
      },
      showList: false,
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
