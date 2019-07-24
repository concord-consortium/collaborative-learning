import * as React from "react";
import Rete from "rete";
import "./sensor-select-control.sass";
import { NodeSensorTypes, NodeChannelInfo } from "../../../utilities/node";

export class RelaySelectControl extends Rete.Control {
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

    this.component = (compProps: { value: any; onChange: any; channels: NodeChannelInfo[] }) => (
      <select
        value={compProps.value}
        onChange={handleChange(compProps.onChange)}
        onPointerMove={handlePointerMove}>
        <option value="none">none</option>
        {compProps.channels ? compProps.channels.filter((ch: NodeChannelInfo) => (
          ch.type === "relay"
        ))
        .map((ch: NodeChannelInfo, i: any) => (
          <option key={i} value={ch.channelId}>
            {ch.hubName + ":" + ch.type}
          </option>
        )) : null}
      </select>
    );

    const initial = node.data[key] || "none";
    node.data[key] = initial;

    this.props = {
      readonly,
      value: initial,
      onChange: (v: any) => {
        this.setValue(v);
        this.emitter.trigger("process");
      },
      channels: []
    };
  }

  public setChannels = (channels: NodeChannelInfo[]) => {
    this.props.channels = channels;

    if (this.node.data[this.key] && this.node.data[this.key] !== "none") {
      if (!channels.find(ch => ch.channelId === this.node.data[this.key])) {
        this.props.value = "none";
        this.putData(this.key, "none");
      }
    }

    // problem, if called with event nodecreate, update doesn't exist
    // (this as any).update();
  }

  public setValue = (val: any) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  }

  public getValue = () => {
    return this.props.value;
  }
}
