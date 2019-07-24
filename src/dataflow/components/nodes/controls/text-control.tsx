import * as React from "react";
import Rete from "rete";
import "./text-control.sass";

export class TextControl extends Rete.Control {
  private emitter: any;
  private component: any;
  private props: any;
  constructor(emitter: any,
              key: string,
              node: any,
              label = "",
              initVal = "") {
    super(key);
    this.emitter = emitter;
    this.key = key;
    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(e.target.value); };
    };
    const handlePointerMove = (e: any) => e.stopPropagation();
    this.component = (compProps: { value: any; onChange: any; label: any}) => (
      <div className="text-container">
        { label
          ? <label className="text-label">{compProps.label}</label>
          : null
        }
        <input className="text-input"
          type={"text"}
          value={compProps.value}
          onChange={handleChange(compProps.onChange)}
          onPointerMove={handlePointerMove}
        />
      </div>
    );

    const initial = node.data[key] || initVal;
    node.data[key] = initial;

    this.props = {
      value: initial,
      onChange: (v: any) => {
        this.setValue(v);
        this.emitter.trigger("process");
      },
      label
    };
  }

  public setValue = (val: string) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  }

  public getValue = () => {
    return this.props.value;
  }
}
