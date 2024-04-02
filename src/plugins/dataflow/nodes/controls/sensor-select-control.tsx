// FIXME: ESLint is unhappy with these control components
/* eslint-disable react-hooks/rules-of-hooks */
import classNames from "classnames";
import React, { useRef }  from "react";
import Rete, { NodeEditor, Node } from "rete";

import { useStopEventPropagation, useCloseDropdownOnOutsideEvent } from "./custom-hooks";
import { NodeSensorTypes, kSensorSelectMessage, kSensorMissingMessage } from "../../model/utilities/node";
import { NodeChannelInfo, kDeviceDisplayNames } from "../../model/utilities/channel";
import DropdownCaretIcon from "../../assets/icons/dropdown-caret.svg";
import { dataflowLogEvent } from "../../dataflow-logger";
import { resetGraph } from "../../utilities/graph-utils";

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
      useStopEventPropagation(divRef, "wheel");
      const listRef = useRef<HTMLDivElement>(null);
      useCloseDropdownOnOutsideEvent(listRef, () => this.props.showTypeList, () => {
                                      this.props.showTypeList = false;
                                      (this as any).update();
                                    });
      let icon: any = "";
      let name = "";
      const sensorType = NodeSensorTypes.find((s: any) => s.type === type);
      if (sensorType && sensorType.icon) {
        icon = sensorType.icon;
        name = sensorType.name;
      }

      return (
        <div className="node-select sensor-type" ref={divRef} title={"Select Sensor Type"}>
          <div className="item top" onMouseDown={handleChange(onDropdownClick)}>
            { type === "none"
              ? <div className="label unselected">Select an input type</div>
              : <div className="top-item-holder">
                  <svg className="icon top">
                    {typeof icon === "string" ? icon : icon()}
                  </svg>
                  <div className="label">{name}</div>
                </div>
            }
            <svg className="icon dropdown-caret">
              <DropdownCaretIcon />
            </svg>
          </div>
          {showList ?
          <div className="option-list" ref={listRef}>
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
                  {typeof val.icon === "string" ? val.icon : val.icon()}
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
      useStopEventPropagation(divRef, "wheel");
      const listRef = useRef<HTMLDivElement>(null);
      useCloseDropdownOnOutsideEvent(listRef, () => this.props.showSensorList, () => {
                                      this.props.showSensorList = false;
                                      (this as any).update();
                                    });
      const channelsForType = channels.filter((ch: NodeChannelInfo) => {
        if (ch.type !== "relays"){
          return (ch.type === type) || (type === "none");
        }
      });
      const selectedChannel = channelsForType.find((ch: any) => ch.channelId === id);

      const getChannelString = (ch?: NodeChannelInfo | "none") => {
        if (ch === "none") return "None Available";
        if (!ch && (!id || id === "none")) return kSensorSelectMessage;
        if (!ch) return `${kSensorMissingMessage} ${id}`;
        if (ch.missing) {
          const deviceStr = kDeviceDisplayNames[`${ch.deviceFamily}`];
          return `${kSensorMissingMessage} Connect ${deviceStr} for live ${ch.displayName}`;
        }
        const chStr = ch.virtual
          ? `${ch.name} Demo Data`
          : ch.simulated
          ? `Simulated ${ch.name}`
          : `${ch.hubName}:${ch.type}`;
        return chStr;
      };

      const options: any = [...channelsForType];
      if (!options.length) {
        options.push("none");
      }
      const channelString = getChannelString(selectedChannel);
      const titleClass = classNames("label", { selected: channelString.includes(kSensorSelectMessage) });
      const topItemClass = classNames("item", "top", { missing: channelString.includes(kSensorMissingMessage) });
      return (
        <div className="node-select sensor-select" ref={divRef} title={"Select Sensor"}>
          <div className={topItemClass} onMouseDown={handleChange(onDropdownClick)}>
            <div className={titleClass}>{channelString}</div>
            <div className="dropdown-caret-holder">
              <svg className="icon dropdown-caret">
                <DropdownCaretIcon />
              </svg>
            </div>
          </div>
          {showList ?
          <div className="option-list" ref={listRef}>
            {options.map((ch: NodeChannelInfo, i: any) => {
              const selected = (!!id && !!ch && ch.channelId === id) || (!selectedChannel && i === 0);
              const missing = ch.missing;
              const className = classNames("item", "sensor-type-option", { selected, missing });
              return (
                <div
                  className={className}
                  key={i}
                  onMouseDown={onListOptionClick(ch ? ch.channelId : null)}
                >
                  <div className="label">
                    {getChannelString(ch)}
                  </div>
                </div>
              );
            })}
          </div>
          : null }
        </div>
      );
    };

    const initialType = node.data.type || "none";
    const initialSensor = node.data.sensor || "none";
    const initialVirtual = node.data.virtual || false;
    node.data.type = initialType;
    node.data.sensor = initialSensor;
    node.data.nodeValue = NaN;
    node.data.virtual = initialVirtual;

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
        this.emitter.trigger("selectnode", { node: this.getNode() });
        this.props.showSensorList = !this.props.showSensorList;
        this.props.showTypeList = false;
        (this as any).update();
      },
      onTypeDropdownClick: (v: any) => {
        this.emitter.trigger("selectnode", { node: this.getNode() });
        this.props.showTypeList = !this.props.showTypeList;
        this.props.showSensorList = false;
        (this as any).update();
      },
      onTypeOptionClick: (v: any) => () => {
        this.emitter.trigger("selectnode", { node: this.getNode() });
        this.props.showTypeList = !this.props.showTypeList;
        this.props.showSensorList = false;
        (this as any).update();
        this.setSensorType(v);
        this.emitter.trigger("process");

        const tileId = this.getNode().meta.inTileWithId as string;
        const changeObj = { node: this.getNode(), sensorTypeValue: v };
        dataflowLogEvent("selectsensortype", changeObj, tileId);
      },
      onSensorOptionClick: (v: any) => () => {
        this.emitter.trigger("selectnode", { node: this.getNode() });
        this.props.showSensorList = !this.props.showSensorList;
        this.props.showTypeList = false;
        (this as any).update();
        this.setSensor(v);
        this.emitter.trigger("process");

        const tileId = this.getNode().meta.inTileWithId as string;
        const changeObj = { node: this.getNode(), sensorDataOptionValue: v };
        dataflowLogEvent("selectsensordataoption", changeObj, tileId);
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
  };

  public setSensorType = (val: any) => {
    this.setSensor("none");
    this.props.type = val;
    this.putData("type", val);
    (this as any).update();
  };

  public setSensor = (val: any) => {
    resetGraph(this.node);

    const nch: NodeChannelInfo = this.props.channels.find((ch: any) => ch.channelId === val);
    this.setSensorValue(nch ? nch.value : NaN);
    this.setSensorVirtualState(!!nch?.virtual);

    if (nch && nch.type && this.getData("type") !== nch.type) {
      this.props.type = nch.type;
      this.putData("type", nch.type);
    }
    this.props.sensor = val;
    this.putData("sensor", val);
    (this as any).update();
  };

  public setSensorValue = (val: any) => {
    this.props.value = val;
    this.putData("nodeValue", val);
    (this as any).update();
  };

  public setSensorVirtualState = (val: boolean) => {
    this.props.value = val;
    this.putData("virtual", val);
    (this as any).update();
  };

  public getSensorValue = () => {
    return this.props.value;
  };
}
/* eslint-enable */
