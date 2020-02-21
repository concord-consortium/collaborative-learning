import React from "react";
import { useRef } from "react";
import Rete, { NodeEditor, Node } from "rete";
import { useStopEventPropagation } from "./custom-hooks";
import "./text-control.sass";

export class TextControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  constructor(emitter: NodeEditor,
              key: string,
              node: Node,
              label = "",
              initVal = "",
              tooltip = "") {
    super(key);
    this.emitter = emitter;
    this.key = key;
    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(e.target.value); };
    };
    this.component = (compProps: { value: any; onChange: any; label: any, color: string, tooltip: string}) => {
      const inputRef = useRef<HTMLInputElement>(null);
      useStopEventPropagation(inputRef, "pointerdown");
      return (
        <div className="text-container" title={compProps.tooltip}>
          { label
            ? <label className="text-label">{compProps.label}</label>
            : null
          }
          <input
            className="text-input"
            ref={inputRef}
            type={"text"}
            value={compProps.value}
            onChange={handleChange(compProps.onChange)}
          />
          {
          compProps.color && <div className="color-dot" style={{backgroundColor: compProps.color}}/>
          }
        </div>
      );
    };

    const initial = node.data[key] || initVal;
    node.data[key] = initial;

    this.props = {
      value: initial,
      onChange: (v: any) => {
        this.setValue(v);
        this.emitter.trigger("process");
      },
      label,
      tooltip
    };
  }

  public setValue = (val: string) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  }

  public setColor = (color: string) => {
    this.props.color = color;
  }

  public getValue = () => {
    return this.props.value;
  }
}
