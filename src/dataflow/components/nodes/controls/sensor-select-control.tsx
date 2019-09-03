import * as React from "react";
import { useRef } from "react";
import Rete, { NodeEditor, Node } from "rete";
import { NodeSensorTypes, NodeChannelInfo } from "../../../utilities/node";
import { useStopEventPropagation } from "./custom-hooks";
import "./sensor-select-control.sass";
import "./value-control.sass";

export class SensorSelectControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  private node: Node;

  constructor(emitter: NodeEditor, key: string, node: Node, readonly = false) {
    super(key);
    this.emitter = emitter;
    this.key = key;
    this.node = node;

    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(e.target.value); };
    };

    this.component = (compProps: {
                                   type: string;
                                   sensor: string;
                                   value: number;
                                   onTypeChange: () => void;
                                   onSensorDropdownClick: () => void;
                                   onSensorOptionClick: () => void;
                                   onTypeDropdownClick: () => void;
                                   onTypeOptionClick: () => void;
                                   showTypeList: boolean;
                                   showSensorList: boolean;
                                   channels: NodeChannelInfo[]
                                  }) => (
      <div className="sensor-box">
        { renderSensorTypeList(
            compProps.type,
            compProps.showTypeList,
            compProps.onTypeDropdownClick,
            compProps.onTypeOptionClick
          )
        }
        { renderSensorList(
            compProps.sensor,
            compProps.showSensorList,
            compProps.channels,
            compProps.type,
            compProps.onSensorDropdownClick,
            compProps.onSensorOptionClick
          )
        }
      </div>
    );

    const renderSensorTypeList = (type: string, showList: boolean, onDropdownClick: any, onListOptionClick: any) => {
      const divRef = useRef<HTMLDivElement>(null);
      useStopEventPropagation(divRef, "pointerdown");
      let icon = "";
      const sensorType = NodeSensorTypes.find((s: any) => s.type === type);
      if (sensorType && sensorType.icon) {
        icon = `#${sensorType.icon}`;
      }
      return (
        <div className="node-select sensor-type" ref={divRef}>
          <div className="item top" onMouseDown={handleChange(onDropdownClick)}>
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
                className={
                  val.type === type
                    ? "item sensor-type-option selected"
                    : "item sensor-type-option selectable"
                }
                key={i}
                onMouseDown={onListOptionClick(val.type)}
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

    const renderSensorList = (
        id: string,
        showList: boolean,
        channels: NodeChannelInfo[],
        type: string,
        onDropdownClick: any,
        onListOptionClick: any) => {
      const divRef = useRef<HTMLDivElement>(null);
      useStopEventPropagation(divRef, "pointerdown");

      const channelsForType = channels.filter((ch: NodeChannelInfo) => (ch.type === type));
      const selectedChannel = channelsForType.find((ch: any) => ch.channelId === id);

      const getChannelString = (ch?: NodeChannelInfo | "none") => {
        if (!ch && (!id || id === "none") || ch === "none") return "none";
        if (!ch) return "Searching for " + id;
        let count = 0;
        channelsForType.forEach( c => { if (c.type === ch.type && ch.hubId === c.hubId) count++; } );
        return `${ch.hubName}:${ch.type}${ch.plug > 0 && count > 1 ? `(plug ${ch.plug})` : ""}`;
      };

      const options = ["none", ...channelsForType];
      return (
        <div className="node-select sensor-select" ref={divRef}>
          <div className="item top" onMouseDown={handleChange(onDropdownClick)}>
            <div className="label">{getChannelString(selectedChannel)}</div>
            <svg className="icon arrow">
              <use xlinkHref="#icon-down-arrow"/>
            </svg>
          </div>
          {showList ?
          <div className="option-list">
            {options.map((ch: NodeChannelInfo, i: any) => (
              <div
                className={
                  (!!id && !!ch && ch.channelId === id) || (!selectedChannel && i === 0)
                    ? "item sensor-type-option selected"
                    : "item sensor-type-option selectable"
                }
                key={i}
                onMouseDown={onListOptionClick(ch ? ch.channelId : null)}
              >
                <div className="label">
                  { getChannelString(ch) }
                </div>
              </div>
            ))}
          </div>
          : null }
        </div>
      );
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
        this.setSensor(null);
        this.emitter.trigger("process");
      },
      onSensorDropdownClick: (v: any) => {
        this.props.showSensorList = !this.props.showSensorList;
        this.props.showTypeList = false;
        (this as any).update();
      },
      onTypeDropdownClick: (v: any) => {
        this.props.showTypeList = !this.props.showTypeList;
        this.props.showSensorList = false;
        (this as any).update();
      },
      onTypeOptionClick: (v: any) => () => {
        this.props.showTypeList = !this.props.showTypeList;
        this.props.showSensorList = false;
        (this as any).update();
        this.setSensorType(v);
        this.emitter.trigger("process");
      },
      onSensorOptionClick: (v: any) => () => {
        this.props.showSensorList = !this.props.showSensorList;
        this.props.showTypeList = false;
        (this as any).update();
        this.setSensor(v);
        this.emitter.trigger("process");
      },
      showSensorList: false,
      showTypeList: false,
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
