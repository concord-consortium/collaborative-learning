import * as React from "react";
import { useRef } from "react";
import Rete, { NodeEditor, Node } from "rete";
import { NodeChannelInfo } from "../../../utilities/node";
import { useStopEventPropagation } from "./custom-hooks";
import "./sensor-select-control.sass";

export class RelaySelectControl extends Rete.Control {
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

    this.component = (compProps: { value: any; onChange: any; channels: NodeChannelInfo[] }) => (
      <div>
        { renderRelayList(compProps.value, compProps.channels, compProps.onChange) }
      </div>
    );

    const renderRelayList = (id: string, channels: NodeChannelInfo[], onRelayChange: any) => {
      const selectRef = useRef<HTMLSelectElement>(null);
      useStopEventPropagation(selectRef, "pointerdown");
      return (
        <select
          ref={selectRef}
          value={id}
          onChange={handleChange(onRelayChange)}
        >
        <option value="none">none</option>
        {channels ? channels.filter((ch: NodeChannelInfo) => (
          ch.type === "relay"
        ))
        .map((ch: NodeChannelInfo, i: number) => (
          renderRelayOption(i, ch, channels)
        )) : null}
      </select>
      );
    };

    const renderRelayOption = (i: number, ch: NodeChannelInfo, channels: NodeChannelInfo[]) => {
      let count = 0;
      channels.forEach( c => { if (c.type === "relay" && ch.hubId === c.hubId) count++; } );
      return (
        <option key={i} value={ch.channelId}>
          {`${ch.hubName}:${ch.type}${ch.plug > 0 && count > 1 ? `(plug ${ch.plug})` : ""}`}
        </option>
      );
    };

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
